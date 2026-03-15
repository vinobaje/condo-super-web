const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe = require("stripe");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// ─── STRIPE CONFIG ───────────────────────────────────────────────────────────
// Set these in Firebase environment config:
// firebase functions:config:set stripe.secret="sk_live_..." stripe.webhook_secret="whsec_..."
const STRIPE_SECRET = functions.config().stripe?.secret || "sk_test_YOUR_KEY_HERE";
const STRIPE_WEBHOOK_SECRET = functions.config().stripe?.webhook_secret || "whsec_YOUR_WEBHOOK_SECRET";

// ─── PRICE IDs (set after creating products in Stripe Dashboard) ─────────────
// firebase functions:config:set \
//   stripe.prices.starter_monthly="price_..." \
//   stripe.prices.starter_yearly="price_..." \
//   stripe.prices.pro_monthly="price_..." \
//   stripe.prices.pro_yearly="price_..." \
//   stripe.prices.enterprise_monthly="price_..." \
//   stripe.prices.enterprise_yearly="price_..."
const PRICES = {
  starter: {
    monthly: functions.config().stripe?.prices?.starter_monthly || "price_1TB3pp0nNg9OZ0P5mADcQ6jn",
    yearly:  functions.config().stripe?.prices?.starter_yearly  || "price_1TB3pp0nNg9OZ0P5npjzQty0",
  },
  professional: {
    monthly: functions.config().stripe?.prices?.pro_monthly     || "price_1TB3qI0nNg9OZ0P5ovYi65IB",
    yearly:  functions.config().stripe?.prices?.pro_yearly      || "price_1TB3qh0nNg9OZ0P5ybbyqX5i",
  },
  enterprise: {
    monthly: functions.config().stripe?.prices?.ent_monthly     || "price_1TB3rD0nNg9OZ0P5yigJli5u",
    yearly:  functions.config().stripe?.prices?.ent_yearly      || "price_1TB3rd0nNg9OZ0P5QcM0esit",
  },
};

// ─── 1. CREATE PAYMENT INTENT ────────────────────────────────────────────────
// Called by the frontend when user clicks Subscribe.
// Returns a clientSecret for Stripe Elements to complete payment.
exports.createPaymentIntent = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {
      const { plan, billing, email, name } = req.body;

      if (!plan || !billing || !email) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const stripeClient = stripe(STRIPE_SECRET);
      const priceId = PRICES[plan]?.[billing];

      if (!priceId) {
        return res.status(400).json({ error: "Invalid plan or billing cycle" });
      }

      // Get or create Stripe customer
      let customerId;
      const existingCustomers = await stripeClient.customers.list({ email, limit: 1 });

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
      } else {
        const customer = await stripeClient.customers.create({ email, name });
        customerId = customer.id;
      }

      // Create subscription with payment_behavior: 'default_incomplete'
      // This allows us to collect payment details before charging
      const subscription = await stripeClient.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        metadata: { plan, billing, email, name },
      });

      const clientSecret = subscription.latest_invoice.payment_intent.client_secret;
      const subscriptionId = subscription.id;

      return res.status(200).json({ clientSecret, subscriptionId });

    } catch (err) {
      console.error("createPaymentIntent error:", err.message);
      return res.status(500).json({ error: "Payment setup failed. Please try again." });
    }
  });
});

// ─── 2. STRIPE WEBHOOK ───────────────────────────────────────────────────────
// Listens for Stripe events and updates Firestore accordingly.
// Set webhook URL in Stripe Dashboard to:
// https://us-central1-condo-super.cloudfunctions.net/stripeWebhook
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const stripeClient = stripe(STRIPE_SECRET);
    event = stripeClient.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send("Webhook signature verification failed");
  }

  try {
    switch (event.type) {

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;
        const stripeClient = stripe(STRIPE_SECRET);
        const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
        const { plan, billing, email } = subscription.metadata;

        await db.collection("subscriptions").doc(email).set({
          customerId,
          subscriptionId,
          plan,
          billing,
          email,
          status: "active",
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`✅ Subscription active: ${email} → ${plan} (${billing})`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const stripeClient = stripe(STRIPE_SECRET);
        const subscription = await stripeClient.subscriptions.retrieve(invoice.subscription);
        const { email } = subscription.metadata;

        await db.collection("subscriptions").doc(email).set({
          status: "payment_failed",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`⚠️ Payment failed: ${email}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const { email } = subscription.metadata;

        await db.collection("subscriptions").doc(email).set({
          status: "cancelled",
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`❌ Subscription cancelled: ${email}`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const { email, plan, billing } = subscription.metadata;

        await db.collection("subscriptions").doc(email).set({
          status: subscription.status,
          plan,
          billing,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`🔄 Subscription updated: ${email} → ${subscription.status}`);
        break;
      }

      default:
        console.log(`Unhandled event: ${event.type}`);
    }

    return res.json({ received: true });

  } catch (err) {
    console.error("Webhook handler error:", err.message);
    return res.status(500).send("Webhook handler failed");
  }
});

// ─── 3. GET SUBSCRIPTION STATUS ─────────────────────────────────────────────
// Frontend can call this to check if a user has an active subscription
exports.getSubscriptionStatus = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email required" });

      const doc = await db.collection("subscriptions").doc(email).get();

      if (!doc.exists) {
        return res.status(200).json({ status: "none", plan: "free" });
      }

      return res.status(200).json(doc.data());

    } catch (err) {
      console.error("getSubscriptionStatus error:", err.message);
      return res.status(500).json({ error: "Could not retrieve subscription" });
    }
  });
});

// ─── 4. CANCEL SUBSCRIPTION ──────────────────────────────────────────────────
exports.cancelSubscription = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email required" });

      const doc = await db.collection("subscriptions").doc(email).get();
      if (!doc.exists) return res.status(404).json({ error: "Subscription not found" });

      const { subscriptionId } = doc.data();
      const stripeClient = stripe(STRIPE_SECRET);

      // Cancel at period end (user keeps access until billing period ends)
      await stripeClient.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });

      await db.collection("subscriptions").doc(email).set({
        status: "cancelling",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      return res.status(200).json({ success: true, message: "Subscription will cancel at period end" });

    } catch (err) {
      console.error("cancelSubscription error:", err.message);
      return res.status(500).json({ error: "Could not cancel subscription" });
    }
  });
});

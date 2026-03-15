const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe = require("stripe");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// ─── STRIPE CONFIG ────────────────────────────────────────────────────────────
const STRIPE_SECRET         = functions.config().stripe?.secret          || "sk_live_YOUR_KEY_HERE";
const STRIPE_WEBHOOK_SECRET = functions.config().stripe?.webhook_secret  || "whsec_YOUR_WEBHOOK_SECRET";

// ─── REAL PRICE IDs ───────────────────────────────────────────────────────────
const PRICES = {
  starter: {
    monthly: "price_1TB3pp0nNg9OZ0P5mADcQ6jn",
    yearly:  "price_1TB3pp0nNg9OZ0P5npjzQty0",
  },
  professional: {
    monthly: "price_1TB3qI0nNg9OZ0P5ovYi65IB",
    yearly:  "price_1TB3qh0nNg9OZ0P5ybbyqX5i",
  },
  enterprise: {
    monthly: "price_1TB3rD0nNg9OZ0P5yigJli5u",
    yearly:  "price_1TB3rd0nNg9OZ0P5QcM0esit",
  },
};

// ─── PRODUCT IDs (for reference) ─────────────────────────────────────────────
// starter:      prod_U9MYId9aNq3WZY
// professional: prod_U9MZAYLmdG5xuw
// enterprise:   prod_U9MahhsUW7m7uQ

// ─── 1. CREATE PAYMENT INTENT ─────────────────────────────────────────────────
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
        return res.status(400).json({ error: "Invalid plan selected" });
      }

      // Get or create Stripe customer
      let customerId;
      const existing = await stripeClient.customers.list({ email, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const customer = await stripeClient.customers.create({ email, name });
        customerId = customer.id;
      }

      // Create incomplete subscription
      const subscription = await stripeClient.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        metadata: { plan, billing, email, name },
      });

      return res.status(200).json({
        clientSecret: subscription.latest_invoice.payment_intent.client_secret,
        subscriptionId: subscription.id,
      });

    } catch (err) {
      console.error("createPaymentIntent error:", err.message);
      return res.status(500).json({ error: "Payment setup failed. Please try again." });
    }
  });
});

// ─── 2. STRIPE WEBHOOK ────────────────────────────────────────────────────────
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe(STRIPE_SECRET).webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send("Webhook signature verification failed");
  }

  try {
    const stripeClient = stripe(STRIPE_SECRET);

    switch (event.type) {

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const sub = await stripeClient.subscriptions.retrieve(invoice.subscription);
        const { plan, billing, email } = sub.metadata;
        await db.collection("subscriptions").doc(email).set({
          customerId: invoice.customer,
          subscriptionId: invoice.subscription,
          plan, billing, email,
          status: "active",
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log(`✅ Active: ${email} → ${plan} (${billing})`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const sub = await stripeClient.subscriptions.retrieve(invoice.subscription);
        const { email } = sub.metadata;
        await db.collection("subscriptions").doc(email).set({
          status: "payment_failed",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log(`⚠️ Payment failed: ${email}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const { email } = sub.metadata;
        await db.collection("subscriptions").doc(email).set({
          status: "cancelled",
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log(`❌ Cancelled: ${email}`);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const { email, plan, billing } = sub.metadata;
        await db.collection("subscriptions").doc(email).set({
          status: sub.status, plan, billing,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log(`🔄 Updated: ${email} → ${sub.status}`);
        break;
      }
    }

    return res.json({ received: true });

  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(500).send("Webhook handler failed");
  }
});

// ─── 3. GET SUBSCRIPTION STATUS ──────────────────────────────────────────────
exports.getSubscriptionStatus = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email required" });
      const doc = await db.collection("subscriptions").doc(email).get();
      if (!doc.exists) return res.status(200).json({ status: "none", plan: "free" });
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
      await stripe(STRIPE_SECRET).subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      await db.collection("subscriptions").doc(email).set({
        status: "cancelling",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("cancelSubscription error:", err.message);
      return res.status(500).json({ error: "Could not cancel subscription" });
    }
  });
});

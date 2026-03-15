const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe = require("stripe");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// ─── STRIPE CONFIG ────────────────────────────────────────────────────────────
const STRIPE_SECRET = process.env.STRIPE_SECRET || functions.config().stripe?.secret;

// Each webhook destination has its own signing secret
// Since all 4 point to the same endpoint, we try each secret until one validates
const WEBHOOK_SECRETS = [
  "whsec_UaVKECKWyp2a5RuiUwHDaSq2txPWlgUV",  // invoice.payment_succeeded
  "whsec_Dt1IEknm5iRWmFoQELqHwneiRio7OiCg",  // invoice.payment_failed
  "whsec_hDa4BdNL83DA20c3xMi7Xi1bxa0vvluA",  // customer.subscription.deleted
  "whsec_mvWnpKw8bWwbb7UphRvyMpmGtW4RJ0H8",  // customer.subscription.updated
];

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

// ─── 1. CREATE PAYMENT INTENT ─────────────────────────────────────────────────
exports.createPaymentIntent = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const { plan, billing, email, name } = req.body;
      if (!plan || !billing || !email) return res.status(400).json({ error: "Missing required fields" });

      const stripeClient = stripe(STRIPE_SECRET);
      const priceId = PRICES[plan]?.[billing];
      if (!priceId) return res.status(400).json({ error: "Invalid plan selected" });

      let customerId;
      const existing = await stripeClient.customers.list({ email, limit: 1 });
      customerId = existing.data.length > 0
        ? existing.data[0].id
        : (await stripeClient.customers.create({ email, name })).id;

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
// Tries all 4 signing secrets since each event destination has its own
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const stripeClient = stripe(STRIPE_SECRET);
  let event = null;

  // Try each secret until one validates
  for (const secret of WEBHOOK_SECRETS) {
    try {
      event = stripeClient.webhooks.constructEvent(req.rawBody, sig, secret);
      break; // Found the right secret
    } catch (err) {
      continue;
    }
  }

  if (!event) {
    console.error("Webhook: no valid signing secret matched");
    return res.status(400).send("Webhook signature verification failed");
  }

  try {
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

      default:
        console.log(`Unhandled event: ${event.type}`);
    }

    return res.json({ received: true });

  } catch (err) {
    console.error("Webhook handler error:", err.message);
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
      return res.status(200).json(doc.exists ? doc.data() : { status: "none", plan: "free" });
    } catch (err) {
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
      await stripe(STRIPE_SECRET).subscriptions.update(doc.data().subscriptionId, {
        cancel_at_period_end: true,
      });
      await db.collection("subscriptions").doc(email).set({
        status: "cancelling",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Could not cancel subscription" });
    }
  });
});

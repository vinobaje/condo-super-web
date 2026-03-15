# Stripe Integration Setup Guide

## Overview
- Embedded Stripe card form (no redirects)
- Firebase Cloud Functions backend
- Firestore stores subscription records
- No raw URLs or errors shown to users

---

## Step 1 — Create Stripe Account
1. Go to https://stripe.com and create an account
2. Complete business verification
3. Go to **Developers → API Keys**
4. Copy your **Publishable key** (pk_live_...) and **Secret key** (sk_live_...)

---

## Step 2 — Create Products in Stripe Dashboard
Go to **Products → Add Product** and create these 3 products with 2 prices each:

| Product      | Monthly Price | Yearly Price (20% off) |
|-------------|---------------|------------------------|
| Starter     | $49.00/month  | $39.20/month ($470.40/year) |
| Professional| $149.00/month | $119.20/month ($1430.40/year) |
| Enterprise  | $249.00/month | $199.20/month ($2390.40/year) |

After creating, copy all 6 **Price IDs** (price_...)

---

## Step 3 — Set Firebase Environment Config
```bash
firebase functions:config:set \
  stripe.secret="sk_live_YOUR_SECRET_KEY" \
  stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET" \
  stripe.prices.starter_monthly="price_STARTER_MONTHLY_ID" \
  stripe.prices.starter_yearly="price_STARTER_YEARLY_ID" \
  stripe.prices.pro_monthly="price_PRO_MONTHLY_ID" \
  stripe.prices.pro_yearly="price_PRO_YEARLY_ID" \
  stripe.prices.ent_monthly="price_ENT_MONTHLY_ID" \
  stripe.prices.ent_yearly="price_ENT_YEARLY_ID"
```

---

## Step 4 — Deploy Cloud Functions
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

After deploy, your function URLs will be:
- https://us-central1-condo-super.cloudfunctions.net/createPaymentIntent
- https://us-central1-condo-super.cloudfunctions.net/stripeWebhook
- https://us-central1-condo-super.cloudfunctions.net/getSubscriptionStatus
- https://us-central1-condo-super.cloudfunctions.net/cancelSubscription

---

## Step 5 — Set Up Stripe Webhook
1. Go to Stripe Dashboard → **Developers → Webhooks**
2. Click **Add endpoint**
3. URL: `https://us-central1-condo-super.cloudfunctions.net/stripeWebhook`
4. Select these events:
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
5. After saving, copy the **Signing secret** (whsec_...)
6. Add it to Firebase config: `firebase functions:config:set stripe.webhook_secret="whsec_..."`
7. Redeploy: `firebase deploy --only functions`

---

## Step 6 — Update index.html with your real keys
In `index.html`, find these two lines and replace with real values:
```js
const STRIPE_PUBLISHABLE_KEY = "pk_live_YOUR_PUBLISHABLE_KEY_HERE";
const FUNCTIONS_URL = "https://us-central1-condo-super.cloudfunctions.net";
```

---

## Step 7 — Deploy the website
```bash
firebase deploy --only hosting
```

---

## Firestore Data Structure
Each subscription is stored at: `subscriptions/{email}`
```json
{
  "customerId": "cus_...",
  "subscriptionId": "sub_...",
  "plan": "starter",
  "billing": "monthly",
  "email": "user@company.com",
  "status": "active",
  "currentPeriodEnd": "2026-04-14T00:00:00Z",
  "updatedAt": "2026-03-14T00:00:00Z"
}
```

Status values: `active`, `payment_failed`, `cancelling`, `cancelled`

---

## Testing with Stripe Test Keys
Use `pk_test_...` and `sk_test_...` keys first.
Test card numbers:
- ✅ Success: `4242 4242 4242 4242`
- ❌ Declined: `4000 0000 0000 0002`
- 🔐 3D Secure: `4000 0025 0000 3155`
Use any future expiry date and any 3-digit CVC.

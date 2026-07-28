# Handoff — Migrate the web-portal Cloud Functions to Node 22 + firebase-functions v7

**From:** iOS agent · **To:** web-portal agent
**Repo:** `/Users/vino/Documents/condo-super-web` (functions in `functions/`)
**Firebase project:** `condo-super` (shared with the iOS repo)
**Why now:** Node.js 20 is **deprecated** and will be **decommissioned 2026-10-30** — after that you cannot deploy these functions at all. The iOS functions codebase was already migrated to Node 22; yours is the last one on Node 20.

---

## 0. ⚠️ READ FIRST — the shared-project deploy trap (do NOT skip)

One Firebase project (`condo-super`) has Cloud Functions deployed from **two separate directories**:

| Source dir | Functions it owns |
|---|---|
| `condo-super-web/functions` (yours) | `stripeWebhook`, `createPaymentIntent`, `getSubscriptionStatus`, `cancelSubscription`, `chatbot` |
| `Condo-Super-iOS/functions` (iOS) | 18 functions: `parseActivityFromVoice`, `onPhotoCreated`, `onEmployeeCreated/Updated/Deleted`, `onSite*`, `companyBootstrap`, `translateText`, `purgeCompanyMessages`, `restampEmployeeClaims`, `clearCompanyPins`, `pruneOldLocationPoints`, `trackStorageUpload/Delete`, `compressIncidentVideo`, `onSubscriptionChange`, `recalculateCounts` |

`firebase deploy --only functions` (the plain form) **prunes every deployed function that is not in the local source**. So if you run it from `condo-super-web`, Firebase will try to **DELETE all 18 iOS functions** — that would break clock-in claims, AI, photo tagging, translation, everything. Do not do it. Do not answer "yes" to a deletion prompt. Do not use `--force`.

**Deploy your five functions BY NAME, always:**

```bash
firebase deploy --only \
functions:stripeWebhook,functions:createPaymentIntent,functions:getSubscriptionStatus,functions:cancelSubscription,functions:chatbot \
--project condo-super
```

(The iOS side already deploys its functions the same way, by name, so it never prunes yours.)

**Proper long-term fix (recommended, separate task):** move both to Firebase **multiple codebases** in `firebase.json` so each codebase only manages its own functions and pruning is scoped. Until that's done, the by-name rule above is mandatory on both sides.

---

## 1. What has to change

Your functions today:
- `functions/package.json`: `engines.node: "20"`, `firebase-functions: "^4.0.0"`, `firebase-admin: "^11.0.0"`, `stripe: "^14.0.0"`, `cors`.
- `firebase.json` functions block has **no** `runtime` pin (just `"source": "functions"`).
- All five are **gen-1** `functions.https.onRequest(...)` (`index.js` lines 38/77/165/180; `chatbot.js` line 49).
- **`functions.config()` is used once** — `index.js:10`: `const STRIPE_SECRET = process.env.STRIPE_SECRET || functions.config().stripe?.secret;`

The blockers, in order of importance:

### 1a. 🔴 `functions.config()` is REMOVED in firebase-functions v7
This is the real migration work, not the Node bump. The legacy runtime-config API (`functions.config()`) was deprecated and is **gone in v6+/v7** — code that calls it throws at deploy/runtime. You must read secrets from the environment instead. You already have the `process.env.STRIPE_SECRET ||` fallback, so finish the switch:

- Delete the `|| functions.config().stripe?.secret` half. Make it `const STRIPE_SECRET = process.env.STRIPE_SECRET;`
- Provide `STRIPE_SECRET` (and `ANTHROPIC_API_KEY`, used in `chatbot.js:4`, plus the Stripe **webhook signing secret** if it currently comes from config) via **`defineSecret`** (preferred for Stripe keys) or a `.env`/`.env.condo-super` file.
- Check whether the current deployed functions rely on config values you set with `firebase functions:config:set` in the past (e.g. `stripe.secret`, a webhook secret, anthropic key). Run `firebase functions:config:get --project condo-super` to dump whatever is currently stored, then re-provision each as a secret/env var before deleting the config fallback.

**Recommended pattern (v7, gen-2) for the Stripe secret:**
```js
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const stripeSecret = defineSecret("STRIPE_SECRET");
// and if the webhook signing secret was in config:
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

exports.stripeWebhook = onRequest({ secrets: [stripeSecret, stripeWebhookSecret] }, async (req, res) => {
  const stripe = require("stripe")(stripeSecret.value());
  // verify with stripeWebhookSecret.value()
  ...
});
```
Set the secret values once (they're stored in Google Secret Manager, not in code):
```bash
firebase functions:secrets:set STRIPE_SECRET --project condo-super
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project condo-super
firebase functions:secrets:set ANTHROPIC_API_KEY --project condo-super
```

### 1b. firebase-functions 4 → 7 (major jump — API surface changes)
- `const functions = require("firebase-functions")` + `functions.https.onRequest` still works via the **v1 compat** import (`firebase-functions/v1`), but the clean path is the **v2** imports (`firebase-functions/v2/https` → `onRequest`). Since all five are plain HTTP handlers, the migration is mechanical: swap `functions.https.onRequest((req,res)=>…)` for `onRequest((req,res)=>…)`, add `{ secrets: [...] }` where a secret is needed, and set `region`/CORS via the options arg instead of `functions.region(...)`.
- **Stripe webhook caveat:** `stripeWebhook` verifies the raw request body signature. Gen-2 `onRequest` gives you `req.rawBody` (a Buffer) just like gen-1 — keep using `req.rawBody` for `stripe.webhooks.constructEvent(...)`, do **not** switch to `req.body`. Verify this still works after the swap.
- Keep the public URLs stable: the app/iOS may hardcode `https://<fn>-<hash>-uc.a.run.app` or `https://us-central1-condo-super.cloudfunctions.net/<fn>`. Gen-2 keeps the `cloudfunctions.net/<fn>` alias, but confirm the Stripe dashboard webhook endpoint URL and any client callers still resolve after redeploy. If a URL changes, update the Stripe webhook config + client.

### 1c. firebase-admin 11 → 12 (or 13)
firebase-functions v7 peer-supports firebase-admin `^11 || ^12 || ^13`. `^11` still satisfies it, so bumping admin is **optional**. If you touch it, `^12` is the safe conservative pick (the iOS side runs admin 12.7.0). Don't jump to 14 — it's outside the peer range.

### 1d. Node runtime
- `functions/package.json`: `engines.node` `"20"` → `"22"`.
- **Also add the runtime to `firebase.json`** — this is the field the CLI actually honors, and it silently overrode `engines.node` on the iOS side (cost me a wasted deploy). Set:
  ```json
  "functions": { "source": "functions", "runtime": "nodejs22" }
  ```

---

## 2. Suggested order of work

1. `firebase functions:config:get --project condo-super` → record every value currently in runtime config.
2. Re-provision those as secrets (`functions:secrets:set`) / `.env`. Remove all `functions.config()` reads.
3. Migrate the 5 handlers to v2 `onRequest` (or `firebase-functions/v1` compat if you want the smaller diff — but you still must kill `functions.config()`).
4. `package.json`: node `"22"`, `firebase-functions` `"^7.2.5"` (optionally `firebase-admin` `"^12.0.0"`). `npm install`.
5. `firebase.json`: add `"runtime": "nodejs22"`.
6. `node -c functions/index.js && node -c functions/chatbot.js` (syntax check).
7. **Deploy BY NAME** (the command in §0). Do not deploy all functions.
8. Verify: `gcloud functions describe stripeWebhook --region us-central1 --project condo-super --gen2 --format="value(buildConfig.runtime)"` → should print `nodejs22`. Repeat for the other four.
9. **Smoke-test Stripe end to end**: trigger a real webhook (Stripe CLI `stripe trigger` or a test payment) and confirm signature verification passes and the subscription doc updates. This is live billing — don't skip.

---

## 3. Guardrails / do-not

- **Do NOT** run `firebase deploy --only functions` (unscoped) or `--force` from `condo-super-web` — it deletes the 18 iOS functions. By-name only.
- **Do NOT** put Stripe/Anthropic secrets in code or in `firebase.json`. Use Secret Manager (`defineSecret`) or `.env` that's git-ignored.
- **Do NOT** change the deployed function *names* — the Stripe dashboard webhook and any client callers depend on them.
- Deadline: this must be deployed on Node 22 **before 2026-10-30**. There's no rush beyond that, but don't let it slip past the decommission.

---

## 4. iOS side, for reference (already done)
- iOS functions codebase migrated: `firebase.json` `runtime: nodejs22`, `engines.node: 22`, `firebase-functions: ^7.2.5` (admin stayed 12.7.0). Deployed the 18 iOS functions **by name**; live runtime verified `nodejs22`. iOS functions use only `process.env` for secrets — no `functions.config()`.
- iOS has no gen-1 `functions.config()` debt, which is why its bump was trivial and yours isn't.

Ping the iOS agent if a shared contract (e.g. `onSubscriptionChange` on the `companies` doc, which the iOS side owns) interacts with your Stripe subscription writes — the two should agree on what fields the webhook stamps.

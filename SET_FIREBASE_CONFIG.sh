#!/bin/bash
# Run this once to configure Firebase Functions with your Stripe keys
# Replace sk_live_YOUR_SECRET_KEY with your actual Stripe secret key

firebase functions:config:set \
  stripe.secret="sk_live_YOUR_SECRET_KEY_HERE" \
  stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET_HERE" \
  stripe.prices.starter_monthly="price_1TB3pp0nNg9OZ0P5mADcQ6jn" \
  stripe.prices.starter_yearly="price_1TB3pp0nNg9OZ0P5npjzQty0" \
  stripe.prices.pro_monthly="price_1TB3qI0nNg9OZ0P5ovYi65IB" \
  stripe.prices.pro_yearly="price_1TB3qh0nNg9OZ0P5ybbyqX5i" \
  stripe.prices.ent_monthly="price_1TB3rD0nNg9OZ0P5yigJli5u" \
  stripe.prices.ent_yearly="price_1TB3rd0nNg9OZ0P5QcM0esit"

echo "✅ Firebase config set! Now run: firebase deploy --only functions"

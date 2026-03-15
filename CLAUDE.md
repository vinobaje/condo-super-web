# Condo Super — Marketing Website

## Project Overview
Marketing website for **Condo Super** — the all-in-one employee management app for property managers by **Stoney Creek Property Maintenance Inc.**

---

## Repository
- **GitHub**: https://github.com/vinobaje/condo-super-web
- **Branch**: `main`
- **File**: `index.html` (single self-contained HTML file, ~3MB with all images embedded as base64)
- **GitHub Pages URL**: https://vinobaje.github.io/condo-super-web (enable in repo Settings → Pages → main / root)

---

## App Store Links
- **iOS App Store**: https://apps.apple.com/ca/app/condo-super/id6756904817
- **Google Play**: https://play.google.com/store/apps/details?id=com.condosuper.app
- **App ID (iOS)**: `id6756904817`
- **Bundle ID (Android)**: `com.condosuper.app`

## QR Codes (stored in uploads)
- `qr_corp_ios.png` → links to iOS App Store
- `qr_corp_android.png` → links to Google Play

---

## Color Theme (matches original condosuper.app)
```css
--orange:       #FF5722   /* primary CTA, logo "Super", headings accent */
--orange-hover: #E64A19
--orange-light: #FFF3EE   /* tag backgrounds */
--navy:         #1a1a2e   /* text, secondary buttons, footer, CTA bg */
--navy-dark:    #111122   /* footer */
--bg:           #F5F5F0   /* page background */
--bg-alt:       #FAFAF5   /* web platform section */
--border:       #EEEEEA
--hero-phone:   linear-gradient(145deg, #7C6FCD, #9B8FE8)  /* purple phone card */
```

## Typography
- **Headings**: `Playfair Display` (700, 800) — Google Fonts
- **Body**: `Inter` (400, 500, 600) — system font stack

---

## Website Sections (in order)

### 1. Nav
- Logo: `Condo` (navy) + `Super` (orange) in Playfair Display
- Links: Features, Web Platform, Security, Pricing, Support
- CTA button: "Download iOS" → links to App Store

### 2. Hero
- Headline: "Employee Management, **Simplified**" (Simplified in orange)
- Subtext: The all-in-one app for property managers
- Buttons: Download for iOS (orange) + Learn More (navy)
- Right side: Purple phone mockup card showing team dashboard UI (built with HTML/CSS, NOT a screenshot)

### 3. Stats Bar
- 5,173+ Photos documented
- 251+ Shifts tracked
- 2,813+ Hours logged
- 98% On-time rate

### 4. Features (8 sections, alternating left/right layout)

| # | Feature | Screenshot File | Background Color |
|---|---------|----------------|-----------------|
| 1 | GPS Time Tracking | `ss_hours.png` | `#E8F0FF` |
| 2 | Live Location & Tracking | `Tracking.png` | `#D1FAE5` |
| 3 | Photo & Video Documentation | `ss_capture2.png` | `#EDE9FF` |
| 4 | Team Messaging | `ss_capture7.png` | `#FEE2E2` |
| 5 | Task Management | `Tasks.png` | `#FEF3C7` |
| 6 | Reports & Analytics | `ss_capture3.png` + `ss_capture4.png` | `#CFFAFE` |
| 7 | Voice-Powered Activity Logging | `Voice-Powered_Activity_Logging.png` | `#DCFCE7` |
| 8 | Safety & Incident Reporting | `Incedent.png` | `#FEE2E2` |

### 5. Web Platform Section
Web dashboard screenshots in browser frames (macOS style with traffic light dots):
- `Screenshot_2026-03-14_at_7_08_32_PM.png` — Web Dashboard
- `Screenshot_2026-03-14_at_7_10_30_PM.png` — Activity Tracker
- `Screenshot_2026-03-14_at_7_11_05_PM.png` — Time Cards
- `Screenshot_2026-03-14_at_7_10_20_PM.png` — Photos Feed
- `Screenshot_2026-03-14_at_7_11_38_PM.png` — Reports
- `weekly_report.png` — Weekly Highlights PDF preview

### 6. Security
Dark navy section (`#1a1a2e`) with 8 cards:
- Secure Data Transmission (HTTPS/TLS)
- Biometric Authentication (Face ID & Touch ID)
- iOS Keychain Integration
- Firebase Cloud Infrastructure
- Role-Based Access Control (Owner/Admin/Manager/Employee)
- Geofencing Protection
- Achievements & Streaks
- Company Management

### 7. Pricing
4-column dark-card grid with monthly/yearly toggle (20% yearly discount):

| Plan | Monthly | Employees | Sites | Storage | Video |
|------|---------|-----------|-------|---------|-------|
| Free | $0.00 | 5 | 2 | 1 GB | None |
| Starter | $49.00 | 15 | 5 | 10 GB | None |
| Professional | $149.00 | 50 | 20 | 50 GB | Medium |
| Enterprise | $249.00 | Unlimited | Unlimited | 500 GB | High |

**Feature matrix per plan:**
- Free: ✗ Photo Upload, ✗ Video Upload, ✓ Map View, ✓ Scheduling, ✗ Reports & Analytics, ✗ Budget Management, ✗ Priority Support, ✗ Data Export
- Starter: ✓ Photo Upload, ✗ Video Upload, ✓ Map View, ✓ Scheduling, ✗ Reports & Analytics, ✗ Budget Management, ✗ Priority Support, ✓ Data Export
- Professional: ✓ All features
- Enterprise: ✓ All features

**Yearly prices (20% off):**
- Starter: $39.20/mo
- Professional: $119.20/mo
- Enterprise: $199.20/mo

### 8. CTA Section
Dark navy background with:
- Both QR codes side by side (iOS left, Android right)
- App Store + Google Play buttons under each QR code

### 9. Footer
Dark (`#111122`) with columns: Product | Support | Legal
- Footer has compact App Store + Google Play buttons

---

## Screenshot Inventory (all uploads)

### iOS App Screenshots
| File | Content |
|------|---------|
| `ss_capture1.png` | Time Clock (big timer, Clock In button) |
| `ss_capture2.png` | Photos Feed (boiler pressure gauge) |
| `ss_capture3.png` | Reports dashboard (5173 photos, 251 shifts) |
| `ss_capture4.png` | Activities list (Weekly Report, activity entries) |
| `ss_capture5.png` | Weekly PDF Report preview |
| `ss_capture6.png` | Voice Input mic screen |
| `ss_capture7.png` | Messages (Channels, Site Chats, DMs) |
| `ss_capture8.png` | Profile/Settings (Vino, Owner) |
| `ss_capture9.png` | Tasks list |
| `ss_capture10.png` | iOS Dashboard (Good Evening Vino) |
| `ss_hours.png` | Hours screen (27h 15m, shifts, tracking points) |
| `sim_check2.png` | iOS Dashboard (Team Status LIVE) |
| `Tracking.png` | Tracking Details (Apple Maps, 13 GPS waypoints, 562m) |
| `Tasks.png` | Tasks list screen |
| `Voice-Powered_Activity_Logging.png` | Voice Input (Describe Your Activity) |
| `Incedent.png` | Report Incident form (9 incident types) |
| `weekly_report.png` | Weekly Highlights Report PDF |

### Web Dashboard Screenshots
| File | Content |
|------|---------|
| `Screenshot_2026-03-14_at_7_08_32_PM.png` | Web Dashboard |
| `Screenshot_2026-03-14_at_7_10_20_PM.png` | Web Photos Feed |
| `Screenshot_2026-03-14_at_7_10_30_PM.png` | Activity Tracker |
| `Screenshot_2026-03-14_at_7_11_05_PM.png` | Time Cards |
| `Screenshot_2026-03-14_at_7_11_38_PM.png` | Web Reports |
| `Screenshot_2026-03-14_at_7_12_15_PM.png` | Daily Activity Report |

### Pricing Screenshots
| File | Content |
|------|---------|
| `Screenshot_2026-03-14_at_8_00_00_PM.png` | Free + Starter plans |
| `Screenshot_2026-03-14_at_8_00_19_PM.png` | Professional + Enterprise plans |
| `Screenshot_2026-03-14_at_8_00_35_PM.png` | Starter plan detail |

---

## Technical Notes

### File Structure
```
index.html          ← entire site, single file, ~3MB
                      all images embedded as base64 data URIs
                      no external dependencies except Google Fonts
```

### Key CSS Classes
```css
.fblock             /* feature section card (grid 1fr 1fr) */
.ftext              /* text side of feature block */
.fvis               /* visual/screenshot side — identified by background color */
.fphone             /* phone screenshot img tag */
.hero-phone-device  /* purple hero phone card */
.stats-bar          /* 4-column stats row */
.wframe             /* web browser screenshot frame */
.pricing-g          /* 4-column pricing grid */
```

### Updating Screenshots
Each feature's screenshot is in a `.fvis` div identified by its **background color**:
```python
# Map of section → background color → correct image
'E8F0FF' → GPS Time Tracking     → ss_hours.png
'D1FAE5' → Live Location          → Tracking.png
'EDE9FF' → Photo & Video          → ss_capture2.png
'FEE2E2' → Team Messaging         → ss_capture7.png  (also used for Incident)
'FEF3C7' → Task Management        → Tasks.png
'CFFAFE' → Reports & Analytics    → ss_capture3.png + ss_capture4.png (two phones)
'DCFCE7' → Voice Logging          → Voice-Powered_Activity_Logging.png
```

To replace a screenshot:
```python
import base64, re

with open('new_screenshot.png', 'rb') as f:
    new_b64 = f"data:image/png;base64,{base64.b64encode(f.read()).decode()}"

with open('index.html', 'r') as f:
    html = f.read()

pattern = r'(class="fvis" style="background:#BGCOLOR">)\s*(<img src=")data:image/png;base64,[A-Za-z0-9+/=]+(")([^>]*)(>)'
html = re.sub(pattern, rf'\1\n      \2{new_b64}\3\4\5', html, count=1)

with open('index.html', 'w') as f:
    f.write(html)
```

### Deploying Updates
```bash
cd /path/to/condo-super-web
git add index.html
git commit -m "Update: description of change"
git push https://TOKEN@github.com/vinobaje/condo-super-web.git main
```

---

## Business Info
- **Company**: Stoney Creek Property Maintenance Inc.
- **Owner**: Vino
- **App**: Condo Super — iOS live on App Store, Android on Google Play
- **Website**: https://condosuper.app
- **Privacy Policy**: https://condosuper.app/privacy.html
- **Terms of Service**: https://condosuper.app/terms.html
- **Support**: https://condosuper.app/support.html

---

## Links Referenced in Site
- App Store: https://apps.apple.com/ca/app/condo-super/id6756904817
- Google Play: https://play.google.com/store/apps/details?id=com.condosuper.app
- Support: https://condosuper.app/support.html
- FAQ: https://condosuper.app/support.html#faq
- Contact: https://condosuper.app/support.html#contact
- Privacy: https://condosuper.app/privacy.html
- Terms: https://condosuper.app/terms.html

---

## Stripe Integration
- **Type**: Embedded payment form (Stripe Elements — no redirects)
- **Backend**: Firebase Cloud Functions (`functions/index.js`)
- **Setup guide**: `STRIPE_SETUP.md`
- **Keys to replace in index.html**:
  - `pk_live_YOUR_PUBLISHABLE_KEY_HERE` → your Stripe publishable key
  - `https://us-central1-condo-super.cloudfunctions.net` → already correct for condo-super project
- **Cloud Functions**:
  - `createPaymentIntent` — creates Stripe subscription, returns clientSecret
  - `stripeWebhook` — handles Stripe events, updates Firestore
  - `getSubscriptionStatus` — checks if email has active subscription
  - `cancelSubscription` — cancels at period end
- **Firestore collection**: `subscriptions/{email}`

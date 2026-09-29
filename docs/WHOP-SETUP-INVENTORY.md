# Supervised Intera setup — 2026-09-29

| Environment | Company | Observed state |
|---|---|---|
| Production | `biz_LwVKDimC5UMz8L` | Separate Intera business created at owner's request. Owner completed Wallet terms screen. Product catalog empty. No selling configured. |
| Sandbox | `biz_h0oHPrW1jIOTK9` | Owner signed in separately. Separate Intera test business created. Product catalog initially empty. |

Production dashboard: https://whop.com/dashboard/biz_LwVKDimC5UMz8L/

Sandbox dashboard: https://sandbox.whop.com/dashboard/biz_h0oHPrW1jIOTK9/

## Configured in sandbox

| Resource | ID / observed setting |
|---|---|
| Recurring product | `prod_SpeuWupWgIlZZ`, Intera, Hidden, not on Discover |
| Extra-time product | `prod_JXwU09cMQiMUY`, Intera - Extra time, Hidden, not on Discover |
| Essential | USD 19 every 30 days, 10 hours per paid period |
| Professional | USD 49 every 30 days, 50 hours per paid period |
| Intensive | USD 99 every 30 days, 150 hours per paid period |
| Extra time | USD 15 one-time, 10 additional hours |

Recurring periods were entered as custom 30-day cycles; dashboard summary wording sometimes renders per-month wording. Initial fee zero, provider trials/installments/discounts off. Plan IDs and all settings still require API validation before use. No apps, communities, courses, affiliates or shipping enabled. Original Intera artwork uploaded and saved on both products; cover crops visually inspected. Product logo upload remains pending.

The scoped sandbox API-key form is prepared, not yet confirmed created: API version `2025-01-01`, expiry 2026-10-29 00:00 UTC, eight permissions (checkout configuration read/create/delete; member basic read; payment basic/dispute read; plan basic read; company basic read). Owner must complete credential creation and save through the masked local helper. Do not inspect or capture the resulting secret in screenshots.

## Not configured / not verified

Plan IDs are not yet recorded or allowlisted. Tax-exclusive collection and the selected tax arrangement are not yet verified. No reachable webhook endpoint, webhook ID or webhook signing secret configured. Required webhook contract remains `api_version=v1`, `api_version_date=2025-01-01`, company envelope matching this adapter. No delivery test or actual sandbox checkout has run. Hidden sandbox products are configured test offers, not evidence of canonical fulfillment or production readiness.

Production product catalog was observed empty. No production offers published or real charges submitted. Merchant review for the disclosed professional/medical interpreter-assistance use case, Bosnia and Herzegovina payout onboarding, tax arrangement, signing and live deployment remain unverified. Wallet terms completion is not merchant approval. No unconfirmed contact, legal identity, domain, testimonial or download link was published.

Do not reuse either unrelated business previously visible in the account. Reopen these exact company IDs on retries; never create another Intera business merely because the browser was interrupted.

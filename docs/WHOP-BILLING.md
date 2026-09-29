# Intera billing with Whop

Implementation review: 29 September 2026. **Sandbox integration candidate; paid production release is blocked.**

The starting repository contained the Phase 1 desktop reader and personal Soniox-key integration. It did not contain an account backend, allowance ledger, or Lemon Squeezy implementation. This change adds those billing foundations and selects Whop. It does not claim the whole attached Phase 2 desktop redesign is complete.

## Catalog and account boundary

| Offer | Base USD price | Streaming allowance | Expiry |
| --- | ---: | ---: | --- |
| Verified-account trial | Free | 30 minutes once | 14 days after first account creation |
| Essential | $19 recurring | 10 hours | Paid period end |
| Professional | $49 recurring | 50 hours | Paid period end |
| Intensive | $99 recurring | 150 hours | Paid period end |
| Extra time | $15 explicit one-time purchase | 10 hours | No expiry |

Whop's documented billing interval is in days. The adapter currently validates a **30-day recurring interval**, and the UI says “every 30 days.” Confirm this commercial wording before launch; it is not a calendar-month anniversary implementation. All tiers retain the same translation profiles and quality. The trial is an Intera grant, not a paid Whop trial. Extra-time checkout requires a currently active, previously paid subscription; existing purchased time survives cancellation.

Supabase email OTP authenticates the internal account. The server verifies the access token with `auth.getUser`, checks confirmed email, and checks the corresponding `auth.sessions` row. The billing-account UUID is generated internally and has a unique authenticated-user foreign key. Email is never used to match a Whop purchase. Auth tokens stay in Electron's main process and encrypted OS storage; the renderer receives only account display data.

Checkout accepts an offer name and request UUID, never client prices, arbitrary plan IDs, URLs, or metadata. Server configuration allowlists four distinct Whop plan IDs. Before creating checkout, the adapter checks the seller, price, currency, recurrence, absence of trial/installments/adaptive pricing, and tax settings against the catalog. Recurring plans use zero initial fee plus the recurring price; do not configure both as $19/$49/$99.

Only these metadata keys go to Whop:

- `intera_billing_account_id`
- `intera_checkout_intent_id`
- `intera_environment`
- `intera_catalog`

No audio, transcripts, session text, patient details, terminology, medical context, or account email is attached. Whop collects its own customer/payment details on hosted checkout.

## Payment and allowance flow

1. An authenticated desktop request creates a durable checkout intent before the remote request. Retries return the same link. An uncertain remote result remains pending for operator review instead of automatically creating another checkout.
2. Whop returns a hosted `purchase_url`; Electron validates the host and opens it in the system browser. Neither the return page nor a query parameter grants anything.
3. The webhook endpoint verifies the original raw body with `@whop/sdk@2.0.0`'s `unwrapWebhook` helper, the `ws_` secret and Standard Webhooks timestamp checks. It validates the company, persists a minimal job, and only then acknowledges receipt. Raw provider payloads are not stored or logged.
4. A worker retrieves canonical payment and membership records. A database lock covers the read/apply sequence across processes, avoiding a stale concurrent response overwriting a newer one. Payment ownership must match a stored checkout intent or an already established membership binding.
5. A successful paid record creates one grant per payment and, for subscriptions, one grant per membership-period start. Unknown plans, wrong currency/prices, ambiguous ownership, and unsupported billing reasons do not receive credit. Current-period matching checks both payment creation and paid timestamps. Old payments cannot create today's allowance.
6. Confirmed checkout configurations are deleted through Whop's documented endpoint so their URLs cannot be reused. Failed retirement retries safely. A duplicate charge racing retirement is quarantined for review, never credited twice.
7. Refunds append proportional millisecond reversals using integer money arithmetic and a cumulative high-water mark. Full refunds, adverse disputes and transfers block affected credit. Refunds do not rely on Whop automatically canceling membership. Already consumed time is not silently moved onto another grant; excess refund debit stays on its original bucket, whose spendable balance is clamped at zero.

Balances come from append-only grants and entries, not membership flags. Expiring balances are consumed first. `consume` is an internal transactional boundary for authoritative usage; it is not a client-callable endpoint. Database triggers reject ledger updates/deletes. All billing tables are in a non-exposed private schema with RLS and no anonymous/authenticated access. Use a dedicated server database credential; never ship it in Electron.

**Managed Soniox streaming is not implemented by this change.** There is no company-token issuance endpoint, and `managedStreamingAvailable` is explicitly false. The current BYOK Soniox flow remains unchanged. This prevents a payment from unlocking unmetered company streaming, but also means paid balances cannot yet be used for managed sessions. A production release requires authoritative Soniox metering/reconciliation, reservations, one active stream per account, crash recovery, and hard duration caps. This is a release blocker, not an exercised feature.

## Renewals, cancellation, transfers and recovery

Failed or pending payments grant no new time. Canonical membership state appears separately from remaining allowance. Cancellation at period end preserves already paid period credit until its expiry; extra-time credit stays available. The application does not automatically charge for extra time.

Manage subscription retrieves the stored membership server-side, checks current owner, and opens Whop's returned `manage_url`. It does not construct a guessed portal URL or trust an arbitrary membership ID from another account.

Whop allows membership transfers in its portal. The first verified purchase binds a Whop user ID to exactly one internal billing account. Later owner mismatch creates **sticky quarantine**, suspending the old membership's credit and denying its portal action. It never automatically binds the transferred purchase to the destination account, and transferring back does not silently restore credit. Verified support relinking is not implemented; support must verify both identities, preserve one ownership binding and unspent balance, and audit any explicit compensating entries before recovery. Never relink by matching emails or edit/delete historical ledger rows.

There is no documented dedicated transfer event in the subscribed set used here. Membership events, canonical refreshes and a five-minute sweep detect ownership changes. Since there is no automatic destination activation, a transferred purchase cannot activate two Intera accounts through this implementation. **Actual Whop transfer behavior and field preservation still require sandbox verification.**

The sweep scans all payment pages and known memberships, recovering missed payments and old refunds. Failed jobs retain retry state with backoff. `private.billing_reviews` records unlinked, quarantined and paid-without-eligible-grant cases using IDs only. Monitor oldest pending job, repeated failures, failed sweeps, review rows and incomplete checkout intents. Full scans and a global billing lock favor correctness over scale; replace them with measured incremental scheduling before high-volume operation.

Unsupported or uncertain cases remain withheld: historical paid periods not represented by current membership boundaries, prorated plan updates, discounts, ambiguous checkout creation, cross-currency pricing and automatic transfer relinking. Resolve with verified provider records and audited adjustments/refunds; do not guess a grant. Disable self-service plan switching, discounts and Whop trials until their accounting is implemented and tested.

## Explicit tax selection and launch gates

Selected arrangement: **Whop collects and remits tax**, with **tax-exclusive prices**. The code requires `WHOP_TAX_ARRANGEMENT=whop_collects_and_remits` and `WHOP_TAX_BEHAVIOR=exclusive`, and validates plan collection flags. These values do **not** configure the merchant dashboard by themselves.

Whop documents direct-sale remittance coverage for the US, EU and UK. Other locations, seller obligations and tax classification still require review; this is not a blanket worldwide merchant-of-record assumption. The actual dashboard selection and relevant registrations/coverage have not been verified. [Whop tax options](https://docs.whop.com/payments-and-billing/fees/taxes).

Production checkout defaults off and additionally requires evidence references for merchant approval, Bosnia and Herzegovina payouts, tax setup, sandbox results and managed-metering release. A database environment/company marker rejects accidental reuse of a sandbox database in production. Use separate Supabase projects, database credentials, plans, webhook endpoints/secrets and Whop keys.

Whop's payout-country list includes Bosnia and Herzegovina, but the merchant's identity, entity, bank, supported payout method and completed onboarding remain unverified. A country listing is not successful merchant onboarding. [Payout setup](https://docs.whop.com/manage-your-business/manage-payouts/set-up-payouts).

Submit the disclosed interpreter-assistance use case for merchant review, including possible professional/medical interpreting contexts. Do not label it generic unrelated software to avoid review. Whop retains approval discretion. [Prohibited/restricted businesses](https://docs.whop.com/trust-and-safety/trust-safety-overview/what-is-not-allowed-on-whop).

## Current API evidence

Reviewed 29 September 2026:

- [Create checkout configuration](https://docs.whop.com/api-reference/checkout-configurations/create-checkout-configuration): metadata inheritance and hosted purchase URL.
- [Delete checkout configuration](https://docs.whop.com/api-reference/beta/checkout-configurations/delete-a-checkout-configuration): retire a used checkout link.
- [Webhooks](https://docs.whop.com/developer/guides/webhooks): raw-body verification, five-minute timestamp tolerance, at-least-once unordered delivery, testing and recovery.
- [API versioning](https://docs.whop.com/developer/api/versioning): explicit compatibility pin `2025-01-01` for payment/membership/checkout reads; current `2026-09-29` for variants, payment listing and checkout retirement. This avoids the newer membership shape omitting `manage_url` and both period boundaries. SDK generated types are not substituted for the pinned runtime validators.
- [Membership retrieval](https://docs.whop.com/api-reference/memberships/retrieve-membership), [payment retrieval](https://docs.whop.com/api-reference/payments/retrieve-payment), [current payment listing](https://docs.whop.com/api-reference/beta/payments/list-payments).
- [Billing portal](https://docs.whop.com/payments-and-billing/manage-billing/billing-portal), [membership transfer](https://docs.whop.com/memberships-and-access/accessing-your-purchase/transfer-a-membership).
- [Supabase OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [verified user retrieval](https://supabase.com/docs/reference/javascript/auth-getuser).

These documentation checks support the adapter design. They are not evidence of successful external payments, merchant approval or deployed authentication.

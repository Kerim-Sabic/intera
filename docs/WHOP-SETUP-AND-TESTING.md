# Sandbox setup and release checklist

No production deployment, live charge, merchant registration, tax-dashboard change or payout submission was performed by this change.

## Run locally

1. Install using the root lockfile: `npm ci`. The backend is run from this checkout with development dependencies installed; `npm ci --omit=dev` is not a supported server installation. Desktop packaging excludes `server/`, `supabase/`, `.env` files and development dependencies.
2. Start your local Supabase stack or use a dedicated sandbox project. Review and apply `supabase/migrations/20260929161033_whop_billing.sql` using the Supabase CLI. The full Docker stack was not available in the implementation environment; the migration was exercised in PGlite PostgreSQL tests with an auth-table fixture.
3. Configure email confirmation and OTP templates from `supabase/templates/otp.html`, including both confirmation and magic-link templates. Configure real SMTP and abuse controls in the hosted project. Never collect sign-in codes in developer chat.
4. Copy `server/.env.example` to an ignored file and populate it through your local secret manager or deployment environment. Set `NODE_OPTIONS=--env-file=server/.env` when using Node's env-file support, or supply process environment variables directly. Run `npm run server:check`, then `npm run server`. Do not put secrets in command-line arguments, source files or screenshots.
5. Put the service behind HTTPS, with request/body/rate limits and private database access. The default listener is loopback port 8787. `/health` only checks process availability; monitor database, jobs, reconciliation and review rows separately.
6. Set desktop public configuration: `INTERA_BILLING_URL`, `INTERA_SUPABASE_URL`, `INTERA_SUPABASE_PUBLISHABLE_KEY`. Both URLs must be HTTPS. These are runtime main-process settings; there is no account service configured in the distributed Phase 1 installers. Use `npm run dev` for this source build.
7. Set `BILLING_SALES_ENABLED=true` only in the sandbox to exercise checkout. The return URL should serve a neutral “Return to Intera and refresh” page; it must never call a grant endpoint. There is no grant-from-redirect endpoint in this server.

Create the four sandbox variants with the prices in WHOP-BILLING.md. Their IDs still use `plan_`. Use 30-day recurrence, zero initial fee for recurring plans, USD, tax-exclusive collection, no discounts/trials/installments/adaptive pricing. Extra time is one-time, $15, no expiry. Configure the selected tax arrangement in the account dashboard and verify it independently; the server cannot infer the merchant arrangement from plan tax flags alone.

Create a webhook with `api_version=v1` and **`api_version_date=2025-01-01`**. Its envelope uses `company_id`. Subscribe to payment succeeded/failed/pending/requires-action, membership activated/deactivated/cancel-at-period-end-changed, refund created/updated and dispute created/updated events. Store the endpoint's `ws_` secret verbatim. Incorrect version/company/signature is rejected. Whop's company key stays on the server. Grant only the documented read/checkout/webhook permissions needed; do not use a personal all-business key.

## External tests — still required

Use Whop's separate [sandbox](https://docs.whop.com/developer/guides/sandbox) and fake cards, never a production card or live checkout. Sandbox API base is `https://sandbox-api.whop.com/api/v1`; the browser host is `sandbox.whop.com`.

| Scenario | Documented facility / action | Required assertion |
| --- | --- | --- |
| Successful subscription and extra time | `4242 4242 4242 4242` | Correct internal account; one grant; checkout retired; extra purchase explicit |
| Decline | `4000 0000 0000 0002` | No allowance, usable failure status |
| Renewal failure | `4000 0000 0000 0341` | No new period grant; old credit expires correctly |
| 3-D Secure | `5385 3083 6013 5181` | No grant until canonical success |
| Synthetic webhook delivery | Dashboard test menu or `POST /webhooks/{id}/test` | Valid signature, durable receipt and observable delivery result |
| Duplicate / reordered delivery | Redeliver the same event, then older events | One grant / cumulative refund only |
| Refunds | Partial then full sandbox refund | Exact proportional reversal; do not rely on membership cancellation |
| Cancellation | Whop customer portal | Cancellation state separate from remaining purchased time |
| Transfer | Two real sandbox Whop users | Old binding quarantined, portal denied, no destination double activation |
| Missed delivery | Temporarily disable endpoint, then reconcile | Recover authoritative records without granting the wrong current period |
| Auth isolation | Two Supabase users; revoked/deleted session | No cross-account reads, checkout, portal or grants |

The sandbox webhook test helper is `npm run server:check -- --send-webhook-test`, with `WHOP_TEST_WEBHOOK_ID=hook_…`. It is hard-limited to sandbox. A successful test-dispatch HTTP response proves dispatch only; inspect the dashboard delivery result and internal job state. Synthetic test events may reference sample payments that cannot be canonically retrieved; they must never manufacture allowance. Complete a real sandbox checkout to verify fulfillment.

Inspect durable jobs and review cases through an authorized server-side database connection:

```sql
select id,event_type,attempts,next_attempt_at from private.webhook_jobs where not done;
select payment_id,reason,checked_at from private.billing_reviews;
select id,offer,provider_id,payment_id,retired from private.checkout_intents order by created_at desc;
```

Review records are an audit queue; successful later reconciliation does not erase their history. For an uncertain checkout, find the configuration using its internal intent metadata, bind the verified provider ID to the existing intent, or retire the confirmed-unused configuration before authorizing a new attempt. Never clear a pending intent merely because a client timed out. Operations tooling for this recovery is not yet built.

## Production gates — all currently unverified

- Written Whop merchant approval for Intera's disclosed interpreter-assistance use, including professional/medical contexts where applicable.
- Successful merchant identity/entity verification and Bosnia and Herzegovina bank/payout onboarding, including the actual available method. Whop lists the country, but this merchant has not completed verification here.
- Actual dashboard selection of “Whop collects and remits tax,” product classification, tax-exclusive display, and seller handling/restrictions outside covered jurisdictions.
- Completed external sandbox matrix with saved evidence and API-version/permission compatibility.
- Hosted Supabase auth/SMTP, session revocation checks, database migration, RLS/advisors, rate limiting, monitoring, backup/restore and retention/deletion procedures.
- Authoritative managed Soniox credential/usage accounting, one active stream, duration caps and interruption recovery. No company streaming is enabled by this change.
- Verified support process for transfer/plan-change quarantine, late-period payments, duplicate charges and uncertain checkout recovery.
- Separate production resources and credentials; signed desktop builds configured with the correct public service endpoints. Existing output installers are still Phase 1.

Record evidence references in the corresponding `WHOP_*_REFERENCE` and `MANAGED_METERING_RELEASE_REFERENCE` variables. These gates are configuration checks, not a claim that setting an environment variable obtains regulatory, payment-provider or tax approval.

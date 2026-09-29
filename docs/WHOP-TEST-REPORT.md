# Whop integration test report

Date: 29 September 2026. Platform: Windows 11 x64, Node 22.18.0.

## Completed locally

| Check | Result |
| --- | --- |
| TypeScript check | PASS |
| ESLint | PASS |
| Unit/database suite | PASS — 59 tests in 6 files: 34 existing, 25 new billing tests |
| Desktop build | PASS |
| Windows Electron UI suite | PASS — 3 tests |
| SQL migration | PASS in PGlite PostgreSQL with `auth.users` test fixture |
| Private schema access / RLS | PASS — anonymous/authenticated direct access denied; RLS enabled |
| Ledger immutability | PASS — update/delete protection exercised |
| External sandbox preflight | NOT RUN — required credentials/configuration absent; helper reports this explicitly |
| Desktop dependency audit (`--omit=dev`) | 0 reported vulnerabilities; this does not cover the server/toolchain or all bundled dev dependencies |

Billing tests cover: fixed trial expiry; checkout retry/uncertainty; no checkout/redirect grants; payment and paid-period idempotency; delayed historical payments; failed renewal and successful retry; internal account ownership; transfers before and after delivery; changed canonical buyer; one Whop user per internal account; cumulative refunds; explicit extra purchases and survival after cancellation; expiration-first usage and quota denial; private access; signed webhook duplicate/tamper/stale timestamp; durable retry; canonical sweep recovery; HTTP authentication and strict request schemas; allowlisted checkout metadata/API pins; decimal money; trusted URLs; separate environment databases; production gates; used-checkout retirement.

The Windows UI checks exercise preferences across restart, profiles, the simulated conversation, hold, compact view, clear, and the new Account panel in its actual **unconfigured** state. `test-results/screenshots/whop-account-unconfigured.png` is a genuine screenshot of this build, not a mockup or evidence of a successful payment. Existing Soniox live capture behavior was not changed.

## Not verified

- Real Whop sandbox checkout, signature delivery, cancellation/refund/transfer behavior and API permissions/pins against this merchant account.
- Supabase-hosted email OTP, production session revocation, SMTP, hosted migration/advisors and multi-process PostgreSQL contention under load. PGlite is not a hosted Supabase deployment.
- Merchant approval for the disclosed interpreter-assistance use case, actual Bosnia and Herzegovina payout onboarding, or dashboard tax configuration.
- Managed Soniox streaming and authoritative usage accounting: no company credentials or managed-session endpoint are released.
- This revision's macOS native UI/audio, signed installers or production deployment. CI builds, when run, are unsigned packaging evidence only.

Known remaining operational work: audited transfer relinking; uncertain checkout recovery tooling; historical/prorated payment adjustments; dashboard policy restrictions for unsupported plan switching/discounts; monitoring and queue/review alerts; database retention/account deletion policy; high-volume reconciliation optimization.

Existing installers in the workspace outputs remain the earlier Phase 1 build. This change is source code and a tested local desktop build, not a replacement paid-production installer.

# Intera managed beta evidence — 2026-09-29

This is an implementation milestone, not a completed live managed beta or a public release. Version `0.2.0-beta.1`, branch `codex/managed-beta`, based on the existing Whop work. Production sales and public managed admission remain disabled.

## IMPLEMENTED

Chronological A→B→A turns; conservative unpaired delayed translations; separate managed/personal-key mode; authenticated session admission/status/end intent; memory-only temporary credentials; reservation transactions tied to original grants; exact-decimal provider costs; durable usage pagination, deduplication, overlap and anomaly review. Stop never releases a reservation merely on the client's claim. Missing provider records remain unresolved. See MANAGED-STREAMING.md for threat model and the strict direct-stream quota limitations.

Substantial reader/settings/onboarding/account/compact redesign, independent source/translation draft and typography preferences, pinned revisions, manual corrections, jump-to-live, light/dark/system presentation. Three original generated visual directions, separately refined editable vector mark, wordmark and app icon, transparent PNGs, ICO, ICNS, favicon, share/checkout artwork and reproducible `npm run brand:export`. System fonts are referenced; no font files bundled. Native About reports version and build SHA.

Long-history rendering uses CSS content visibility while retaining DOM for selection. It is not a proven bounded-DOM virtualization solution. Extended history performance and accessibility on physical assistive technology remain unverified.

## CONFIGURED

Supabase staging project `pggkdfbbnmkbxrxodghu` (intera-staging), Frankfurt, in owner-selected free organization `nzthgftzybjtdqqdoaez`. Data API disabled. Both repository SQL migrations applied through the hosted SQL editor; CLI migration history has not been repaired/recorded. Private database connection uses a protected ignored local environment file, session pooler and certificate-verified TLS with the official Supabase root certificate. Current staging connection uses the privileged database owner; a least-privilege runtime role is still required before external exposure.

Whop production and sandbox are separate. Two hidden sandbox products, three recurring prices and one extra-time price saved, with original Intera artwork. Exact resource inventory and unresolved version/tax/webhook steps: WHOP-SETUP-INVENTORY.md. No production offers configured.

## VERIFIED LIVE (limited scope)

Hosted Supabase database connection succeeds with TLS verification. `npx tsx scripts/staging-db-check.ts` reports 16 private tables, all RLS enabled and no anon/authenticated table access. This is not proof of hosted OTP or cross-account application isolation. Owner credential rotation after chat exposure was requested but not independently confirmed.

Local Windows loopback diagnostic captured synthetic 440 Hz playback: stereo PCM16 at 48 kHz, 79 packets over the four-second capture, 54 packets while minimized, stable packet count after Stop. No provider upload occurred. This is not physical headset, meeting-app, Mac or live-translation evidence.

## VERIFIED SANDBOX

Whop sandbox login, business/product configuration and artwork persistence observed in the dashboard. No verified sandbox payment, signed webhook fulfillment or renewal/refund/transfer outcome yet. Local fixtures are recorded separately below.

## Local validation

`npm ci` completed at baseline. `npm run typecheck`, `npm run lint`, `npm test` passed: 71 tests including ledger, Whop fixtures, stream accounting and coordinator boundary cases. `npm run test:ui` passed all four Electron tests, including twelve varied synthetic turns and appearance/compact/account coverage. Typecheck also rerun after About/build metadata changes. `npm run make` produced a new Windows x64 installer and ZIP; unsigned. First package build embeds source SHA `d8bed2379e136d8bc696beb93dbcdea6f35f0b17` and dirty=true because evidence documents were still untracked. It must not be described as a clean-tree artifact.

Visual evidence is actual Electron output with labeled synthetic conversation, not generated screenshots. Both themes at 1280×800, 1440×900, 680×700 and 150% scale, settings, onboarding/account and default 500×280 compact captured and inspected. Baseline comparison exists at default window dimensions; matching before images do not exist for every matrix size. Screenshots and setup evidence are copied to the task's outputs/managed-beta directory.

## NOT RUN / BLOCKED

- Hosted email-code sign-in and restart persistence; two real accounts' authorization isolation. Default Supabase email templates/delivery remain unconfigured for the intended code flow; no custom SMTP sender supplied.
- Real Soniox admission, regional dedicated-project safeguards, accelerated input/configuration enforcement, actual input-audio/channel semantics and provider settlement. Server Soniox key/project setup still needed; internal allowlist remains gated.
- Whop canonical sandbox checkout and complete decline, renewal recovery, extras, cancellation, refunds and transfer matrix. Scoped key, plan IDs, tax settings and reachable signed webhook still needed.
- Approved hosted backend destination; a temporary local HTTPS tunnel is authorized for testing but has not been presented as production infrastructure.
- Physical supported Mac live capture; Windows meeting/headset/output-loss/sleep/lock scenarios; long real session and measured latency, memory and usage accuracy. No fabricated timing percentiles.
- New Mac package build, signing/notarization, merchant approval, Bosnia and Herzegovina payout onboarding, owner tax/legal selections, support/policy/download details and public distribution readiness.

Remaining owner steps are credential/security handoffs and legal/business configuration. Continue independent engineering and testing while those are pending. Do not fill release-evidence settings with placeholders, treat a success redirect as payment, or open public admission based on the existence of these documents.

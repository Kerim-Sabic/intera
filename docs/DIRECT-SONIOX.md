# Direct Soniox payment — internal beta

For a short, illustrated customer walkthrough, see [Set up Intera with your own Soniox account](SONIOX-SETUP-FOR-USERS.md).

The owner selected this priority over VIP prepaid billing on 2026-09-30. Each customer owns and funds a Soniox organization/project and connects its key to Intera. Intera adds no usage fee in personal mode. This is guided provider setup, not an embedded card checkout or automatic transfer to Intera's company account.

## Customer journey

1. Open **Set up Intera → How you pay → Pay Soniox directly**. No Intera account is required.
2. Open the official Soniox Console in the system browser. Create your own organization/project and review Billing. Enter payment details only at Soniox. Review any credit purchase or AutoPay choice yourself; Intera does not perform either action.
3. Review project/organization budgets and alerts. Create a dedicated key with real-time Speech-to-Text access. Optional model-listing permission allows the audio-free check. Leave unrelated permissions off.
4. Match Intera's region to the project region and paste the key into the masked field. Regional deployment access may require Soniox approval. Choose encrypted device storage or session-only storage, then **Connect and use direct payment**.
5. Run the local meeting-playback test; select language/profile/reading preferences. Review authorization, then Start. Pause/Stop remains explicit. Audio travels directly from the trusted desktop process to Soniox.
6. Review actual charges and credit in Soniox Console. Intera does not invent a cost estimate or debit subscription allowance for personal sessions.

Existing Intera subscriptions remain separately available; selecting direct payment does not cancel one. Manage an existing subscription through Account. Regular pricing and server sales/readiness gates are unchanged. Demo remains available without any account.

## Boundaries

- Keys pass transiently through the masked input and authenticated local IPC, then live in the main process. They are not returned in state snapshots or settings exports, and are never sent to Intera billing. Optional persistence uses Electron's OS-backed safeStorage; otherwise the key disappears when the app quits.
- Payment links are a fixed main-process allowlist. No renderer-supplied arbitrary URL is opened. Intera never receives card data.
- Changes to credentials are serialized against Start and other conflicting commands. Active sessions must stop before credentials/funding change. Stop/Pause remain available during a credential update.
- Model-listing validation proves only that permission/key combination. It does not prove real-time permission, available credit, regional entitlement or successful translation.
- Provider balance/budget errors stop the session and give funding-mode-specific guidance, without displaying raw provider text or automatically purchasing/retrying.
- Provider limits and alerts are not an Intera-enforced dollar cap. Soniox pricing and taxes govern the user's bill. No fixed hourly-price promise is embedded.

## Evidence checklist

- [x] Guided onboarding, connection settings, Account, authorization and footer identify direct billing.
- [x] Personal-mode boundary remains separate from company-funded admission/ledger.
- [x] Unit checks cover command validation, link allowlist and sanitized provider failures.
- [x] Real Electron UI check covers no-auth setup, selected region, cleared key field, secret-free snapshot, active-session rejection and session-only key disappearance after restart.
- [x] Light setup and dark narrow 150% screenshots inspected. Toolbar overflow corrected; native capture used for zoomed screenshots to avoid Playwright's cropped zoom capture.
- [x] Windows local synthetic playback diagnostic: 77 packets, 54 while minimized, 48 kHz stereo; Stop packet count stable. No upload. This is not meeting/headset or live translation evidence.
- [ ] Funded user-owned key → genuine English/Bosnian live output → final Soniox usage/charge. Not run: no purchase or use of the owner's card is authorized.
- [ ] Physical Mac/headset verification; signing/notarization and public release.

Verification commands: `npm run typecheck`, `npm run lint`, `npm test` (78 passing), `npm run test:ui` (5 passing), `npm run diagnostics:capture`. Packaging and exact SHA are recorded with the delivery artifacts. No production deployment, payment, AutoPay activation or public release was performed.

## Preserved work

Unfinished VIP prepaid work is committed on `codex/vip-prepaid` at `21354f8`, with its own work-in-progress report. Its migration was not applied to hosted staging. It is not included in this branch and is not a completed billing product. The direct-payment branch starts from managed-beta `bdad181e55b7f05828a4adb1b764d3faa651cdc3` and retains its original billing foundations.

## Official references checked

- [Soniox Console](https://console.soniox.com/)
- [Current pricing](https://soniox.com/pricing)
- [API key permissions](https://soniox.com/docs/guides/api-key-permissions)
- [Project regions and regional endpoints](https://soniox.com/docs/data-residency)

The permissions page was verified by HTTPS 200 with its expected document title when the web reader could not fetch it. No OAuth billing delegation or shared-company direct-card mechanism is claimed.

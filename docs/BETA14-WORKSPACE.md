# Intera AI beta.14: meeting workspace and reliability audit

Reviewed and changed on 2026-10-08. Baseline: beta.13 development commit `9161b5d`, which is newer than the repository's current main branch. This work preserves that existing Mac/camera work.

## Delivered

| Finding | Change |
| --- | --- |
| Provider requests were hard-coded to English/Bosnian | A 60-language catalog; configurable two-way, one-way and transcription modes; language selection before new live meetings |
| Detection could drift beyond the intended languages | Strict provider hints plus local filtering of explicitly out-of-selection output; unclassified tokens remain visibly unidentified |
| English/Bosnian medical context was sent for every conversation | General conversation by default, optional medical/business/legal context, and Bosnian script preference only when Bosnian is selected |
| New/save controls were buried in settings | Main-screen title, New meeting and Save controls; keyboard shortcuts for New and Save |
| Moving between meetings could discard unsaved text | Save & start fresh saves successfully before clearing; failed saves retain the current reader |
| Every save created a duplicate | Stable meeting identity and atomic updates; edits and renamed speakers can be saved into the same meeting |
| One unreadable encrypted file blocked the library | Individual failures are isolated and reported; readable meetings stay available; no damaged file is deleted automatically |
| Saved meetings did not retain processing settings | Language and processing metadata stored with each new saved meeting; older files remain readable |
| Closing could discard a whole meeting | Native Save & quit / Quit without saving / Cancel flow; failed saving keeps the app open |
| Translation in one direction masked a stalled opposite direction | Independent pending-language tracking and one bounded finalize request after a 20-second stall |
| Socket construction/write exceptions could escape capture cleanup | Explicit error paths stop acquisition, retain text and expose reconnect/audio checks |
| Reconnect discarded provisional text | Unfinished drafts retained in their earlier connection and labeled accurately |
| Same-speaker endpoints could merge unrelated sentences | New source turn after a finalized endpoint; empty provisional groups removed |
| Text exports omitted still-unfinished translations | Export retains drafts with explicit labels, human corrections, meeting title, languages and speaker names |
| Large transcripts were filtered and repainted on audio-meter updates | Memoized visible text and turn rendering; Unicode-normalized search |
| Reading assumed left-to-right scripts | Independent automatic text direction for source and translation; Arabic and other scripts preserved through save/restart/export |
| Old visual identity and unclear screen hierarchy | Built-in image-generated logo, deterministic icon exports, refreshed light/dark workspace, smaller-window and zoom checks |

## Verification

Validation covers TypeScript, lint, unit/integration tests and real Electron UI tests. Unit coverage includes every distinct pair in the 60-language catalog (3,540 request configurations), strict hints, legacy preference migration, independent translation directions, bounded recovery, retained drafts, encrypted save/update and corrupt-file isolation. This is configuration coverage, not live translation-quality measurement.

Desktop coverage exercises meeting setup, cancellation before audio sharing, encrypted save/edit/update/new/reopen/restart, speaker naming, RTL text, close cancellation, profiles, onboarding, compact reading, window options, light/dark themes and zoom. Final counts and artifact locations are recorded in the delivery report.

Production-dependency audit on this host reports zero known vulnerabilities. The full toolchain audit still includes development/packaging advisories; this change does not perform an unrelated forced dependency upgrade.

## Practical limits and outstanding work

- Paid live Soniox translation has not been exercised with the user's funded account in this change. Provider quality, latency, quotas and regional account capability still matter.
- Physical Mac capture, Bluetooth/headset changes, native permissions and real Zoom/Meet/Teams audio need testing on the target Mac. Windows tests cannot establish physical Mac reliability.
- Mac distribution still needs Apple Developer ID signing and notarization for a trusted public release. Ad-hoc beta integrity signing does not provide that trust or guarantee stable permissions.
- The existing Eye contact feature still requires its reviewed model/runtime and a signed camera-enabled build. It is not certified by this meeting-workspace work.
- The app interface remains English. The 60-language coverage concerns meeting transcription and translation, with bidirectional text layout.
- Meetings are explicitly saved in an encrypted local library. Continuous crash-recovery autosave, cloud sync, recorded-file import and AI summaries are not implemented by this change.
- Ambiguous returning-speaker translations remain visibly unpaired; the app does not invent sentence alignment. Reconnect has a real capture gap and never replays audio silently.
- Language restrictions are best-effort in the provider model. Local filtering can reject known out-of-selection metadata, but cannot determine the true language of wrongly classified speech. Unidentified tokens are retained and labeled.

## Provider references

- Language coverage: https://soniox.com/docs/stt/concepts/supported-languages
- Restriction behavior: https://soniox.com/docs/stt/concepts/language-restrictions
- Translation config and token semantics: https://soniox.com/docs/translation/stt-translation/rt-translation
- Finalization: https://soniox.com/docs/stt/rt/manual-finalization

## Brand provenance

The new authoritative asset is `assets/brand/intera-symbol-v2.png`, generated with the built-in image tool. Its alpha is preserved. `npm run brand:export` creates the PNG sizes, embedded-raster SVG wrappers, ICO and ICNS consumed by the app and installer. The SVG wrappers are not native vector tracings.

Prompt: "Use case: logo-brand. Asset type: production desktop app logo symbol for Intera AI, a calm premium multilingual meeting interpreter. Create one distinctive minimalist geometric symbol: two complementary flowing speech forms interlock into a subtle lowercase i / bridge, communicating understanding across languages. Flat crisp vector-like silhouettes, generous negative space, readable at 24px. Deep indigo and vivid periwinkle with a restrained turquoise accent. Center one large symbol on a genuinely transparent square canvas with modest even padding. No lettering, no wordmark, no mockup, no shadow, no busy decoration, no gradients, no watermark. Confident, warm, precise, contemporary macOS app brand."

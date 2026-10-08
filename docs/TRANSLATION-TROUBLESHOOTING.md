# Translation troubleshooting

## Current beta.14 behavior

Before a new meeting, **Start → Set up this meeting** asks for its languages and direction. Recognition requests are restricted to the selection. Explicitly out-of-selection output is filtered locally; unidentified tokens remain visibly unidentified. The supplied medical/insurance glossary is English/Bosnian, so review terminology when switching languages.

Each translation direction has independent monitoring. After 20 seconds of pending output, Intera sends one bounded turn-finalization request without reconnecting or replaying audio. A connection error offers Reconnect and Check audio; reconnect preserves unfinished drafts in the earlier connection. After ten seconds of samples without recognized speech, a separate message offers an audio check. Text exports retain unfinished translations with labels.

Use **New meeting → Save & start fresh** to keep one meeting before moving to another. Failed saves retain the reader. See [the beta.14 audit](BETA14-WORKSPACE.md) for exact validation and remaining physical Mac/live-provider limits.

Report: a physical Mac user reports successful transcription but no translation in either reading view. This is user-reported capture evidence, not a measured full acceptance test. The root cause of zero translation in that user's connection is not confirmed.

## Quick check

1. Stop listening (do not only Pause).
2. Start / Set up this meeting: choose the actual meeting languages and Conversation / translate both ways for bidirectional use. One-way and transcription-only are also available. The language restriction is always applied to your selection.
3. Settings / Reading: enable Show live drafts and Show translation drafts. Release Hold reading and unpin the turn if needed.
4. Start again with a short ordinary test sentence in a selected language. Two-way mode translates only the selected pair.
5. If still waiting, Settings / Session displays active direction and received source/translation token counts. Share those counts and direction, not keys or private conversation text.

Translation tokens greater than zero prove provider output arrived, not translation accuracy. Zero means no translation was returned to this connection. Drafts are provisional and provider latency has no guaranteed maximum.

## Historical investigation: beta.5 through beta.6

- Compact mode retains the most recent visible translation in the current connection when newer speech is untranslated, with an explicit earlier-output notice. Original speaker/turn attribution remains intact; uncertain translations are not silently paired.
- A metadata-only warning appears after 20 seconds without translation when source speech has arrived after the last translation. It clears on translation arrival and does not warn during silence after translation caught up.
- Hidden live translation drafts have a separate explanation; effective request mode is used for the waiting label.
- Session diagnostics contain only direction and token counts, including draft revisions. They are not billing measurements.

The existing `stt-rt-v5` request already includes the documented one-way/two-way translation block. It was verified against [Soniox's current translation contract](https://soniox.com/docs/translation/stt-translation/rt-translation). No undocumented provider parameters, automatic reconnections, second model, or extra provider charges were added.

Automated mocked-provider tests cover request configuration, missing-output warning, recovery, silence and connection reset. Reducer tests cover late unpaired translations, draft visibility and cross-connection isolation. These tests do not prove live translation on the reported Mac. No new paid provider test was run.

## Bidirectional diagnostics (beta.6)

Session diagnostics also report received English-to-Bosnian and Bosnian-to-English token counts, the latest detected speech language, and out-of-pair token counts. Missing language metadata is not counted as a verified direction. Speech content is never copied into these diagnostics; observed language is a bounded label.

Soniox's [documented two-way example](https://soniox.com/docs/translation/stt-translation) explicitly leaves speech detected outside the selected pair untranslated. Its [language hints](https://soniox.com/docs/stt/concepts/language-hints) guide recognition but do not restrict it. Intera warns about observed out-of-pair speech during a stall, without relabeling Croatian/Serbian as Bosnian or automatically changing language settings. Whether this explains the reported Mac failure remains unverified.

## Live quality acceptance — not run

Use authorized synthetic speech recordings from fluent English and Bosnian speakers; no patient identifiers. Run one connection containing at least twelve alternating turns, both short and long utterances, interruptions and returning speakers. Record provider arrival timings without private content. Test numbers, decimal separators, negation, names, uncommon terminology and meaning after manual corrections. Have a fluent reviewer score preserved meaning and critical errors separately from missing output/latency. Repeat with relevant headsets on physical M1/Ventura and newer supported Macs, then check Pause/Resume and final output after Stop.

Automated synthetic token tests prove output preservation, chronology, direction classification and language warnings. They do not measure translation correctness or prove live provider output. Do not label an unreviewed glossary or a mock fixture as clinical validation. The unresolved user report remains the release blocker for translation reliability.

## Stop finalization (beta.6)

Capture stops immediately. The existing WebSocket may remain open for up to 15 seconds to receive final output for audio already transmitted (previously 3 seconds). No new audio is accepted while stopping. A provider `finished` response closes promptly; timeout or a close without that confirmation explicitly warns that the latest translation may be incomplete. The bound is not a translation SLA. Tests cover translation arriving after five seconds and an unconfirmed timeout.

## Local beta.6 validation

`npm run typecheck`, `npm run lint`, `npm test` (95 tests), and `npm run test:ui` (six passed, native Mac package test skipped on Windows) passed. The saved glossary editor was tested through an actual desktop restart; rejected duplicates preserve the previous glossary. The earlier finalization regression test was updated to exercise the new 15-second bound and incomplete-output notice. Native beta.6 builds and physical-Mac/provider quality acceptance remain separate checks.

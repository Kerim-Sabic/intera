# Translation troubleshooting

Report: a physical Mac user reports successful transcription but no translation in either reading view. This is user-reported capture evidence, not a measured full acceptance test. The root cause of zero translation in that user's connection is not confirmed.

## Quick check

1. Stop listening (do not only Pause).
2. Settings / Languages: select Translate to Bosnian for English playback, or Translate to English for Bosnian playback. Save preferences.
3. Settings / Reading: enable Show live drafts and Show translation drafts. Release Hold reading and unpin the turn if needed.
4. Start again with a short ordinary test sentence. Two-way mode translates only the selected language pair; one-way is useful to isolate language detection.
5. If still waiting, Settings / Session displays active direction and received source/translation token counts. Share those counts and direction, not keys or private conversation text.

Translation tokens greater than zero prove provider output arrived, not translation accuracy. Zero means no translation was returned to this connection. Drafts are provisional and provider latency has no guaranteed maximum.

## Changes in beta.5

- Compact mode retains the most recent visible translation in the current connection when newer speech is untranslated, with an explicit earlier-output notice. Original speaker/turn attribution remains intact; uncertain translations are not silently paired.
- A metadata-only warning appears after 20 seconds without translation when source speech has arrived after the last translation. It clears on translation arrival and does not warn during silence after translation caught up.
- Hidden live translation drafts have a separate explanation; effective request mode is used for the waiting label.
- Session diagnostics contain only direction and token counts, including draft revisions. They are not billing measurements.

The existing `stt-rt-v5` request already includes the documented one-way/two-way translation block. It was verified against [Soniox's current translation contract](https://soniox.com/docs/translation/stt-translation/rt-translation). No undocumented provider parameters, automatic reconnections, second model, or extra provider charges were added.

Automated mocked-provider tests cover request configuration, missing-output warning, recovery, silence and connection reset. Reducer tests cover late unpaired translations, draft visibility and cross-connection isolation. These tests do not prove live translation on the reported Mac. No new paid provider test was run.

# Beta.12 glossary and camera reliability checks

Implemented on the existing follow-up branch; no merge, release, deployment, payment or signing approval performed.

## Changes

The live request already uses `stt-rt-v5`, English/Bosnian two-way translation, recognition hints and the user's directional mappings in `context.translation_terms`. A new coordinator test follows the actual WebSocket start/Stop/Resume code and verifies that both mappings are sent on both connections and that both original/translated directions survive draft finalization. Its provider responses are synthetic; this is not translation-accuracy evidence.

Glossary validation now checks a conservative 8,000-character serialized context budget including the fixed domain/language hints. The provider's actual 8,000-token limit remains authoritative; Intera has no provider tokenizer and does not equate characters with tokens. Oversized selections are rejected before connecting, never silently truncated. The editor and preset picker show the reason. The saved glossary remains unchanged after failure. Previously stored oversized glossaries still load for editing; Start rejects them before capture or managed credential admission. Unicode-equivalent conflicting source phrases are also rejected for new sessions.

Camera correction skips missing, clipped, too-small or nonfinite eye geometry and coincident eye centers. That frame remains original camera video. Numeric geometry failures preserve the original frame rather than leaving a partially modified image. Unexpected model/runtime failures still stop output visibly. Pure geometry tests need neither a webcam nor ML dependencies; they are not face/model quality measurements.

## Verified locally

- `npm run typecheck`: PASS.
- `npm run lint`: PASS, including the React component review.
- `npm test`: 121 PASS, 23 files.
- `python -m unittest discover -s camera -p test_worker.py`: 6 PASS.
- `npm run test:ui`: 9 PASS, 2 Mac-only SKIPPED. Includes real desktop restart with saved directional glossary, and oversized editor selection rejected without replacing it.

Mac CI is triggered by the branch push; inspect its exact source/run before treating the new package as verified. Earlier beta.11 tests and playback results remain in `BETA11-EVIDENCE.md`; they are not relabeled as beta.12.

## Set up a glossary for both directions

1. Stop listening, open Settings → Languages and choose Automatic · English ↔ Bosnian.
2. When only English and Bosnian will be spoken, enable recognition restriction and save preferences. Otherwise another detected language may remain untranslated in two-way mode.
3. Browse the supplied medical/insurance library and load a focused selection. Review its context notes and alternatives. The owner-supplied translations are independently unverified.
4. Each mapping is directional. For example, `blood pressure = krvni pritisak` and `krvni pritisak = blood pressure` are two mappings. Review both; Intera does not automatically reverse an ambiguous term.
5. Apply glossary; optionally save it locally for later sessions. Start a new connection. Simply editing or loading a preset does not apply it.
6. Enable live translation drafts if desired. Check both directions using ordinary, non-private test speech, then inspect final output after Stop.

Soniox's glossary preferences guide its model; they are not guaranteed literal substitutions. No postprocessing rewrites the clinical meaning to force a glossary match. Live semantic quality, negation/numbers and glossary adherence still require a fluent reviewer on authorized audio.

## Remaining external verification

No paid/live Soniox request was made in this change. Missing actual provider output on the owner's Mac remains unresolved until observed with a funded account and authorized speech. Signing does not establish translation accuracy.

Gaze camera distribution remains blocked by model redistribution review, a real signed/notarized runtime and extension, owner activation and a physical Mac/receiving-device Zoom test. The development transport remains at most five new frames per second; smoothness, M1 memory/CPU and simultaneous interpretation are NOT VERIFIED. Existing beta installers do not contain a finished gaze camera. No fabricated model approval was created.

References checked 2026-10-02: https://soniox.com/docs/translation/stt-translation, https://soniox.com/docs/stt/concepts/context, https://soniox.com/docs/stt/models. Native build/acceptance instructions: `INTEGRATED-EYE-CONTACT.md`.

# Test report and requirements coverage

Date: 2026-09-29. Host: Windows 11 Pro 10.0.26200 x64. Node 22.18.0, npm 10.9.3, Electron 44.4.5. Only deterministic/synthetic data was used. No personal Soniox key was provided, and no paid/provider audio request was made.

## Executed evidence

| Command / check | Result | Scope |
|---|---|---|
| `npm run typecheck` | PASS | Strict TypeScript |
| `npm run lint` | PASS | ESLint |
| `npm test` | PASS: 34 tests, 5 suites | Exact presets, omissions, validation, custom round trip, drafts/finals, repeated words, delayed/unpaired translation, no-endpoint streaming, pins/edits, stale epochs, pause/staged/next-session config, Stop race, drain timeout, PCM order and backlog |
| `npm run test:ui` | PASS: 2 Electron tests | Real restart persistence; idle/setup, profile/custom, demo, hold, compact, pause, clear, large-font dark narrow layout |
| `npm run diagnostics:capture` | PASS local Windows loopback | Synthetic 440 Hz playback, 4 seconds, 48 kHz stereo PCM16. 79 packets; 54 after minimize. Maximum RMS ≈0.02126. Stop packet count stable. No provider upload |
| `npx tsx scripts/capture-diagnostic.ts --packaged` | PASS local packaged Windows loopback | Same format and tone; 79 packets, 55 after minimize; Stop count stable. See evidence JSON |
| `npm run make` | PASS | Windows x64 app, ZIP and Squirrel Setup generated; unsigned |
| GitHub Actions run 36578213342 | PASS: Windows x64, macOS ARM64 and Intel x64 | Typecheck, lint, 34 tests and native packaging; artifacts uploaded |
| `npm audit --omit=dev` | PASS: zero reported vulnerabilities | Runtime production dependencies only |

Source evidence: [development capture](evidence/windows-capture.json), [packaged capture](evidence/windows-packaged-capture.json). UI screenshots are generated under `test-results/screenshots/` and supplied separately with the delivery. Personally inspected idle/profile/custom/live-demo/held/paused/compact and dark 680×520 layouts. Fixed the initial missing desktop entry point, capture permission classification, compact reading order and narrow-window test targeting.

Full developer-tool dependency audit still flags `extract-zip` and optional macOS `image-size` through the Forge toolchain. Compatible tar/tmp fixes are pinned with overrides. Do not interpret the runtime audit as a clean full build-chain audit. No forced downgrade of Electron/Forge or incompatible image-size major override was used. macOS packaging passed in CI on ARM64 and Intel. These developer-tool advisories still require review; physical app execution remains unverified.

## Not run / not measured

- Actual computer playback → Soniox → original/translated output: **NOT RUN**, requires a personal regional key and authorized sample. The real capture and WebSocket implementation exists; local capture plus fake-transport tests do not prove this end-to-end path.
- Profile-comparison harness: **NOT RUN**. No measured end-to-end latency, accuracy, translation correctness or app-added paint-latency claim.
- Actual Zoom, Teams, browser meetings; headphone/physical-mic-indicator combinations: **NOT RUN**.
- Physical Apple Silicon and Intel Mac capture, `.app` permission denial/revocation, `.dmg` execution: **NOT RUN**.
- Signing, notarization, installer execution, SmartScreen/Gatekeeper reputation: **NOT RUN / unsigned**. Creation of Setup is not installation validation.
- Two-hour streaming/memory soak, device/Bluetooth switching, sleep/lock on actual meetings, 150% scale and screen-reader matrix: **NOT RUN**.
- CI build and packaging passed on all three targets. Physical Mac capture and app execution remain NOT RUN.

## Implemented requirements

The core includes dedicated background playback capture; real Soniox protocol/configuration; independent processing/display preferences; regional allowlist; asynchronous OS key protection; one coordinator and request; bounded PCM queues; epoch-safe Stop/Pause/Clear; live/settled UI; edits, pinned and interpreted revisions; conservative unpaired translation handling; speaker rename; session glossary; explicit export; demo; and native packaging configuration.

## Remaining software work (not hidden as external blockers)

This is a runnable development implementation, **not the entire master brief completed**:

1. Replace larger per-connection speaker/language groups with a thoroughly validated chronological grouping strategy, preserving delayed translation ambiguity. Current grouping is faithful but can combine separate turns by the same speaker.
2. Add long-history virtualization and provider-event-to-paint instrumentation; current memory has a hard text bound, but two-hour UI scaling has not been established.
3. Complete the full guided/resumable onboarding, searchable settings, Bosnian UI localization, density/spacing/timestamp/highlight preferences, window restoration, configurable shortcuts and named-preset rename UI. Current key/audio/profile setup is functional through settings.
4. Add selected-input/legacy virtual-device adapter and optional replay. Neither is advertised as available; no physical microphone fallback exists.
5. Add bounded automatic transient-error retry if desired; current recovery is explicit and stops acquisition on errors. Automatic duration rollover is replaced with warning and Pause before the provider limit.
6. Extend native permission, accessibility, scrolling/selection, import/export and cleanup test coverage. Source-level validation and current tests do not establish every release scenario.

The supplied capture diagnostics and provider comparison harness are runnable. The app must not be presented as clinically verified or ready for unsupervised medical use.


CI evidence: https://github.com/Kerim-Sabic/intera/actions/runs/36578213342. Tested source commit: 2642bdf42f46adea808b786bcadfab718220b805. Mac artifact archives contain DMG and zipped app builds; they are unsigned/not notarized. Native Windows Setup signature check returned NotSigned.

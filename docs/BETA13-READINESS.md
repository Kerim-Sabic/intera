# Beta.13: Intera AI naming and discoverable Eye contact

## Implemented

- Display name, title, About menu, onboarding, reader wordmark, installer product name and reproducible brand artwork use Intera AI.
- Stable application identifier `com.intera.desktop`, executable `Intera`, internal package name and existing `Intera` user-data directory remain unchanged. This avoids resetting keys, preferences and saved meetings during the display-name change. Camera output retains the name Intera Camera.
- Camera toolbar button opens Eye contact directly, including from compact mode. Opening Settings clears stale navigation search filters.
- Settings shows the installed version and source revision. Eye contact distinguishes OS support, engine presence, signed bridge availability and running output. It explains why permission changes alone cannot enable missing components.
- Updated packaged Mac launch paths and signed host entitlement selection for `Intera AI.app`.
- Detailed user guide separates current public download capabilities from the intended camera-enabled workflow.

## Verified locally on Windows

Commands run after code changes:

```text
npm run brand:export
npm run typecheck
npm run lint
npm test
npm run test:ui
npm run package
git diff --check
```

Typecheck/lint passed. Unit suite: 121 tests across 23 files passed. Real Electron UI suite: nine passed, two Mac-only checks skipped. Packaging passed. A separate Playwright launch of `out/Intera AI-win32-x64/Intera.exe` verified the title, beta.13 version, direct Eye contact navigation, idle listening state, zero audio packets and correctly unavailable camera engine.

Actual packaged Windows screenshot: [Eye contact and readiness](images/intera-ai-eye-contact-beta13.png). No camera/audio capture, synthetic meeting data or credentials were included. It shows the working-tree source revision; a final committed build receives its own revision from the build script.

## Not run / blocked

- New beta.13 Mac packaging, installed launch and compatibility capture: dependent on the pushed CI run; not represented by local Windows results.
- Physical Mac webcam, corrected preview, extension activation and Zoom reception: not run. No physical Mac or real Apple signing identity is available here.
- Public camera-enabled packaging: blocked by actual model redistribution review, Mac runtime preparation and real Developer ID signing/notarization. No approval manifest was invented.
- Smooth corrected video and medical translation quality: not certified. The development camera transport is five input frames per second; no physical performance claim is made.
- A beta.13 public download: not published by this source-change task. Existing published beta.12 assets are unchanged and do not contain a working camera runtime.

Native compilation, UI tests and a readiness label do not establish working gaze correction. This report intentionally does not mark the requested full camera delivery complete.

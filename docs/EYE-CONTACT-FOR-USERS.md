# Intera AI: finding Eye contact and checking readiness

## What the current download can do

The published beta.12 contains Settings → Eye contact. It does **not** contain a usable corrected-camera engine or signed virtual camera. Disabled preview/output controls are expected. Camera permission and a newer macOS version cannot supply the missing components.

The beta.13 source adds a camera icon directly in the reader toolbar, a readiness checklist, and the Intera AI name. A source push is not a new downloadable release. Check the release page and its stated version before replacing your app.

## If you cannot find the setting

1. Quit Intera using its application menu. Close any copy launched from the mounted installer.
2. Open the copy installed in Applications. Existing releases are called **Intera**; the renamed build is **Intera AI**. Avoid keeping and launching two different copies.
3. Open Settings → Updates and check the installed version. Beta.13 also prints the version and source revision at the top of Settings.
4. Clear the “Find a setting” search field. Select **Eye contact** in the left navigation. In beta.13 you can instead click the camera icon beside Start.
5. If the version is beta.12 and the section is still absent, record the version shown in the application’s About dialog. Do not assume a downloaded disk image replaced the running application. Automatic Mac updates are disabled until a signed, notarized channel is available.

## How to read the checklist

| Item | Meaning |
| --- | --- |
| Supported Mac | The app checks macOS 14 or later. This is an operating-system requirement, not a successful webcam test. |
| Camera engine | The executable exists. Approved models and real camera access are validated when starting preview. |
| Signed camera bridge | The host, extension and bridge must have matching real Apple signing identities. Availability alone does not mean owner activation succeeded. |
| Meeting output | Explicit camera output is running. Verify it in the meeting app; this is not certification of visual quality or participant reception. |

## Intended workflow for a future camera-enabled release

These instructions describe the implemented controls. They cannot enable the missing camera engine in the current public beta.

1. Install the reviewed, signed camera-enabled Intera AI build in Applications on macOS 14+.
2. Open Eye contact and choose **Check camera readiness**.
3. Click **Enable Intera Camera in macOS** and personally review the macOS extension approval. Follow any restart requirement shown by macOS.
4. Select your physical camera index. Start at 0. Intera Camera is excluded from input selection to avoid a video feedback loop.
5. Click **Start local camera preview** and grant camera access if requested. No webcam audio is captured. Stop preview before changing cameras.
6. Enable gaze correction. Adjust calibration only while watching the preview. Reset calibration if the result looks unnatural.
7. Click **Start camera output**. In Zoom’s camera selector choose **Intera Camera**, then verify the preview and the video received on another device with ordinary test content.
8. Once output is active, close Settings and read your translation. Use **Camera on · Stop** to end output. Preview alone stops when its section closes. Quitting the app stops both camera and listening.

Computer-playback listening and camera output have separate Start/Stop controls and permissions. Gaze correction does not improve Soniox translation, does not make Intera invisible to screen sharing, and does not start automatically.

## Remaining release requirements

- Actual redistribution review for TensorFlow checkpoints and the MediaPipe task; no fabricated approval manifest.
- A Mac runtime bundle, real Developer ID signing and notarization, and successful owner extension activation.
- Physical Apple Silicon/Intel webcam and Zoom tests, orientation/color tests, multiple consumers, camera loss and stale-frame checks.
- Measured performance and visual quality. The current development worker requests five frames per second; the extension repeats fresh input at thirty frames per second. This is not a demonstrated smooth thirty-frame-per-second correction pipeline.

See [engineering status and build instructions](INTEGRATED-EYE-CONTACT.md). No claim of working gaze correction should be based only on native compilation or the presence of Settings controls.

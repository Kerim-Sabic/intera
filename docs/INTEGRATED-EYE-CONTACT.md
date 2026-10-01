# Integrated eye contact — development status

The requested delivery is one Intera application: camera selection, local corrected preview, on/off and calibration controls, plus an **Intera Camera** virtual camera selectable in Zoom. A launcher for GazeAt does not satisfy this. No companion installer is downloaded or launched by this implementation.

## Implemented

- In-app preview panel and camera index, correction toggle, horizontal/vertical/depth offset, focal-length and reset controls.
- Separate local worker wrapping the actual upstream MediaPipe predictor and TensorFlow gaze corrector. stdin commands and bounded JPEG replies; no network listener, recording or frame upload. The preview is limited to at most five requested frames per second, independent of the transcript state updates. This is a development preview rate, not a measured camera performance claim.
- A single owned worker, generation fencing, startup timeout, failure state, stop when its panel closes, last window closes or Intera quits. Missing/invalid models fail **before camera access**. Missing checkpoints now fail instead of silently allowing an uninitialized model.
- Renderer commands cannot choose executables, URLs, model directories or file paths. Camera index/settings are validated. Microphone capture is not requested.

## Not delivered or verified

**This beta does not supply a working Zoom virtual camera.** No Core Media I/O extension, signed activation host, approved packaged Python runtime or reviewed weight bundle has been supplied. The installed application keeps camera preview unavailable. The public source inspected at the pinned revision contains a Python preview pipeline, not the native extension advertised by the separately distributed app.

Live inference, camera permission prompts, performance on M1/8 GB, latency, visual quality, Zoom selection and end-to-end output are NOT RUN. Windows is unavailable for this optional feature. Native Mac verification cannot be done on this Windows workstation. No approval, signature or redistribution license has been invented.

## Source provenance and model boundary

Vendored code: https://github.com/WangWilly/gaze-correction-cam at `a94ec5979b634a7bc812a879a2ebe15ca7d4f6c1`. BSD-3-Clause notice is retained in `camera/upstream/LICENSE`. Upstream dependencies are recorded in `camera/upstream/pyproject.toml`; installing them is an explicit developer action, not an app startup step. Intera's wrapper is Apache-2.0. The upstream checkpoint fallback has been changed to fail closed. Other vendored processing files are unchanged.

Code licensing does not establish model redistribution rights. The dlib/iBUG default is excluded from this integration; its commercial-use restriction is documented at https://dlib.net/face_landmark_detection.py.html. MediaPipe landmark assets and the gaze checkpoints still need documented provenance, license review and digest verification before redistribution.

`camera/upstream/approved-models.json` is intentionally absent. A release reviewer must supply `redistribution_review: "approved"`, a real `license_reference`, and a `files` mapping of relative filenames to SHA-256 digests for the MediaPipe landmark task, both checkpoint metadata files, index files and all data shards. This is an engineering release check, not proof of legal rights. Never generate an approval entry to make the app's button active.

## Development execution

On an authorized macOS 14+ development machine, prepare an isolated Python 3.12 environment using the upstream dependencies. Supply reviewed assets at their documented upstream locations and the reviewed manifest. Set `INTERA_GAZE_PYTHON` to that environment's absolute Python executable path and run `npm run dev`. The renderer cannot change that path; packaged apps ignore the override. Click Settings → Eye contact → Start local camera preview. Development camera permission may be attributed to Python/the development host, not the final Intera application. No camera starts automatically.

Validate without a webcam or ML dependencies: `python -m unittest discover -s camera -p test_worker.py`. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run test:ui` for the desktop checks.

## Required native completion

Build an Intera-owned Core Media I/O camera extension and activation host following Apple's camera-extension documentation: https://developer.apple.com/documentation/coremediaio/creating-a-camera-extension-with-core-media-i-o. Transport timestamped video frames through a bounded local native interface; the JSON/JPEG development preview is not the production virtual-camera transport. Establish matching team identity, app group, entitlements, provisioning, Developer ID signing and notarization for host and extension. Bundle the reviewed inference runtime outside ASAR, sign it and test framework dependencies on both native architectures. Handle owner activation/permission and deactivate output on stop, worker failure, quit and camera loss. Never export stale frames indefinitely or silently show an uncorrected feed as corrected.

Test physical M1 and supported Intel Macs: camera denied/granted, preview/calibration, concurrent transcription, sleep/wake, slow inference, process crash, camera unplug, app quit, extension activation/update, actual Zoom output received on a second device, and sustained resource use. Keep the feature gated until these steps have evidence. This is the remaining implementation scope, not a completed extension awaiting only a checkbox.

# Integrated eye contact — development status

The requested delivery is one Intera application: camera selection, local corrected preview, on/off and calibration controls, plus an **Intera Camera** virtual camera selectable in Zoom. A launcher for GazeAt does not satisfy this. No companion installer is downloaded or launched by this implementation.

## Implemented

- In-app preview panel and camera index, correction toggle, horizontal/vertical/depth offset, focal-length and reset controls.
- Separate local worker wrapping the actual upstream MediaPipe predictor and TensorFlow gaze corrector. stdin commands and bounded JPEG replies; no network listener, recording or frame upload. The preview is limited to at most five requested frames per second, independent of the transcript state updates. This is a development preview rate, not a measured camera performance claim.
- A single owned worker, generation fencing, startup timeout, failure state, stop when its panel closes, last window closes or Intera quits. Missing/invalid models fail **before camera access**. Missing checkpoints now fail instead of silently allowing an uninitialized model.
- Renderer commands cannot choose executables, URLs, model directories or file paths. Camera index/settings are validated. Microphone capture is not requested.

## Native implementation and remaining delivery gates

Native source is now present in `camera/native/Provider.swift` and `bridge.mm`. It publishes an Intera Camera source and a separate input sink. The sink checks the producer's signing identifier and Apple team; source output goes black within one second of input loss. The trusted Electron main-process bridge handles explicit owner activation, sink start, bounded JPEG-to-BGRA submission and stop. Native code compiled on the Apple Silicon Mac CI runner; activation and real Zoom output are NOT verified.

The installed beta still does not deliver a working gaze camera. A reviewed model bundle, packaged inference runtime, real Developer ID/provisioning/notarization, macOS owner activation and a physical Zoom test are missing. The native bridge loads only when the installed app, extension and addon signatures verify and their real Apple team IDs match. No companion installer or security bypass is used.

Synthetic eye-tensor inference restored both actual upstream checkpoints with TensorFlow 2.19 on Windows CPU. Both output tensors had the expected shape and finite values and changed with target angles. This is not face/camera quality evidence or an M1 benchmark. Details: GAZE-INFERENCE-EVIDENCE.json. Actual face landmarks, clipping, camera orientation, continuity cameras, permission prompts, M1/8 GB performance and real meeting output remain NOT RUN.

## Source provenance and model boundary

Vendored code: https://github.com/WangWilly/gaze-correction-cam at `a94ec5979b634a7bc812a879a2ebe15ca7d4f6c1`. BSD-3-Clause notice is retained in `camera/upstream/LICENSE`. Upstream dependencies are recorded in `camera/upstream/pyproject.toml`; installing them is an explicit developer action, not an app startup step. Intera's wrapper is Apache-2.0. The upstream checkpoint fallback has been changed to fail closed. Other vendored processing files are unchanged.

Code licensing does not establish model redistribution rights. The dlib/iBUG default is excluded from this integration; its commercial-use restriction is documented at https://dlib.net/face_landmark_detection.py.html. MediaPipe landmark assets and the gaze checkpoints still need documented provenance, license review and digest verification before redistribution.

`camera/upstream/approved-models.json` is intentionally absent. A release reviewer must supply `redistribution_review: "approved"`, a real `license_reference`, and a `files` mapping of relative filenames to SHA-256 digests for the MediaPipe landmark task, both checkpoint metadata files, index files and all data shards. This is an engineering release check, not proof of legal rights. Never generate an approval entry to make the app's button active.

## Development execution

On an authorized macOS 14+ development machine, prepare an isolated Python 3.12 environment using the upstream dependencies. Supply reviewed assets at their documented upstream locations and the reviewed manifest. Set `INTERA_GAZE_PYTHON` to that environment's absolute Python executable path and run `npm run dev`. The renderer cannot change that path; packaged apps ignore the override. Click Settings → Eye contact → Start local camera preview. Development camera permission may be attributed to Python/the development host, not the final Intera application. No camera starts automatically.

Validate without a webcam or ML dependencies: `python -m unittest discover -s camera -p test_worker.py`. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run test:ui` for the desktop checks.

## Build and owner activation

`npm run camera:native` compiles the camera extension and N-API bridge using the installed Mac SDK. It does not sign or activate them. CI retains those binaries separately from the ordinary unsigned Intera beta. They are not installable camera releases.

`npm run camera:prepare` requires a real Apple team ID, Developer ID identity, dedicated Python environment (including PyInstaller) and reviewed model manifest. It prepares the runtime, extension bundle, app-group entitlements and metadata. Set `INTERA_CAMERA_BUNDLE` to the resulting `out/camera-bundle` directory for `npm run make`. Forge copies the extension to `Contents/Library/SystemExtensions` before signing and uses separate host/extension entitlements. Models are validated before preparation, and preparation rejects a mismatched team or architecture. Never commit model files, provisioning profiles or signing credentials. Notarization uses the existing protected Apple build settings.

The app remains a macOS 13+ interpreter; eye contact requires macOS 14+. After the signed application is installed in Applications, the owner explicitly clicks Enable Intera Camera in macOS, reviews Apple's extension approval, starts preview and clicks Use Intera Camera in Zoom. Select Intera Camera from Zoom's camera menu and verify it from another device. Existing unsigned betas keep those actions disabled.

The development transport still uses bounded JPEG frames requested at five fps; it is not a demonstrated smooth production video pipeline. The extension sends at 30 fps by repeating fresh input and switches to black on stale input. Smoothness/latency and a faster transport need actual measurement before public release. No audio is obtained from the webcam.

## Remaining physical validation

Test real M1 and supported Intel Macs: camera denied/granted, corrected preview/calibration, orientation, no-face/partially visible eyes, camera selection including virtual-camera recursion, concurrent transcription, sleep/wake, slow inference, worker crash, unplug, app quit, extension activation/update/replacement, two camera consumers, and Zoom output received on a second device. Measure sustained memory/CPU, frame latency and real interpretation capture. Compile/synthetic tests cannot satisfy these checks. Keep the integrated camera distribution gated until model redistribution and these delivery checks have evidence.

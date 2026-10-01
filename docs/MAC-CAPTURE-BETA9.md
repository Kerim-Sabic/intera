# Beta.9 capture diagnosis

The owner reports “Playback capture could not start” on the physical M1/macOS 13.1 after enabling permission. That message was not proof of denied macOS permission. The coordinator previously discarded capture-host startup exceptions, while several distinct renderer failures received the same generic permission advice. This diagnostic release does not declare the physical capture issue fixed.

Implemented:
- Distinguish capture-host loading, source enumeration, display acquisition, ended/missing audio tracks, audio context, worklet loading, graph setup and context resume.
- Retain only allowlisted stage/error codes, together with the screen permission status macOS reports. The screen status is a diagnostic, not proof that system audio can be delivered; later Mac CoreAudio taps have their own requirements.
- Display the result in Settings → Audio and include stage/code in the failure notice. A fixed-metadata `capture-status.json` in Application Support/Intera contains app/runtime/OS/architecture and the diagnostic. It contains no raw exception text, source names, device identifiers, keys, account details, audio or transcripts.
- Keep a source-list failure as the original failure rather than replacing it with the browser's subsequent rejection. Report ended tracks and processing failures without claiming a denied permission.
- The local playback diagnostic now waits for optional storage restoration to finish and records the actual capture stage. It never uploads audio to Soniox.

Verification at implementation:
- Typecheck/lint passed; 108 unit tests and eight desktop UI tests passed. The diagnostic-privacy test rejects arbitrary stages, exception text and audio/transcript fields.
- Local Windows synthetic playback probe returned **FAIL / unavailable capture**, specifically `validate-tracks / DeadAudioTrack`, zero packets; no provider upload. This verifies the diagnostic path, not successful Windows or Mac capture. It must not be reported as a permission denial or successful live audio test.
- Mac packaged runner playback and physical M1/macOS 13.1 reproduction remain separate. No provider-paid live translation test, driver installation, microphone fallback, audio rerouting or new Apple signing identity was performed.

Owner test after installing beta.9: quit the previous app, replace the complete Applications bundle from the matching DMG, open Settings → Audio, play ordinary test speech and start the local playback test. Send only Capture stage, Error code and macOS screen permission. A successful test needs delivered packets and an audible signal while minimized, followed by stable Stop. Only then test actual English/Bosnian transcription and translation using the owner's authorized personal Soniox key. No patient details are needed.

Root cause is unresolved until that evidence is available. Do not disable privacy controls, delete saved data or reset every application's permissions as a guess.

References: [pinned Electron display handler](https://github.com/electron/electron/blob/v44.4.5/docs/api/session.md#sessetdisplaymediarequesthandlerhandler-opts), [getDisplayMedia errors](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia#exceptions).

The Mac runner probe uses a separate afplay process with a generated four-second stereo PCM tone. Player launch/exit status is recorded; no output-device or meeting success is inferred from process launch alone.

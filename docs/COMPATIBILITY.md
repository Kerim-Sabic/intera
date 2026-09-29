# Compatibility and native release procedure

Targets: Windows 11 x64; macOS 14.2+ ARM64 and Intel on hardware supported by the selected Electron runtime. Linux is not a release target. No assumption about a user's Mac model is made.

## macOS

The Forge bundle includes NSAudioCaptureUsageDescription, a display-capture explanation and an input-mode usage description reserved for a future selected-input adapter. Hardened-runtime entitlements include JIT and audio input. Signing and notarization require external credentials. A development run launched from a terminal may attribute capture permission to that terminal; use a generated `.app` for packaged permission testing. A dead silent stream can result from absent permission metadata: packet delivery and an audible playback sample must both be checked.

Native capture is rejected below 14.2. Electron runtime support and native playback support are different claims. A user-installed virtual audio device with a headphone-preserving multi-output configuration is a possible legacy approach, but selected-input capture is **not implemented in this build**. Intera does not install drivers or alter OS audio routing.

## Manual release matrix

On each physical target test development and packaged apps, then fill TEST-REPORT.md with exact hardware/OS/build/meeting/headphone combinations:

1. Key absent: local playback test works without network requests. No microphone indicator or physical mic prompt.
2. Authorized Zoom/Teams/browser meeting: original English and Bosnian plus two-way translations through headphones. Other app playback remains audible and is honestly in capture scope.
3. Denied/revoked capture, device unplug/change, Bluetooth change: stop visibly, never fallback to mic.
4. Covered/minimized for 10 minutes: packets continue; meeting audio uninterrupted.
5. Speed/Balanced/Accuracy-first/Custom: compare actual provider request configs, staged apply and new-epoch boundaries; no automatic retuning.
6. Pause/Stop/quit/last user window closed: no further acquisition/upload, bounded final drain, meeting transport/mic unaffected.
7. Sleep/lock: pause; no automatic capture restart. Renderer crash must not create a new session.
8. Network loss, invalid key, quota, provider finish timeout, two-hour soak: record real technical evidence, never synthetic PASS.
9. Inspect native window controls, keyboard navigation, high contrast, 150% scale, long Bosnian strings, selected text and scrolled-back behavior.

No release certification follows from CI, unit tests or the local synthetic-tone diagnostic alone.

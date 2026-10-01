# Beta.8 startup repair and diagnostic limits

Reported: beta.7 on an M1 Mac/macOS 13.1 appears briefly in the Dock and exits. The owner subsequently supplied `FATAL ... electron_main_delegate_mac.mm ... Unable to find helper app`, followed by GPU/network subprocess exits. This establishes native helper lookup failure; secure-storage restoration is not its root-cause fix. Whether the installed copy has missing helper files, mismatched metadata or a Mac-specific path failure is still **unconfirmed**. Passing macOS 15 CI does not resolve the physical Mac report.

Implemented:
- The reader and IPC now open before optional secure-storage restoration. A ten-second deadline leaves the reader/demo/settings usable when Keychain or a saved meeting cannot be read. Late results cannot overwrite a newly supplied session key. No saved files are deleted and there is no plaintext fallback.
- Reopening a running app reveals a hidden/minimized reader, or creates one if it was closed. This also applies to macOS Dock activation.
- Startup failure records only a fixed phase and app/runtime/OS metadata in `~/Library/Application Support/Intera/startup-status.json`. No exception stack, credentials, file contents, meeting text or account identity is logged. A failure before JavaScript starts cannot create this file; use the native Terminal/crash report instead.
- Opening message requested by the owner: “I love you Nadin”, dismissible and automatically hidden after eight seconds. It does not gate startup or listening.
- Optional `--session-only` diagnostic launch avoids secure-storage access entirely. Existing keys/meetings are untouched, key persistence and meeting saving are unavailable, and any entered key lasts only for that process.

Run the installed executable to see the Mac's actual exit reason:

```bash
"/Applications/Intera.app/Contents/MacOS/Intera"
```

In beta.8, compare with this secure-storage-free diagnostic:

```bash
"/Applications/Intera.app/Contents/MacOS/Intera" --session-only
```

Quit any already-running Intera first: a second launch activates the existing process and does not change its mode. Share only the short error/exception description, not a complete private crash log or credentials. Do not delete Application Support, reset Keychain or disable Gatekeeper to guess at this failure.

Verified locally: `npm run typecheck`, `npm run lint`, `npm test` (104 passed), `npm run test:ui` (eight passed, Mac package test skipped on Windows). The new real Electron test holds storage restoration forever and proves the first reader, greeting, demo, timeout recovery and hidden-window reactivation still work. A macOS-only branch verifies reader recreation after closing its window when run by native CI. Timer tests verify resolution/deadline cleanup and rejection before a late storage result.

Not run at implementation: reproduction on the user's physical M1/macOS 13.1; native crash diagnosis; live Soniox translation; Apple-trusted distribution and signed updates. New beta.8 native builds are collected separately from beta.7 evidence. No release/main merge or production deployment is authorized by this repair.

References: [Electron app lifecycle](https://www.electronjs.org/docs/latest/api/app), [Electron secure storage](https://www.electronjs.org/docs/latest/api/safe-storage). Keychain access and changing ad-hoc signatures can require renewed owner permission; that is a possible startup dependency, not a proven explanation for a native crash.

## Observed beta.8 Apple Silicon evidence

Source `c2c8bca13af928153531e419b6513bc6fea3c454`, [run 36852935446](https://github.com/Kerim-Sabic/intera/actions/runs/36852935446). The arm64 job passed 104 unit tests and nine desktop/package tests on macOS 15.7.9. App, DMG and ZIP round-trip strict bundle verification passed. The app remains ad-hoc signed and Gatekeeper rejected it; notarization is not claimed. Playback diagnostic still returned FAIL/unavailable capture with zero packets; no Soniox audio was uploaded.

The downloaded arm64 ZIP was independently inspected without executing it on Windows. CFBundleName and executable are Intera; all four helper binaries (base, Renderer, GPU, Plugin) exist under their expected bundle names, each has matching CFBundleExecutable, executable mode 0755 and no erroneous ElectronMainProcess flag. Electron framework symlink targets are present in the archive. This verifies the shipped archive, not the owner's installed filesystem.

[Beta.8 M1/Apple Silicon installer](https://github.com/Kerim-Sabic/intera/actions/runs/36852935446/artifacts/11157015098), [native evidence](https://github.com/Kerim-Sabic/intera/actions/runs/36852935446/artifacts/11156109565). Quit Intera, extract the Actions download, open its DMG, drag the entire Intera.app to Applications and Replace, then eject the image. Saved Application Support data is not deleted by replacing the app. Do not copy only its main executable.

Owner inspection, read-only:

```bash
ls -1 "/Applications/Intera.app/Contents/Frameworks"
/usr/libexec/PlistBuddy -c 'Print :CFBundleName' "/Applications/Intera.app/Contents/Info.plist"
```

Compare installed helper names with the app's bundle name. These two outputs have no keys or conversation text. No physical Mac resolution is claimed until the installed-file evidence or a successful owner retest is available.
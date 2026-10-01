# Beta.8 startup repair and diagnostic limits

Reported: beta.7 on an M1 Mac/macOS 13.1 appears briefly in the Dock and exits. No terminal output or native crash report has been received, so the physical Mac root cause is **unconfirmed**. Passing macOS 15 CI does not resolve this report.

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

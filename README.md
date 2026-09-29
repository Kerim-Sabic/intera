# Intera

English ↔ Bosnian desktop interpreter copilot. Electron + React + strict TypeScript. The human interpreter reads the original and translation and delivers the interpretation. Intera does not speak into or control the meeting.

**Development build, not a clinically validated or release-certified product.** Windows loopback sample delivery is verified locally. Live Soniox transcription/translation, actual meeting combinations and physical Mac capture require the release checks in [docs/TEST-REPORT.md](docs/TEST-REPORT.md).

## Run

Requires Node 22.12+ and npm. Use the committed npm lockfile.

```sh
npm ci
npm run dev
npm run demo
npm run typecheck
npm run lint
npm test
npm run test:ui
npm run diagnostics:capture
npm run build
npm run package
npm run make
```

`dev` builds and opens the real desktop app. `demo` uses deterministic synthetic provider events and is permanently labeled. `diagnostics:capture` plays a quiet four-second synthetic tone, tests actual computer playback locally, minimizes the app, then stops. It does not connect to Soniox. Close other audio applications first if you want an isolated diagnostic.

## First use

1. Settings → Connection: select your Soniox project’s region, save preferences, then add its personal API key. Optional validation calls the models API without uploading audio.
2. Audio → Start local playback test. Play an authorized sound and confirm packets and meter movement, then Stop. All playback is in scope. No physical microphone is acquired.
3. Performance: choose Speed, Balanced, Accuracy-first or Custom. Set live-draft visibility separately. Save. Preferences survive restart.
4. Start listening and review the transmission authorization. Both transcription and translation use Soniox `stt-rt-v5` over one request.

Speed/accuracy profiles alter real endpoint settings; they do not change model size, fidelity or packet pacing. Accuracy-first is an intention, not a measured superiority claim. Active request and staged preferences are separate. Reconnecting may leave a gap. “When I pause” applies on Resume; “Next session” remains staged across Pause/Resume.

OS-protected key persistence uses Electron’s asynchronous secure storage. Session-only keys are supported. Never commit a key or put one in renderer environment variables. Local device owners can still access their own keys.

## Build outputs

On Windows, `npm run make` generates `out/Intera-win32-x64/Intera.exe`, a ZIP and a Squirrel Setup installer under `out/make/`. On macOS it generates `.app`, `.dmg`, and ZIP artifacts. Build on the target platform. The CI matrix configures ARM64 and Intel Mac builds, but configuration is not proof that those jobs or devices passed.

Apple signing/notarization: supply `APPLE_SIGN_IDENTITY`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` from your protected build environment. Windows signing: `WINDOWS_CERT_FILE`, `WINDOWS_CERT_PASSWORD`. No signing credentials are bundled. Unsigned artifacts must not be described as signed or notarized. Do not disable OS protections.

## Opt-in provider checks

Use the same authorized English/Bosnian sample, raw **48 kHz stereo PCM16 little-endian**, at most 120 seconds. Do not pass a WAV container as raw PCM. Set `SONIOX_API_KEY` and `SONIOX_REGION` only in your shell’s environment.

```sh
npm run smoke -- --authorized --file=authorized.pcm
npm run compare -- --authorized --file=authorized.pcm
```

Smoke runs Balanced once. Comparison runs three sequential repetitions per profile with 80 ms real-time pacing. It prints only technical arrival metrics, no speech or key. Paint latency and reference-based accuracy remain missing/not evaluated. No auto-selection of a winning profile.

See [architecture](docs/ARCHITECTURE.md), [settings](docs/SETTINGS.md), [compatibility](docs/COMPATIBILITY.md), and [requirements/evidence](docs/TEST-REPORT.md). This build does not complete every feature in the master brief; remaining software work is explicitly listed in the report.

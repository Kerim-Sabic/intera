<p align="center">
  <img src="assets/brand/masters/wordmark.svg" alt="Intera" width="260">
</p>

<h1 align="center">Read the original. Deliver the meaning.</h1>

<p align="center">
  A desktop companion for human English ↔ Bosnian interpreters.<br>
  Follow meeting speech and its translation side by side. You remain the voice in the room.
</p>

<p align="center">
  <a href="#try-the-demo">Try the demo</a> ·
  <a href="docs/SONIOX-SETUP-FOR-USERS.md">Connect Soniox</a> ·
  <a href="#beta-status">Beta status</a> ·
  <a href="CONTRIBUTING.md">Contribute</a>
</p>

<p align="center">
  <a href="https://github.com/Kerim-Sabic/intera/actions/workflows/build.yml"><img src="https://github.com/Kerim-Sabic/intera/actions/workflows/build.yml/badge.svg?branch=main" alt="Desktop build status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-6D91BB" alt="Apache 2.0 license"></a>
</p>

![Actual Intera desktop demo with synthetic English and Bosnian turns](docs/images/reader-demo-light.png)

*The running Electron app with labeled synthetic conversation. No meeting audio was captured or sent for this screenshot.*

> **Internal beta:** You can run the demo today. Funded live Soniox translation and physical Mac capture still need end-to-end verification. There is no signed public release. Intera assists a human interpreter; it is not an autonomous interpreter or a clinically validated product.

## Built for the interpreter's workflow

When a speaker changes direction or returns later, an interpreter needs the original words, the translation, and the order in which they arrived. Intera puts them in one chronological reading view. It copies **computer playback**; it does not join, speak into, or control the meeting.

- **Keep the source in sight.** Read English ↔ Bosnian source and translation together; see which words are still drafts and which have settled.
- **Find your place again.** Follow speaker turns, search, pin a snapshot, mark a passage interpreted, correct text, or jump back to live after scrolling.
- **Fit your reading pace.** Choose Speed, Balanced, Accuracy-first, or Custom processing; set source and translation sizes, spacing, theme, and draft visibility independently.
- **Stay out of the meeting's way.** Use a compact, always-on-top reader and explicit Start, Pause, and Stop controls. Export the text when finished.

Intera captures all computer playback while listening, including notifications. It does not request the physical microphone in meeting-playback mode. Only share audio you are authorized to process.

## Try the demo

You need **Node.js 22.12+** and npm on **Windows 11 x64** or **macOS 14.2+**. Linux is not a release target.

```sh
git clone https://github.com/Kerim-Sabic/intera.git
cd intera
npm ci
npm run demo
```

The demo uses twelve varied synthetic turns. It requires no Soniox account, payment, key, or audio capture. It is the fastest way to inspect the reader, compact mode, and settings.

## Connect your own Soniox account

For real authorized audio, follow the illustrated [Soniox setup guide](docs/SONIOX-SETUP-FOR-USERS.md). In the app, choose **Set up Intera → Pay Soniox directly**. The guide walks through project creation, billing review, a scoped key, the region choice, and a local playback test.

In that mode, the user funds their own Soniox API account and pastes a project key into Intera's masked field. Soniox bills the user for API use; Intera adds no usage fee. The key can be kept for this session or stored with the operating system's secure storage. A key check does not verify credit or live access. Existing Intera account/subscription work is separate and remains behind service readiness gates.

<details>
<summary>Dark theme and compact reader</summary>

![Actual Intera dark-theme demo with synthetic English and Bosnian turns](docs/images/reader-demo-dark.png)

![Actual Intera compact demo showing the beginning of a multiline translation](docs/images/compact-demo.png)

Both screenshots are from the running Electron app with labeled synthetic content.
</details>

## How it works

1. With your authorization, Intera copies computer playback locally. It does not request the physical microphone in meeting-playback mode.
2. During a personal-key live session, the trusted desktop process sends that audio to your selected Soniox region. The interface never receives your API key; the audio does not pass through Intera's billing server.
3. The reader shows the original and translation together. Intera stores preferences and, if requested, an encrypted key on this device. It does not provide cloud transcript history.

See [architecture](docs/ARCHITECTURE.md) and [direct-payment boundaries](docs/DIRECT-SONIOX.md) for implementation details.

## Beta status

| Area | Current evidence |
| --- | --- |
| Demo, settings, onboarding, reader, compact mode | Automated Electron UI checks with synthetic conversation |
| Windows computer-playback capture | Local synthetic-tone samples arrived while minimized; Stop ended capture |
| Windows and Mac packaging | CI builds Windows x64, Apple Silicon, and Intel Mac artifacts |
| Live paid Soniox transcription and translation | **Not yet verified with a funded user account** |
| Physical Mac meeting/headset capture | **Not yet verified** |
| Public distribution | **Not ready:** builds are unsigned; signing, notarization, and release checks remain |

CI build success is evidence of packaging, not evidence that live capture works on every machine. [Compatibility and release checks](docs/COMPATIBILITY.md) and the [beta evidence report](docs/MANAGED-BETA-EVIDENCE.md) record the practical limits. No public checkout or automatic overage charging is enabled.

## Develop

```sh
npm ci
npm run dev                 # build and open the desktop app
npm run typecheck
npm run lint
npm test
npm run test:ui
npm run diagnostics:capture # local synthetic playback, no provider upload
npm run make                # unsigned packages for your current platform
```

The desktop is Electron + React + strict TypeScript. The optional managed-account server uses TypeScript, Supabase, and a separate allowance ledger; it is not needed for the demo or personal Soniox mode. Never commit keys, patient details, recordings, or real transcripts. See [CONTRIBUTING.md](CONTRIBUTING.md) for a focused first contribution.

## Project and license

Intera is a beta being built in the open. Bug reports, accessibility feedback, and reproducible platform evidence are especially useful. The next priorities are live-provider verification, physical Mac/Windows meeting tests, and signed distribution. If this interpreter-first approach is useful to you, **star the repository to follow its progress**. Use the [issue templates](.github/ISSUE_TEMPLATE) for general feedback and [private reporting guidance](SECURITY.md) for security concerns.

Created by **Kerim Sabic** as a **Horalix** project. The code and original repository artwork are licensed under [Apache 2.0](LICENSE); attribution is recorded in [NOTICE](NOTICE). The license does not grant rights to use the Intera or Horalix names or marks to imply endorsement. Third-party packages keep their own licenses; no Soniox, Electron, Whop, or Apple affiliation is claimed.

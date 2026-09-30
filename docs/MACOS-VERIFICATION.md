# macOS reliability investigation — beta.4

The reported machine is a MacBook Air M1 (2020), 8 GB, macOS 13.1. The reported symptom is “Intera is damaged and cannot be opened” after copying from the DMG to Applications. No diagnostic from that physical machine has been obtained; do not claim its exact cause or that it is fixed there.

## Task and evidence checklist

- [x] Inspect the actual main branch and pinned packaging/runtime code.
- [x] Research Ventura playback support against Electron 44.4.5 / Chromium 152.0.7977.130.
- [x] Implement Ventura capture admission, actionable errors, fail-closed signing and installer integrity checks.
- [ ] Inspect the exact previously downloaded artifact on macOS and compare the new artifact.
- [ ] Execute packaged launch, reader, compact view and restart tests on ARM64 and Intel Mac runners.
- [ ] Test physical M1 macOS 13.1 playback, permissions, headset, meeting, sleep and live Soniox.
- [ ] Supply owner-controlled Developer ID credentials; notarize, staple and assess the distribution build.

## Findings and changes

**Launch and capture are separate failures.** The old Intera gate rejected playback below 14.2 only when starting capture, so it cannot explain a pre-launch “damaged” alert. The old workflow packaged installers but did not verify the finished code signature, install-container integrity, extracted bundle, or packaged launch. Packager's installed implementation defaults `osxSign.continueOnError` to true. This build explicitly sets it false.

**Ventura has a native playback path.** Electron 44 requires macOS 13+, not 14.2+. Its pinned Chromium selects CoreAudio taps only when supported, otherwise creates a ScreenCaptureKit audio input stream. Intera now permits macOS 13–14.1 through that runtime path and retains the native tap path at 14.2+. No undocumented feature flag, microphone fallback, driver installation or audio rerouting is introduced. This is an implemented compatibility target pending physical verification, not a claim of universal Mac support.

**Mac beta bundles are re-signed after mutation.** Forge renames Electron and modifies metadata/resources. All nested code and the app are signed using the installed `@electron/osx-sign` traversal. Internal builds use `identity: '-'`, disabled identity lookup, no timestamp and no hardened runtime; a supplied Developer ID uses hardened runtime and the limited JIT/audio entitlements. Signature errors fail packaging. Ad-hoc signatures provide integrity but do not establish developer trust. Gatekeeper rejection remains expected for quarantined beta downloads. Do not call these notarized releases or direct users to disable Gatekeeper.

**Capture failure handling is explicit.** Ended tracks and absent playback tracks fail before an AudioContext/provider stream is created. Denied/dead Mac audio directs users to the privacy pane appropriate to their OS and requests an explicit restart. Capture never falls back to the physical microphone. A startup exception produces a visible error instead of an unhandled initialization rejection.

## Reproducible checks

On either native Mac architecture, with Node 22.12+:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run make -- --arch=arm64 # use x64 on an Intel Mac
node scripts/verify-mac.mjs out
INTERA_MAC_EXECUTABLE=out/Intera-darwin-arm64/Intera.app/Contents/MacOS/Intera npx playwright test tests/ui/mac-package.spec.ts
npx playwright test tests/ui/desktop.spec.ts tests/ui/direct-soniox.spec.ts tests/ui/visual.spec.ts
INTERA_CAPTURE_EXECUTABLE=out/Intera-darwin-arm64/Intera.app/Contents/MacOS/Intera npx tsx scripts/capture-diagnostic.ts --packaged
```

`verify-mac.mjs` checks strict/deep signature integrity, architectures and required plist fields; verifies DMGs; checks ZIP integrity and extracted apps; records SHA256 sums and actual Gatekeeper assessment. Deep verification is used for verification only, not as a shortcut for signing. Set `INTERA_REQUIRE_NOTARIZED=1` for a distribution candidate: Gatekeeper rejection then fails the check. Evidence lives in `test-results/mac`, with local capture in `test-results/capture-packaged.json`. Failed/unavailable capture returns nonzero and remains distinct from passing UI tests. A hosted runner may lack usable audio hardware or permission interaction.

CI tests both macOS 15 ARM64 and Intel; it does not reproduce macOS 13.1, a physical headset, or a real meeting. Screenshots use 12 labeled synthetic turns. A successful local tone diagnostic proves local sample delivery only. No provider request or payment is made by those tests.

## Physical M1 acceptance

Use the new **arm64** artifact. Confirm version/SHA in About, compare its SHA256 sum, mount the DMG, copy Intera to Applications and eject it. Record the exact launch alert and macOS version. If it says damaged, stop and collect the bundle verification below; do not remove quarantine to conceal a failed signature.

```sh
codesign --verify --deep --strict --verbose=4 /Applications/Intera.app
codesign --display --verbose=4 /Applications/Intera.app
spctl --assess --type execute --verbose=4 /Applications/Intera.app
```

These read-only commands contain no API key. Share their results without private account details. An ad-hoc build can pass `codesign` but fail Gatekeeper; only Developer ID signing plus notarization can supply the standard trusted distribution path.

After legitimate installation/approval, open Settings → Audio and run the local playback test while playing authorized speech. On 13.1 grant Intera Screen Recording in System Settings → Privacy & Security, quit/reopen it and repeat. Verify nonzero level and continuing packets with speakers, wired and Bluetooth headsets, covered/minimized windows. Then test Start/Pause/Resume/Stop, denied permission, output change, sleep/lock and quit; verify the meeting continues and no physical microphone permission is requested. Finally test actual English/Bosnian audio with the owner's authorized Soniox key; record original/translation, real latency and provider usage. No fabricated measurements or automatic account charges.

## Owner-only distribution prerequisites

Apple Developer membership, a Developer ID Application certificate/private key and notarization credentials must be provided through a protected local environment/keychain or CI secret store. No purchase or enrollment has been made. Existing Forge settings accept `APPLE_SIGN_IDENTITY`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`; the identity must already be present in the build machine's keychain. Partial notarization configuration now fails early. Do not publish a paid/public Mac release until the native matrix, signing and notarization pass.

## Primary references (checked 2026-09-30)

- [Electron 44 OS support](https://www.electronjs.org/blog/electron-44-0)
- [Pinned Electron capture guidance](https://github.com/electron/electron/blob/v44.4.5/docs/api/desktop-capturer.md)
- [Pinned Chromium loopback selection](https://github.com/chromium/chromium/blob/152.0.7977.130/media/audio/mac/audio_manager_mac.cc)
- [ScreenCaptureKit stream implementation](https://github.com/chromium/chromium/blob/152.0.7977.130/media/audio/mac/audio_loopback_input_mac_impl.mm)
- [Forge signing and notarization](https://www.electronforge.io/guides/code-signing/code-signing-macos)
- [Apple's launch warning distinctions](https://support.apple.com/en-au/102445)
- [Apple Gatekeeper](https://support.apple.com/en-ca/guide/security/sec5599b66df/web)

Current live/latest docs can change. This decision is pinned to Electron 44.4.5; future runtime upgrades must recheck the capture implementation and both native architectures.

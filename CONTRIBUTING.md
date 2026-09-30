# Contributing to Intera

Intera is an internal beta for human English/Bosnian interpreters. Useful contributions improve reading clarity, accessibility, capture reliability, provider error handling, or the accuracy of our documentation.

## Before you start

- Check the [README](README.md), [compatibility notes](docs/COMPATIBILITY.md), and existing issues before opening a large change.
- For a bug, include the Intera version, operating system, exact steps, expected behavior, and observed behavior. Say whether the audio was a synthetic local test or an authorized live provider session.
- Keep personal details, API keys, financial information, recordings, patient information, and real transcripts out of issues, commits, screenshots, and test fixtures.
- Do not use generated screenshots as evidence of a running app. Label synthetic conversation content and state which hardware/provider checks actually ran.

## Work locally

Use Node.js 22.12+ and the committed lockfile:

```sh
npm ci
npm run demo
npm run typecheck
npm run lint
npm test
npm run test:ui
```

`npm run demo` opens a clearly labeled synthetic conversation and needs no provider key. `npm run diagnostics:capture` checks local computer-playback delivery with a synthetic tone and never uploads audio. Keep any Soniox key in your own secure environment or the app's masked key field; never add it to test fixtures.

## Make a focused pull request

1. Explain the user-facing problem and the behavior after your change.
2. Add or update only tests that verify the relevant behavior. Include screenshots from the running Electron app for visible changes, with synthetic content clearly labeled.
3. Report the exact commands and platforms you tested. A passing build on CI does not prove capture or translation on physical hardware.
4. Keep production checkout, public admission, signing, and release settings untouched unless that work is explicitly coordinated with the maintainers.

Contributions submitted for inclusion are handled under the repository's [Apache 2.0 license](LICENSE). Please make sure you have the right to submit your code and artwork. The license does not grant permission to use the Intera or Horalix names to imply endorsement.

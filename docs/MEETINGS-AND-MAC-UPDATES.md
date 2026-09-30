# Meeting workspace beta.7

## Supplied glossary

Settings → Languages → Browse supplied medical & insurance preset opens the owner's working edition 1.0 workbook, supplied as `Bosnian_English_Medical_Insurance_Glossary.xlsx`. There are 2,192 English/Bosnian working records and 2,192 records in its explicit reverse index. Notes, alternatives, categories, entry status and source references are preserved in the local catalog. Original, revision-log and excluded/error archives are not active mappings. The glossary is owner-supplied; its sources and medical translations were not independently revalidated in this build.

Search, filter by category/direction, select up to 100 mappings, Load selected terms, review/edit, then Apply glossary while stopped. A separate reverse entry is necessary for the opposite direction. Context notes stay visible in the reference library; they are not silently inserted as substitutions. Only the selected mappings and up to 100 unique recognition phrases go to Soniox at the next connection. The full workbook is never uploaded. Duplicate mapping sources are rejected rather than silently choosing a meaning. Saving the generic glossary persists the current selection locally.

Provenance: original workbook filename and SHA256 are in `src/shared/glossary-catalog.json`. The user's request authorizes integration; third-party reference pages are provenance, not a claim of clinical validation or endorsement. No font or other third-party media is added.

Reproduce extraction with Python's standard library, from the repository root:

```text
python scripts/import-glossary.py "path/to/Bosnian_English_Medical_Insurance_Glossary.xlsx"
```

The importer checks working index headers, reads the workbook without modifying it, and emits the packaged local catalog. It deliberately fails if the index layout changes.

## Meetings

Your meetings is available from the folder button in the toolbar or Settings. Stop & save meeting drains already-sent audio, then stores the current text, original/draft distinctions, pins, manual edits, interpreted snapshots and speaker names. New meeting clears the reader and waits for an explicit Start. Opening a saved meeting is review-only; a new meeting is required before capture. Edited saved text can be saved as a new snapshot.

Storage is local only, encrypted with Electron safeStorage using the current device's secure storage. Both titles and text are encrypted; no plaintext title index is created. Generic glossary settings remain separate. No recordings, account tokens, billing credentials or provider keys are in meeting files. This is manual saving, not automatic clinical record retention. Save only authorized text, use generic titles, and use the Delete action to remove a local snapshot. Exported copies/backups are separate. Lost access to the OS key store can make encrypted meetings unreadable; the app does not silently delete corrupt/unreadable files or fall back to plaintext. Current limits are 100 saved meetings and 8 MB of JSON per snapshot.

## Floating reader and sharing

Settings → Window opens the compact reader and controls always-on-top. It opens without intentionally taking focus. Request exclusion from screen capture applies Electron `setContentProtection` to all reader/settings windows and restores that preference across restart.

This is a best-effort OS request, **not an invisible mode guarantee**. Electron documents that modern macOS applications using ScreenCaptureKit can capture protected windows. Windows capture exclusion also depends on OS/capture method. Share a specific meeting window or a separate display; verify the actual audience preview. No screen-sharing application is modified, no privacy controls are bypassed, and there is no claim of Cluely-equivalent exclusion.

Primary reference: https://www.electronjs.org/docs/latest/api/browser-window#winsetcontentprotectionenable-macos-windows

## Mac automatic updates

The native Electron autoUpdater path is implemented with a fixed HTTPS Intera repository feed:

```text
https://update.electronjs.org/Kerim-Sabic/intera/darwin-ARCH/VERSION
```

The renderer cannot select an update URL or repository. Automatic checks are disabled for unpackaged, unsigned/ad-hoc, unapproved or non-Mac builds. At build time, `INTERA_MAC_UPDATES_APPROVED=1` requires the existing full Apple signing/notarization configuration. It records only the public team ID and an approval boolean, never Apple secrets. Runtime initialization additionally checks the actual bundle with strict codesign verification, Gatekeeper assessment and expected team identity. The existing native updater checks replacement signatures. ATS stays enabled.

After genuine release readiness and authorization, publish same-team signed/notarized Mac ZIPs for both arm64 and x64 to GitHub Releases with architecture-bearing Forge names. This task **does not publish a release**. One genuine signed/notarized installation is required before unsigned beta users can use this channel. Successful CI artifacts alone are not an update feed. Keep the approval flag off until the release has met the repository's live translation, native compatibility and distribution requirements.

Eligible builds check while idle at startup and every six hours. Downloads do not trigger a restart dialog during speech. Restart to update is explicit, blocked during capture, and requires the reader to be saved or cleared. Update errors leave the current app in place. For a real signed two-version test, verify architecture, signature/team rejection, interrupted download recovery, saved meeting preservation, and restart on a physical Mac. This end-to-end replacement test is **NOT RUN**: signing/notarization credentials and an approved release channel are unavailable.

Primary references:
- https://www.electronjs.org/docs/latest/api/auto-updater
- https://github.com/electron/update.electronjs.org

## Evidence

Implemented: supplied glossary library, encrypted manual meeting storage, review/new-meeting flow, floating preference, best-effort capture protection, gated native Mac updater and update settings.

Configured: source catalog derived from supplied working/reverse sheets. No production release or live update channel configured.

Local verification: TypeScript/lint, storage encryption/tamper/path validation, update-feed validation and catalog preservation tests. Desktop tests cover save/restart/open/delete, duplicate glossary protection, supplied selection, native always-on-top/content-protection flags and blocked updater. Real screenshots use twelve synthetic turns; they do not prove physical Mac sharing exclusion or translation quality.

Not run: signed two-version Mac update installation, real meeting share/audience preview on physical Mac and Windows, independent medical glossary review, and resolution of the earlier live Mac translation report. These remain separate from the implemented UI and local tests.

### Exact local checks

- `python scripts/import-glossary.py <owner workbook>` — imported 4,384 directional entries; workbook unchanged.
- `npm run typecheck` and `npm run lint` — passed.
- `npm test` — 102 passed, including encrypted storage/tamper/path tests and gated updater controls.
- `npm run test:ui` — seven passed; native Mac packaged-app test skipped on Windows. Actual running-app screenshots: `test-results/meetings/{library,supplied-glossary,floating-sharing,updates-blocked,floating-dark,floating-narrow-150}.png`. These are synthetic UI evidence, not live meeting recordings.
- Native beta.7 CI builds: pending at this report's commit. Apple identity/notarization and actual shared-screen audience tests are not substituted with mocked updater or API-flag tests.

No main merge, signed release publication, production deployment or payment occurred.

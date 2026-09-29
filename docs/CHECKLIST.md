# Execution and release checklist

- [x] Inspect repository (empty on clone); verify Soniox v5 and Electron capture documentation.
- [x] Implement dedicated playback capture host, trusted provider connection and safe lifecycle.
- [x] Implement validated profiles, preferences, transcript state and revision controls.
- [x] Build initial workspace, setup settings and compact window (remaining full-brief features in report).
- [x] Run strict typecheck, lint, unit and Electron visual tests.
- [x] Produce Windows package and installer; configure native macOS CI.
- [x] Verify real local Windows playback samples in development and packaged app, including minimized capture.
- [ ] Real Soniox playback vertical slice (requires authorized audio and personal key).
- [ ] Physical Mac ARM64 / Intel and Windows meeting capture release checks.
- [ ] Signing, notarization and two-hour streaming soak.

Unchecked native gates are not implied by build or mock test success. See TEST-REPORT.md.

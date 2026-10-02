# Beta.10 implementation evidence

Built from the follow-up branch `codex/gaze-companion`, based on beta.9 source `227dc18d0cf360473c9bb1fb1ef4e9f57aec42d2`. Despite the original branch name, this change implements an internal development worker and panel, not a companion launcher. No merge to main, production deployment or release publication.

## IMPLEMENTED

Internal gaze worker and controls; source/license retention; reviewed-model/digest readiness gate; bounded local frame protocol; worker ownership, stop and timeout behavior. Actual engine code wraps the linked project. Models are deliberately not bundled, and installed-app preview remains unavailable. See INTEGRATED-EYE-CONTACT.md for the exact missing native implementation.

Playback acquisition now has a bounded 30-second initialization grace period instead of terminating source discovery at six seconds. Validated format starts the separate six-second packet deadline. The Mac synthetic playback probe waits for acquisition or an explicit failure before playing its tone. This fixes a test timing problem and premature timeout, not proof that physical Mac capture is repaired.

## VERIFIED LOCALLY — Windows workstation

- `npm run typecheck` PASS.
- `npm run lint` PASS.
- `npm test` PASS: 114 tests, 20 files. Includes concurrent worker start, missing models, startup and hung inference timeouts, preview clearing/late-message fencing, and bounded capture acquisition. Synthetic workers; no webcam inference evidence.
- `python -m unittest discover -s camera -p test_worker.py` PASS: 3 tests. Approval/digest/traversal boundaries and validated controls with synthetic files; these fixtures grant no approval to real model assets.
- `npm run test:ui` PASS: 9 tests; native Mac package test skipped on Windows. The eye-contact panel remains disabled without a packaged engine; no camera or audio stream starts through that panel.

## CONFIGURED / VERIFIED LIVE / VERIFIED SANDBOX

No new external configuration, charges, identity approvals, provider requests or sandbox payments in this change. No live camera verification. Existing billing/auth configuration is unchanged.

## NOT RUN / BLOCKED

Real model inference, licensed weight redistribution, signed native Intera Camera extension, actual Zoom receiving corrected video, Mac camera activation/permissions, M1 performance and concurrent camera/translation are not verified. Native extension and runtime packaging are **not implemented**, not merely awaiting a user permission prompt. Developer ID/provisioning and a physical Mac are unavailable here. macOS `27.01` was reported by the owner; its exact system version was not independently measured.

Earlier beta.9 ARM CI reported source-list stage, screen permission granted and zero playback packets. That failure is retained as failure evidence. Beta.10 native CI and owner playback/translation retest are pending; a green packaging job alone is insufficient to claim full Mac support.

# Settings contract (schema version 1)

All imported root/config objects are strict. Unknown keys, invalid enums, non-finite numbers, out-of-range controls, conflicting glossary entries and profile/name mismatches are rejected. Version 1 is the initial schema; no previous released schema exists to migrate. Unsupported versions recover to safe defaults, without copying credentials into backups.

| Setting | Default / validation | Persistence and effect | Apply/reset | Evidence |
|---|---|---|---|---|
| Profile | Balanced; Speed/Balanced/Accuracy-first/Custom | OS account preferences; maps actual endpoint fields | Reconnect / Resume / next session; restore Balanced | config + lifecycle tests |
| Endpoint | true, 2000 ms, 0, 0 | Custom permits 500–3000 integer ms, integer 0–3, sensitivity -1…1 | Connection-level; natural finalization omits fields | exact request tests |
| Provider defaults | detection off; enabled-field defaults 2000/0/0 | Separate Custom action, not app default | Explicit Save | mapper tests |
| Drafts | true | Independent display only; persisted | Immediate across windows | UI + lifecycle tests |
| Original size | 17, integer 14–24 px | Display only; persisted | Immediate | schema, UI large font |
| Translation size | 23, integer 18–36 px | Display only; persisted | Immediate | schema, UI large font |
| Source visibility | true | Display only; persisted | Immediate | schema |
| Theme | system; light/dark | Display only; persisted | Immediate | UI screenshots |
| Region | us; eu/jp/in allowlist | Saved outside presets; account capability required | Stop active capture first; never fail over | strict schema |
| Mode | two_way; bs/en/none | Two-way / explicit target / transcription only | Connection-level | mapper tests |
| Language restriction | false | Fixed en/bs hints, identification always on | Connection-level | mapper tests |
| Speaker labels | true | Provider diarization; IDs scoped to epoch | Connection-level | reducer tests |
| Packet duration | 80; 40/80/120 ms | Independent transport choice, same fidelity | Connection-level | worklet test (80 ms) |
| Named presets | up to 20, names 1–40 characters | Endpoint settings only; no keys/region/context | Save/load/delete; same-name save replaces | strict schema; UI |
| Glossary | empty plus small generic domain hints | RAM unless explicitly saved generic; 100 terms/mappings maximum; 100 chars each | Stop first; replacing empty clears | duplicate/conflict tests |
| Credentials | absent | Main-process async OS encryption or session only | Stop first; explicit Forget | no read-key bridge; live-key checks NOT RUN |

Settings import uses a native Open action and a visible preview followed by Save. Export includes preferences only, never keys, audio, speech, glossary or session edits. Restore processing defaults leaves credentials, drafts and transcript intact.

The `onboarded` field is reserved at false in this first schema; setup readiness is derived from credentials and local capture health, not a misleading completed-setup flag. Reading layout automatically stacks on narrow windows. Additional localization, density, spacing, timestamp/highlight controls, configurable/global shortcuts and window-restoration preferences from the master brief are not yet implemented. They are not shown as cosmetic controls.

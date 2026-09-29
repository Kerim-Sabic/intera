# Architecture and verified API decisions

Reviewed 2026-09-29. Versions are pinned in package.json and package-lock.json: Electron 44.4.5, Forge 7.11.2, React 19.3.0, Vite 8.3.1. Runtime is a maintained Electron version resolved from npm during this build.

## Ownership

- `main/main.ts`: one application instance, windows, IPC authorization, explicit export, OS events and credential routing.
- `main/coordinator.ts`: authoritative request epoch, active/pending/saved configuration, audio format, bounded queue, stream, lifecycle and canonical text.
- `capture/`: hidden sandboxed capture host, independent of React. Only `getDisplayMedia` is used. No `getUserMedia` call exists. Display media is routed to loopback, never loopback-with-mute. The host is destroyed immediately on Stop; its tracks and context are released by destruction. A blocked permission promise cannot recreate the host after Stop.
- `pcm-worklet.js`: approximately 80 ms PCM16 packets at the actual AudioContext rate, stereo interleaved L/R or mono. No custom resampler, VAD, base64, microphone fallback or denoising. Worklet in-flight packets and main/WebSocket backlog are bounded. Exhaustion becomes a visible stopped/error gap.
- `shared/config.ts`: one Zod mapper. Presets exactly specify v5 endpoint controls; disabled detection omits tuning parameters.
- `shared/transcript.ts`: incremental finalized append / provisional replacement, epoch/event rejection, separate source/translation, snapshots and manual edits.
- `preload.ts`: narrow commands and ordered top-level patches, with snapshot recovery on a sequence gap. Renderer never receives a raw credential or arbitrary filesystem/IPC capability.

The hidden host has a dedicated session. Electron labels the display acquisition’s permission request `media` on the tested Windows runtime; the host grants that permission only during an active coordinator operation. This does not select or acquire a physical microphone. Visible renderers deny device permissions and permit only clipboard writes. Navigation/new windows are denied. No remote renderer content is loaded. All transcript text is rendered as React text nodes.

## Protocol

One `wss` connection, fixed allowlisted regional endpoint. First frame is validated configuration + trusted-process authentication; following frames are binary audio. Stop immediately destroys capture and drops unsent queue, sends the documented empty end-of-audio frame for already-open connections, and accepts final results for at most 3 seconds. Closed epochs reject later callbacks. Manual finish sends `{"type":"finalize"}` only on explicit action. Continuous silent PCM keeps a live request active; Pause closes the request instead of paying for keepalives. No invented hot updates or replay of already-sent audio.

Transient errors stop visibly and require explicit Resume/Start in this build; automatic retries are not implemented. Duration warnings start at 295 minutes; Pause is forced by 299 minutes ahead of the provider’s documented 300-minute limit.

## SDK evaluation

Downloaded and inspected official `@soniox/node@2.3.0` declarations and implementation before writing the reducer. `RealtimeUtteranceBuffer.addResult()` collects stable segments; `markEndpoint()` flushes an utterance. This is an endpoint-driven helper, not a guaranteed fine-grained source/translation pairing API. Direct documented WebSocket transport was chosen for explicit socket backlog/drain control. The application reducer renders without endpoint events. It deliberately retains larger speaker/language groups per connection where exact alignment is unavailable, and displays unpaired translation when metadata is missing. These groups are not precise sentence-level or fully chronological turn segmentation; improving grouping is a remaining release item.

## Official references

- [Soniox WebSocket API](https://soniox.com/docs/api-reference/stt/websocket-api): v5 config, token fields, finish semantics and limit.
- [Endpoint controls](https://soniox.com/docs/stt/rt/endpoint-detection): ranges and defaults.
- [Streaming translation](https://soniox.com/docs/translation/stt-translation/rt-translation): tagged streams and absent translation timestamps.
- [Manual finalization](https://soniox.com/docs/stt/rt/manual-finalization) and [keepalive](https://soniox.com/docs/stt/rt/connection-keepalive).
- [Regions](https://soniox.com/docs/data-residency) and [models validation](https://soniox.com/docs/api-reference/stt/get_models).
- [Electron capture](https://www.electronjs.org/docs/latest/api/desktop-capturer), [session permissions](https://www.electronjs.org/docs/latest/api/session), [asynchronous safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).

Electron documentation contains a mismatch: the session page still describes loopback as Windows-only, while desktopCapturer documents macOS Core Audio taps from v39 onward. macOS functionality therefore remains a physical-device release gate, not an inferred PASS.

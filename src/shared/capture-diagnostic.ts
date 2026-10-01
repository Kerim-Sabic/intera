import {z} from 'zod';
export const captureDiagnosticSchema=z.object({stage:z.enum(['capture-host','source-list','acquire','validate-tracks','audio-context','worklet','audio-graph','context-resume','ready','cleanup']),code:z.enum(['NotAllowedError','InvalidStateError','NotFoundError','NotReadableError','AbortError','OverconstrainedError','TypeError','SecurityError','NoPlaybackTrack','DeadAudioTrack','SourceEnded','UnsupportedChannels','AudioFormatChanged','QueueOverflow','CaptureFailure','CaptureHostLoadFailed','SourceListFailed','NoDisplaySource']).optional()}).strict();
export type CaptureDiagnostic=z.infer<typeof captureDiagnosticSchema>&{screenPermission?:'granted'|'denied'|'not-determined'|'restricted'|'unknown'};
export class CaptureStartupError extends Error{}

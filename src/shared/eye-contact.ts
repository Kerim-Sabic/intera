export const gazeProject='https://github.com/WangWilly/gaze-correction-cam';
export const gazeRelease='https://github.com/WangWilly/gaze-correction-cam/releases/tag/v1.0.1-alpha';
import {z} from 'zod';
export type EyeContactView={supported:boolean;installed:boolean;checked:boolean;status:'off'|'starting'|'preview'|'error';message:string};
export const gazeSettingsSchema=z.object({camera:z.number().int().min(0).max(8),enabled:z.boolean(),offsetX:z.number().min(-30).max(30),offsetY:z.number().min(-40).max(40),offsetZ:z.number().min(-20).max(20),focalLength:z.number().min(300).max(1500)}).strict();
export type GazeSettings=z.infer<typeof gazeSettingsSchema>;
export const gazeDefaults:GazeSettings={camera:0,enabled:true,offsetX:0,offsetY:-21,offsetZ:-1,focalLength:650};
export const gazeEventSchema=z.discriminatedUnion('type',[z.object({type:z.literal('ready')}).strict(),z.object({type:z.literal('frame'),jpeg:z.string().min(4).max(700000).regex(/^[A-Za-z0-9+/]+={0,2}$/)}).strict(),z.object({type:z.literal('error'),code:z.enum(['models','camera','engine'])}).strict()]);
export function gazeSupported(platform:string,version:string){const match=/^(\d+)\.(\d+)(?:\.\d+)?$/.exec(version);return platform==='darwin'&&!!match&&Number(match[1])>=14;}

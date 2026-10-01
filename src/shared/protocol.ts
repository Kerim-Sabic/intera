import {gazeSettingsSchema} from './eye-contact';
import type {EyeContactView} from './eye-contact';
import type {CaptureDiagnostic} from './capture-diagnostic';
import type {MeetingSummary} from './meetings';
import type {UpdateView} from './updates';
import type {TranslationHealth} from './translation-health';
import { z } from 'zod';
import {preferencesSchema,glossarySchema,regionSchema,type Preferences,type Processing,type AudioFormat,type Glossary} from './config';
import type {Transcript} from './transcript';
import type {BillingCommand,BillingReply} from './billing';
export type Status='idle'|'connecting'|'listening'|'paused'|'stopping'|'stopped'|'error'|'local-test';
export type State={eyeContact?:EyeContactView;captureDiagnostic?:CaptureDiagnostic;storageLoading?:boolean;meetings?:MeetingSummary[];savedMeeting?:string;meetingReview?:boolean;meetingStorageError?:string;windowOptions?:{floating:boolean;protection:boolean};updates?:UpdateView;glossary?:Glossary;translationHealth?:TranslationHealth;managed?:{reservedMs:number;provisionalMs:number;boundaryReached?:boolean;finalizing:boolean;region:Preferences['region']};sequence:number;status:Status;demo:boolean;preferences:Preferences;effective:Processing|null;pending:{config:Processing;timing:'pause'|'next'}|null;transcript:Transcript;keyStored:boolean;secureStorage:boolean;message:string;meter:number;packets:number;audio:AudioFormat|null;names:Record<string,string>;hold:Transcript|null;platform:string;captureHealth:string;networkHealth:string};

export const commandSchema=z.discriminatedUnion('type',[
  z.object({type:z.enum(['start','demo','pause','stop','clear','finish','compact','hold','local-test','cancel-pending','validate-key','forget-key','import-settings','export-settings','new-meeting','check-updates','install-update','gaze-check','gaze-stop','gaze-activate','gaze-output'])}).strict(),
  z.object({type:z.enum(['gaze-start','gaze-configure']),settings:gazeSettingsSchema}).strict(),
  z.object({type:z.literal('save-meeting'),title:z.string().trim().min(1).max(120)}).strict(),
  z.object({type:z.enum(['open-meeting','delete-meeting']),id:z.uuid()}).strict(),
  z.object({type:z.literal('window-options'),floating:z.boolean(),protection:z.boolean()}).strict(),
  z.object({type:z.literal('preferences'),preferences:preferencesSchema,timing:z.enum(['now','pause','next'])}).strict(),
  z.object({type:z.literal('key'),key:z.string().trim().min(1).max(512),persist:z.boolean()}).strict(),
  z.object({type:z.literal('connect-personal'),key:z.string().trim().min(1).max(512),persist:z.boolean(),region:regionSchema}).strict(),
  z.object({type:z.literal('provider-page'),page:z.enum(['console','pricing','keys','regions'])}).strict(),
  z.object({type:z.literal('group'),id:z.string().max(100),action:z.enum(['pin','interpreted','edit']),edit:z.object({source:z.string().max(30000),translation:z.string().max(30000)}).strict().optional()}).strict(),
  z.object({type:z.literal('rename'),id:z.string().max(100),name:z.string().trim().min(1).max(60)}).strict(),
  z.object({type:z.literal('export'),format:z.enum(['txt','json'])}).strict(),
  z.object({type:z.literal('glossary'),glossary:glossarySchema,save:z.boolean()}).strict()
]);
export type Command=z.infer<typeof commandSchema>;
export type Bridge={gazeFrames:(callback:(jpeg:string)=>void)=>()=>void;billing:(command:BillingCommand)=>Promise<BillingReply>;snapshot:()=>Promise<State>;command:(command:Command)=>Promise<{ok:boolean;message?:string;preview?:Preferences}>;subscribe:(callback:(s:State)=>void)=>()=>void};
declare global{interface Window{intera:Bridge}}


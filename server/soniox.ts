import {z} from 'zod';
import {regionSchema,regions,destination} from '../src/shared/config';

export const usageRecord=z.object({uuid:z.uuid(),request_scope:z.literal('api'),client_reference_id:z.string().nullable(),
 model:z.string(),start_time:z.iso.datetime(),end_time:z.iso.datetime(),input_audio_duration_ms:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
 cost_usd:z.string().regex(/^\d{1,20}(\.\d{1,10})?$/)});
export type UsageRecord=z.infer<typeof usageRecord>;
export type StreamConfig={enabled:boolean;region:z.infer<typeof regionSchema>;projectRef:string;key:string;accounts:Set<string>;maxSeconds:number};
export function streamConfiguration(env:NodeJS.ProcessEnv):StreamConfig{
 return {enabled:env.MANAGED_INTERNAL_BETA==='true',region:regionSchema.parse(env.SONIOX_REGION??'us'),projectRef:env.SONIOX_PROJECT_REF??'',key:env.SONIOX_API_KEY??'',
  accounts:new Set((env.MANAGED_BETA_ACCOUNT_IDS??'').split(',').filter(Boolean).map(v=>z.uuid().parse(v.trim()))),
  maxSeconds:z.coerce.number().int().min(60).max(18000).parse(env.MANAGED_MAX_SESSION_SECONDS??1800)};
}
export interface SpeechProvider{
 issue(reference:string,seconds:number):Promise<{api_key:string;expires_at:string}>;
 logs(start:string,end:string,cursor?:string):Promise<{usage_logs:UsageRecord[];next_page_cursor:string|null}>;
 check():Promise<void>;
 summary?(start:string,end:string):Promise<string>;
}
export class SonioxProvider implements SpeechProvider{
 constructor(readonly config:StreamConfig){}
 private async request(path:string,body?:unknown){
  const r=await fetch(`https://api${regions[this.config.region]}.soniox.com/v1/${path}`,{method:body?'POST':'GET',redirect:'error',headers:{Authorization:`Bearer ${this.config.key}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10_000)});
  if(!r.ok)throw new Error('Soniox service request failed.');return r.json();
 }
 async issue(reference:string,seconds:number){return z.object({api_key:z.string().min(1),expires_at:z.iso.datetime()}).parse(await this.request('auth/temporary-api-key',{
  usage_type:'transcribe_websocket',expires_in_seconds:30,single_use:true,max_session_duration_seconds:seconds,client_reference_id:reference}));}
 async logs(start:string,end:string,cursor?:string){const query=new URLSearchParams({start_time:start,end_time:end,sort:'end_time_asc',limit:'1000',...(cursor?{cursor}:{})});return z.object({usage_logs:z.array(usageRecord),next_page_cursor:z.string().nullable().optional().default(null)}).parse(await this.request(`usage-logs?${query}`));}
 async check(){await this.request('models');const end=new Date(),start=new Date(end.getTime()-60_000);await this.logs(start.toISOString(),end.toISOString());}
 async summary(start:string,end:string){const query=new URLSearchParams({start_time:start,end_time:end});return z.object({total:z.object({total_cost_usd:z.string().regex(/^\d+(\.\d{1,10})?$/)})}).parse(await this.request(`usage/summary?${query}`)).total.total_cost_usd;}
 endpoint(){return destination(this.config.region);}
}
export function exactCost(value:string){if(!/^\d+(\.\d{1,10})?$/.test(value))throw new Error('Invalid exact cost.');const [whole,fraction='']=value.split('.');return BigInt(whole)*10_000_000_000n+BigInt(fraction.padEnd(10,'0'));}

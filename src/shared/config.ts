import { z } from 'zod';
export const BRAND = 'Intera';
export const endpointSchema = z.object({ enabled:z.boolean(), delay:z.number().int().min(500).max(3000), level:z.number().int().min(0).max(3), sensitivity:z.number().min(-1).max(1) }).strict();
export type Endpoint = z.infer<typeof endpointSchema>;
export const profiles = {
  Speed:{enabled:true,delay:1000,level:2,sensitivity:0.3},
  Balanced:{enabled:true,delay:2000,level:0,sensitivity:0},
  'Accuracy-first':{enabled:true,delay:3000,level:0,sensitivity:-0.3}
} satisfies Record<string,Endpoint>;
export const descriptions = {Speed:'Finalize earlier for quicker turn-taking. May split thoughts sooner.',Balanced:'A middle ground between responsiveness and time to revise.','Accuracy-first':'Finalize less aggressively and tolerate longer pauses. Completed text may arrive later.',Custom:'Choose the processing behavior yourself.'};
export const regionSchema = z.enum(['us','eu','jp','in']);
export const regions = {us:'',eu:'.eu',jp:'.jp',in:'.in'};
export function destination(region:z.infer<typeof regionSchema>) { return `wss://stt-rt${regions[region]}.soniox.com/transcribe-websocket`; }
export const processingSchema = z.object({profile:z.enum(['Speed','Balanced','Accuracy-first','Custom']),endpoint:endpointSchema,mode:z.enum(['two_way','bs','en','none']),strict:z.boolean(),speakers:z.boolean(),packetMs:z.union([z.literal(40),z.literal(80),z.literal(120)])}).strict().superRefine((p,c)=>{if(p.profile!=='Custom' && (Object.keys(p.endpoint) as (keyof Endpoint)[]).some(k=>p.endpoint[k]!==profiles[p.profile as keyof typeof profiles][k])) c.addIssue({code:'custom',message:'Profile settings must match its name'});});
export type Processing = z.infer<typeof processingSchema>;
export const presetSchema=z.object({name:z.string().trim().min(1).max(40),endpoint:endpointSchema}).strict();
export const preferencesSchema=z.object({version:z.literal(1),processing:processingSchema,drafts:z.boolean(),sourceSize:z.number().int().min(14).max(24),translationSize:z.number().int().min(18).max(36),theme:z.enum(['system','light','dark']),showSource:z.boolean(),region:regionSchema,presets:z.array(presetSchema).max(20),onboarded:z.boolean()}).strict();
export type Preferences=z.infer<typeof preferencesSchema>;
export const defaults:Preferences={version:1,processing:{profile:'Balanced',endpoint:profiles.Balanced,mode:'two_way',strict:false,speakers:true,packetMs:80},drafts:true,sourceSize:17,translationSize:23,theme:'system',showSource:true,region:'us',presets:[],onboarded:false};
export const glossarySchema=z.object({terms:z.array(z.string().trim().min(1).max(100)).max(100),translations:z.array(z.object({source:z.string().trim().min(1).max(100),target:z.string().trim().min(1).max(100)}).strict()).max(100)}).strict().superRefine((g,c)=>{if(new Set(g.terms.map(t=>t.toLowerCase())).size!==g.terms.length || new Set(g.translations.map(t=>t.source.toLowerCase())).size!==g.translations.length)c.addIssue({code:'custom',message:'Duplicate or conflicting glossary terms'});});
export type Glossary=z.infer<typeof glossarySchema>;
export const emptyGlossary:Glossary={terms:[],translations:[]};
export const audioSchema=z.object({sampleRate:z.number().int().min(8000).max(96000),channels:z.union([z.literal(1),z.literal(2)])}).strict();
export type AudioFormat=z.infer<typeof audioSchema>;
export function providerConfig(processing:Processing,audio:AudioFormat,glossary:Glossary=emptyGlossary){
  const p=processingSchema.parse(processing),a=audioSchema.parse(audio),g=glossarySchema.parse(glossary);
  return {model:'stt-rt-v5',audio_format:'pcm_s16le',sample_rate:a.sampleRate,num_channels:a.channels,language_hints:['en','bs'],language_hints_strict:p.strict,enable_language_identification:true,enable_speaker_diarization:p.speakers,
    enable_endpoint_detection:p.endpoint.enabled,...(p.endpoint.enabled?{max_endpoint_delay_ms:p.endpoint.delay,endpoint_latency_adjustment_level:p.endpoint.level,endpoint_sensitivity:p.endpoint.sensitivity}:{}),
    ...(p.mode==='none'?{}:{translation:p.mode==='two_way'?{type:'two_way',language_a:'en',language_b:'bs'}:{type:'one_way',target_language:p.mode}}),
    context:{general:[{key:'domain',value:'Medical conversation'},{key:'language preference',value:'Bosnian Latin, ijekavian'}],terms:g.terms,translation_terms:g.translations}};
}
export function selectProfile(p:Processing,profile:Processing['profile']):Processing{return {...p,profile,endpoint:profile==='Custom'?{...p.endpoint}:{...profiles[profile]}};}

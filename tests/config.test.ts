import {describe,it,expect} from 'vitest';
import {defaults,profiles,providerConfig,selectProfile,preferencesSchema,glossarySchema} from '../src/shared/config';
describe('provider mapper',()=>{
 for(const name of ['Speed','Balanced','Accuracy-first'] as const)it(`sends exact ${name} configuration`,()=>{
  const config=providerConfig(selectProfile(defaults.processing,name),{sampleRate:48000,channels:2});
  expect(config).toEqual({model:'stt-rt-v5',audio_format:'pcm_s16le',sample_rate:48000,num_channels:2,language_hints:['en','bs'],language_hints_strict:false,enable_language_identification:true,enable_speaker_diarization:true,enable_endpoint_detection:true,max_endpoint_delay_ms:profiles[name].delay,endpoint_latency_adjustment_level:profiles[name].level,endpoint_sensitivity:profiles[name].sensitivity,translation:{type:'two_way',language_a:'en',language_b:'bs'},context:{general:[{key:'domain',value:'Medical conversation'},{key:'language preference',value:'Bosnian Latin, ijekavian'}],terms:[],translation_terms:[]}});
 });
 it('omits all endpoint parameters in natural finalization',()=>{const config=providerConfig({...defaults.processing,profile:'Custom',endpoint:{...profiles.Balanced,enabled:false}},{sampleRate:44100,channels:1});expect(config.enable_endpoint_detection).toBe(false);expect(config).not.toHaveProperty('max_endpoint_delay_ms');expect(config).not.toHaveProperty('endpoint_latency_adjustment_level');expect(config).not.toHaveProperty('endpoint_sensitivity');});
 it('custom starts from current profile and round trips',()=>{const custom=selectProfile(selectProfile(defaults.processing,'Speed'),'Custom');expect(custom.endpoint).toEqual(profiles.Speed);expect(preferencesSchema.parse(JSON.parse(JSON.stringify({...defaults,processing:custom,drafts:false})))).toEqual({...defaults,processing:custom,drafts:false});});
 it.each([NaN,Infinity,-1,499,3001])('rejects invalid delay %s',delay=>expect(()=>providerConfig({...defaults.processing,profile:'Custom',endpoint:{...profiles.Balanced,delay}},{sampleRate:48000,channels:2})).toThrow());
 it('rejects unknown preferences and mismatched profiles',()=>{expect(()=>preferencesSchema.parse({...defaults,url:'https://bad.test'})).toThrow();expect(()=>preferencesSchema.parse({...defaults,processing:{...defaults.processing,profile:'Speed'}})).toThrow();});
 it('rejects conflicting glossary mappings',()=>expect(()=>glossarySchema.parse({terms:[],translations:[{source:'dose',target:'doza'},{source:'Dose',target:'x'}]})).toThrow());
 it('transcription-only does not send translation block',()=>expect(providerConfig({...defaults.processing,mode:'none'},{sampleRate:48000,channels:1})).not.toHaveProperty('translation'));
});

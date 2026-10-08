import {describe,it,expect} from 'vitest';
import {defaults,preferencesSchema,processingSchema,providerConfig} from '../src/shared/config';
import {languageCodes,directionLabel} from '../src/shared/languages';
import {initialTranslationHealth,receiveTranslationHealth,checkTranslationHealth} from '../src/shared/translation-health';
import type {Token} from '../src/shared/transcript';
const audio={sampleRate:48000,channels:2} as const;
const token=(from:string,to?:string):Token=>({text:'Synthetic',is_final:true,language:to??from,source_language:to?from:undefined,translation_status:to?'translation':'original'});
describe('selected meeting languages',()=>{
 it('supports one selected language for transcription without translation',()=>{
  const p=processingSchema.parse({...defaults.processing,mode:'none',languageA:'ar',languageB:'ar'});
  const config=providerConfig(p,audio);expect(config.language_hints).toEqual(['ar']);expect(config.translation).toBeUndefined();expect(directionLabel(p)).toBe('Arabic · transcription');
 });
 it('maps every distinct pair in the published 60-language catalog and restricts recognition',()=>{
  expect(languageCodes).toHaveLength(60);
  for(const languageA of languageCodes)for(const languageB of languageCodes){if(languageA===languageB)continue;
   const config=providerConfig({...defaults.processing,languageA,languageB,strict:false},audio);
   expect(config.translation).toEqual({type:'two_way',language_a:languageA,language_b:languageB});
   expect(config.language_hints).toEqual([languageA,languageB]);expect(config.language_hints_strict).toBe(true);
   expect(config.context.general.some(h=>h.value==='Bosnian Latin, ijekavian')).toBe(languageA==='bs'||languageB==='bs');
  }
 });
 it('uses only the selected spoken and target languages in one-way mode',()=>{
  const processing={...defaults.processing,mode:'one_way' as const,languageA:'ja' as const,languageB:'bs' as const,targetLanguage:'ar' as const};
  const config=providerConfig(processing,audio);
  expect(config.language_hints).toEqual(['ja','ar']);expect(config.translation).toEqual({type:'one_way',target_language:'ar'});
  expect(directionLabel(processing)).toBe('Japanese → Arabic');
  expect(config.context.general).toEqual([{key:'domain',value:'General conversation'}]);
 });
 it('rejects unsupported codes and equal translation languages before a connection',()=>{
  expect(processingSchema.safeParse({...defaults.processing,languageA:'invented'}).success).toBe(false);
  expect(processingSchema.safeParse({...defaults.processing,languageB:'en'}).success).toBe(false);
  expect(processingSchema.safeParse({...defaults.processing,mode:'one_way',targetLanguage:'en'}).success).toBe(false);
 });
 it('opens old preferences without resetting reading preferences or legacy one-way modes',()=>{
  const old=JSON.parse(JSON.stringify(defaults));delete old.processing.languageA;delete old.processing.languageB;delete old.processing.targetLanguage;delete old.processing.domain;old.processing.mode='en';old.translationSize=31;
  const migrated=preferencesSchema.parse(old);expect(migrated.translationSize).toBe(31);
  expect(providerConfig(migrated.processing,audio).translation).toEqual({type:'one_way',target_language:'en'});
  expect(migrated.processing.languageA).toBe('en');
 });
 it('does not let output in one direction hide another stalled direction',()=>{
  const p={...defaults.processing,languageA:'fr' as const,languageB:'ar' as const};
  let h=receiveTranslationHealth(initialTranslationHealth(),[token('fr'),token('ar')],0,p);
  h=receiveTranslationHealth(h,[token('fr','ar')],21000,p);
  expect(h.stalled).toBe(true);expect(h.waitingByLanguage).toEqual({ar:0});
  h=receiveTranslationHealth(h,[token('ar','fr')],22000,p);expect(h.stalled).toBe(false);expect(h.waitingSince).toBeNull();
 });
 it('does not report untranslated target speech or speech outside the selected pair as a stall',()=>{
  const p={...defaults.processing,mode:'one_way' as const,languageA:'ja' as const,targetLanguage:'ar' as const};
  expect(checkTranslationHealth(receiveTranslationHealth(initialTranslationHealth(),[token('ar')],0,p),30000).stalled).toBe(false);
  expect(checkTranslationHealth(receiveTranslationHealth(initialTranslationHealth(),[token('fr')],0,defaults.processing),30000).stalled).toBe(false);
 });
});

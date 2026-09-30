import {describe,it,expect} from 'vitest';
import {initialTranslationHealth,receiveTranslationHealth,checkTranslationHealth} from '../src/shared/translation-health';
import {initialTranscript,beginEpoch,reduceTokens,type Token} from '../src/shared/transcript';
import {providerConfig,defaults} from '../src/shared/config';
const source=(language:string,text='Synthetic source'):Token=>({text,language,speaker:language==='en'?'1':'2',is_final:true,translation_status:'original'});
const translation=(from:string,to:string,text='Synthetic translation'):Token=>({text,source_language:from,language:to,speaker:from==='en'?'1':'2',is_final:true,translation_status:'translation'});
describe('bidirectional translation observability',()=>{
 it('preserves both directions through twelve alternating synthetic turns and delayed output',()=>{
  let health=initialTranslationHealth(),transcript=beginEpoch(initialTranscript(),1),event=0;
  for(let i=0;i<12;i++){
   const from=i%2?'bs':'en',to=i%2?'en':'bs';
   const original=source(from,`Source ${i}.`),translated=translation(from,to,`Translation ${i}.`);
   transcript=reduceTokens(transcript,1,++event,[original]);health=receiveTranslationHealth(health,[original],i*3000);
   transcript=reduceTokens(transcript,1,++event,[translated]);health=receiveTranslationHealth(health,[translated],i*3000+2000);
  }
  expect(health).toMatchObject({englishToBosnianTokens:6,bosnianToEnglishTokens:6,sourceTokens:12,translationTokens:12,outsidePairTokens:0});
  const originals=transcript.groups.map(g=>g.source).join(''),translations=transcript.groups.map(g=>g.translation).join('');
  for(let i=0;i<12;i++){expect(originals).toContain(`Source ${i}.`);expect(translations).toContain(`Translation ${i}.`);}
  expect(transcript.groups.filter(g=>g.source).map(g=>g.language)).toEqual(Array.from({length:12},(_,i)=>i%2?'bs':'en'));
  expect(transcript.groups.some(g=>g.unpaired)).toBe(true); // No fabricated returning-speaker alignment.
 });
 it('exposes out-of-pair detection without rewriting language or inventing translation',()=>{
  let health=receiveTranslationHealth(initialTranslationHealth(),[source('hr')],0);
  health=checkTranslationHealth(health,20000);
  expect(health).toMatchObject({latestSourceLanguage:'hr',outsidePairTokens:1,translationTokens:0,stalled:true});
  health=receiveTranslationHealth(health,[source('bs'),translation('bs','en')],21000);
  expect(health).toMatchObject({latestSourceLanguage:'bs',outsidePairTokens:1,bosnianToEnglishTokens:1,stalled:false});
 });
 it('does not count missing source-language metadata as verified direction',()=>{
  const token={...translation('bs','en'),source_language:undefined};
  expect(receiveTranslationHealth(initialTranslationHealth(),[token],0)).toMatchObject({translationTokens:1,bosnianToEnglishTokens:0});
 });
 it('does not warn in silence after output catches up, but warns on later untranslated speech',()=>{
  let health=receiveTranslationHealth(initialTranslationHealth(),[source('en'),translation('en','bs')],0);
  expect(checkTranslationHealth(health,60000).stalled).toBe(false);
  health=receiveTranslationHealth(health,[source('bs')],61000);
  expect(checkTranslationHealth(health,62000).stalled).toBe(false);
  expect(checkTranslationHealth(health,81000).stalled).toBe(true);
 });
 it('bounds observed language metadata and ignores control/whitespace tokens',()=>{
  const health=receiveTranslationHealth(initialTranslationHealth(),[source('unexpected'),source('en','<end>'),translation('en','bs',' ')],0);
  expect(health).toMatchObject({latestSourceLanguage:'other',sourceTokens:1,translationTokens:0,outsidePairTokens:1});
  expect(JSON.stringify(health)).not.toContain('Synthetic source');
 });
 it('keeps the same two-way request when recognition restriction is selected',()=>{
  const config=providerConfig({...defaults.processing,strict:true},{sampleRate:48000,channels:2});
  expect(config.language_hints_strict).toBe(true);
  expect(config.translation).toEqual({type:'two_way',language_a:'en',language_b:'bs'});
  expect(config.model).toBe('stt-rt-v5');
 });
});

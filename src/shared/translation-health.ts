import type {Token} from './transcript';
import {languageCodes,languageName,expectsTranslation,selectedLanguages} from './languages';
import type {Processing} from './config';
export type TranslationHealth={sourceTokens:number;translationTokens:number;firstSourceAt:number|null;lastSourceAt:number|null;lastTranslationAt:number|null;waitingSince:number|null;waitingByLanguage:Record<string,number>;stalled:boolean;latestSourceLanguage:string;englishToBosnianTokens:number;bosnianToEnglishTokens:number;outsidePairTokens:number};
export const initialTranslationHealth=():TranslationHealth=>({sourceTokens:0,translationTokens:0,firstSourceAt:null,lastSourceAt:null,lastTranslationAt:null,waitingSince:null,waitingByLanguage:{},stalled:false,latestSourceLanguage:'unknown',englishToBosnianTokens:0,bosnianToEnglishTokens:0,outsidePairTokens:0});
// Track each direction separately: output for A must not mask a stalled B.
// These metadata counts include changing drafts, not words or billed usage.
export function receiveTranslationHealth(previous:TranslationHealth,tokens:Token[],now:number,p?:Processing):TranslationHealth{
 const next={...previous,waitingByLanguage:{...previous.waitingByLanguage}};
 for(const token of tokens){
  if(!token.text.trim()||token.text==='<end>'||token.text==='<fin>')continue;
  if(token.translation_status==='translation'){
   next.translationTokens++;next.lastTranslationAt=now;
   delete next.waitingByLanguage[token.source_language??'unknown'];
   if(token.source_language==='en'&&token.language==='bs')next.englishToBosnianTokens++;
   if(token.source_language==='bs'&&token.language==='en')next.bosnianToEnglishTokens++;
  }else{
   next.sourceTokens++;next.firstSourceAt??=now;next.lastSourceAt=now;
   const language=token.language;
   next.latestSourceLanguage=languageCodes.includes(language as typeof languageCodes[number])?language!:language?'other':'unknown';
   const pair=p?selectedLanguages(p):['en','bs'];
   if(language&&!pair.includes(language))next.outsidePairTokens++;
   if(!p||expectsTranslation(language??'unknown',p))next.waitingByLanguage[language??'unknown']??=now;
  }
 }
 const pending=Object.values(next.waitingByLanguage);
 next.waitingSince=pending.length?Math.min(...pending):null;
 next.stalled=next.waitingSince!==null&&now-next.waitingSince>=20000;
 return next;
}
export function checkTranslationHealth(health:TranslationHealth,now:number):TranslationHealth{
 const stalled=health.waitingSince!==null&&now-health.waitingSince>=20000;
 return stalled===health.stalled?health:{...health,stalled};
}
export function detectedLanguageLabel(language:string):string{return language==='other'?'an unsupported language':languageName(language);}

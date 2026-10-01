import type {Token} from './transcript';
export type TranslationHealth={sourceTokens:number;translationTokens:number;firstSourceAt:number|null;lastSourceAt:number|null;lastTranslationAt:number|null;waitingSince:number|null;stalled:boolean;latestSourceLanguage:'en'|'bs'|'hr'|'sr'|'other'|'unknown';englishToBosnianTokens:number;bosnianToEnglishTokens:number;outsidePairTokens:number};
export const initialTranslationHealth=():TranslationHealth=>({sourceTokens:0,translationTokens:0,firstSourceAt:null,lastSourceAt:null,lastTranslationAt:null,waitingSince:null,stalled:false,latestSourceLanguage:'unknown',englishToBosnianTokens:0,bosnianToEnglishTokens:0,outsidePairTokens:0});
// Metadata only. Counts include revised drafts and are neither words nor usage.
export function receiveTranslationHealth(previous:TranslationHealth,tokens:Token[],now:number):TranslationHealth{
 const next={...previous};
 for(const token of tokens){
  if(!token.text.trim()||token.text==='<end>'||token.text==='<fin>')continue;
  if(token.translation_status==='translation'){
   next.translationTokens++;next.lastTranslationAt=now;next.waitingSince=null;next.stalled=false;
   if(token.source_language==='en'&&token.language==='bs')next.englishToBosnianTokens++;
   if(token.source_language==='bs'&&token.language==='en')next.bosnianToEnglishTokens++;
  }else{
   next.sourceTokens++;next.firstSourceAt??=now;next.lastSourceAt=now;next.waitingSince??=now;
   const language=token.language;
   next.latestSourceLanguage=language==='en'||language==='bs'||language==='hr'||language==='sr'?language:language?'other':'unknown';
   if(language&&language!=='en'&&language!=='bs')next.outsidePairTokens++;
  }
 }
 return next;
}
export function checkTranslationHealth(health:TranslationHealth,now:number):TranslationHealth{
 const stalled=health.waitingSince!==null&&now-health.waitingSince>=20000;
 return stalled===health.stalled?health:{...health,stalled};
}
export function detectedLanguageLabel(language:TranslationHealth['latestSourceLanguage']):string{
 return {en:'English',bs:'Bosnian',hr:'Croatian',sr:'Serbian',other:'a language outside English/Bosnian',unknown:'Not identified yet'}[language];
}

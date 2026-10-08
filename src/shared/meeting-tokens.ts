import {selectedLanguages,translationTarget} from './languages';
import type {Processing} from './config';
import type {Token} from './transcript';
// Provider restrictions are best-effort. Also reject explicitly out-of-selection
// metadata locally. Keep unclassified tokens, visibly labeled as unidentified,
// rather than silently throwing away speech before identification stabilizes.
export function meetingTokens(tokens:Token[],processing:Processing){
 const selected=selectedLanguages(processing);
 return tokens.filter(token=>{
  if(token.text==='<end>'||token.text==='<fin>')return true;
  if(token.translation_status!=='translation')return !token.language||selected.includes(token.language);
  if(processing.mode==='none')return false;
  if(token.source_language&&!selected.includes(token.source_language))return false;
  if(!token.language)return true;
  if(processing.mode!=='two_way')return token.language===translationTarget(processing);
  if(!selected.includes(token.language))return false;
  return !token.source_language||token.language!==token.source_language;
 });
}

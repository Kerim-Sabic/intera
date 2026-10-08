import React from 'react';
import {ArrowLeftRight,Languages} from 'lucide-react';
import {languageCodes,languageNames,directionLabel,translationTarget,type LanguageCode} from '../shared/languages';
import type {Processing} from '../shared/config';

export function LanguagePicker({value,onChange,disabled=false}:{value:Processing;onChange:(value:Processing)=>void;disabled?:boolean}){
 if(value.mode==='en'||value.mode==='bs')value={...value,languageA:value.mode==='en'?'bs':'en',languageB:value.mode,targetLanguage:value.mode,mode:'one_way'};
 const second=value.mode==='two_way'||value.mode==='none'?value.languageB:translationTarget(value) as LanguageCode;
 const single=value.mode==='none'&&value.languageA===second;
 const change=(patch:Partial<Processing>)=>onChange({...value,strict:true,...patch});
 return <div className="language-picker">
  <label>Meeting mode<select disabled={disabled} value={value.mode==='en'||value.mode==='bs'?'one_way':value.mode} onChange={e=>change({mode:e.target.value as Processing['mode'],languageB:second,targetLanguage:second})}>
   <option value="two_way">Conversation · translate both ways</option><option value="one_way">Translate into one language</option><option value="none">Transcription only</option>
  </select></label>
  {value.mode==='none'&&<label className="check"><input type="checkbox" disabled={disabled} checked={single} onChange={e=>change({languageB:e.target.checked?value.languageA:value.languageA==='en'?'bs':'en'})}/>One language only</label>}
  <div className="language-pair">
   <label>{value.mode==='one_way'||single?'Spoken language':'First language'}<select aria-label="First meeting language" disabled={disabled} value={value.languageA} onChange={e=>change({languageA:e.target.value as LanguageCode,...(single?{languageB:e.target.value as LanguageCode}:{})})}>{languageCodes.map(code=><option key={code} value={code}>{languageNames[code]}</option>)}</select></label>
   <button type="button" className="swap-languages" aria-label="Swap meeting languages" disabled={disabled||single} onClick={()=>change({languageA:second,languageB:value.languageA,targetLanguage:value.languageA})}><ArrowLeftRight size={17}/></button>
   <label>{value.mode==='one_way'?'Translate into':'Second language'}<select aria-label="Second meeting language" disabled={disabled||single} value={second} onChange={e=>change({languageB:e.target.value as LanguageCode,targetLanguage:e.target.value as LanguageCode})}>{languageCodes.map(code=><option key={code} value={code}>{languageNames[code]}</option>)}</select></label>
  </div>
  {value.mode!=='none'&&value.languageA===second&&<p className="warning" role="alert">Choose two different languages.</p>}
  <p className="language-summary"><Languages size={16}/>{directionLabel(value)}</p>
  <p className="hint">Recognition is restricted to your selected languages. Other languages are not automatically added. Choose the actual languages spoken for the best results.</p>
 </div>;
}

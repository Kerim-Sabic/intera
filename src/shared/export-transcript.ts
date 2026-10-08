import {displayed,type Transcript} from './transcript';
import {directionLabel,languageName} from './languages';
import type {Processing} from './config';
export function exportTranscript(transcript:Transcript,options:{title?:string;demo:boolean;processing:Processing;names:Record<string,string>}){
 const header=[options.title||'Intera AI meeting',directionLabel(options.processing),options.demo?'SIMULATED DEMO':'Meeting transcript','Unfinished drafts are labeled; they are not finalized provider output.'].join('\n');
 return header+'\n\n'+transcript.groups.map(g=>{
  const text=displayed(g,true),speaker=options.names[`${g.epoch}:${g.speaker}`]??`Speaker ${g.speaker}`;
  return [`[Connection ${g.epoch} · ${speaker} · ${languageName(g.language)}${g.unpaired?' · Alignment unconfirmed':''}]`,g.edit?'Human correction':'Provider output',`Original${!g.edit&&g.sourceDraft?' (includes unfinished draft)':''}: ${text.source}`,`Translation${!g.edit&&g.translationDraft?' (includes unfinished draft)':''}: ${text.translation}`].join('\n');
 }).join('\n\n');
}

import {z} from 'zod';
export const tokenSchema=z.object({text:z.string().max(20000),is_final:z.boolean(),speaker:z.string().max(100).optional(),language:z.string().max(16).optional(),source_language:z.string().max(16).optional(),translation_status:z.enum(['none','original','translation']).optional(),start_ms:z.number().optional(),end_ms:z.number().optional(),confidence:z.number().optional()});
export const responseSchema=z.object({tokens:z.array(tokenSchema).max(10000).default([]),finished:z.boolean().optional(),error_code:z.number().optional(),error_type:z.string().optional()});
export type Token=z.infer<typeof tokenSchema>;
export type Snapshot={source:string;translation:string;revision:number};
export type Group={id:string;epoch:number;speaker:string;language:string;source:string;translation:string;sourceDraft:string;translationDraft:string;revision:number;boundary:boolean;unpaired:boolean;edit?:{source:string;translation:string};pinned?:Snapshot;interpreted?:Snapshot};
export type Transcript={epoch:number;event:number;groups:Group[];serial:number;cursor:Record<string,string>};
export const initialTranscript=():Transcript=>({epoch:0,event:0,groups:[],serial:0,cursor:{}});
export function beginEpoch(s:Transcript,epoch:number):Transcript{return {...s,epoch,event:0,cursor:{},groups:s.groups.map(g=>({...g,sourceDraft:'',translationDraft:'',boundary:true}))};}
// Source turns follow arrival order. Translation has no reliable sentence/turn IDs:
// after a speaker returns, translations for that identity remain explicitly unpaired.
export function reduceTokens(s:Transcript,epoch:number,event:number,tokens:Token[]):Transcript{
  if(epoch!==s.epoch||event<=s.event)return s;
  const next:Transcript={...s,event,cursor:{...s.cursor},groups:s.groups.map(g=>g.sourceDraft||g.translationDraft?{...g,sourceDraft:'',translationDraft:''}:g)};
  for(const t of tokens){
    if(t.text==='<end>'||t.text==='<fin>'){
      if(t.is_final)next.groups=next.groups.map(g=>g.epoch===epoch?{...g,boundary:true}:g);
      continue;
    }
    const translated=t.translation_status==='translation';
    const speaker=t.speaker??'Unknown';const language=(translated?t.source_language:t.language)??'und';
    const key=`${speaker}:${language}`;
    let i=-1;
    if(translated){
      const candidates=next.groups.filter(g=>g.epoch===epoch&&g.speaker===speaker&&g.language===language&&!!(g.source||g.sourceDraft));
      const id=candidates.length===1?candidates[0].id:next.cursor[`translation:${key}`];
      i=next.groups.findIndex(g=>g.id===id);
    }else{
      i=next.groups.findIndex(g=>g.id===next.cursor[key]&&g.id===next.cursor['@source']);
    }
    if(i<0){
      const id=`${epoch}:${++next.serial}`;next.cursor[translated?`translation:${key}`:key]=id;
      next.groups.push({id,epoch,speaker,language,source:'',translation:'',sourceDraft:'',translationDraft:'',revision:0,boundary:false,unpaired:translated});i=next.groups.length-1;
    }
    if(!translated)next.cursor['@source']=next.groups[i].id;
    const g={...next.groups[i]};
    const field=translated?(t.is_final?'translation':'translationDraft'):(t.is_final?'source':'sourceDraft');
    g[field]+=t.text;g.revision++;g.unpaired=!g.source;g.boundary=false;next.groups[i]=g;
  }
  return next;
}
export type DraftVisibility=boolean|{source:boolean;translation:boolean};
export function displayed(g:Group,drafts:DraftVisibility):Snapshot{const source=typeof drafts==='boolean'?drafts:drafts.source,translation=typeof drafts==='boolean'?drafts:drafts.translation;return {source:g.edit?.source??(g.source+(source?g.sourceDraft:'')),translation:g.edit?.translation??(g.translation+(translation?g.translationDraft:'')),revision:g.revision};}
export function changeGroup(s:Transcript,id:string,action:'pin'|'interpreted'|'edit',drafts:DraftVisibility,edit?:{source:string;translation:string}):Transcript{return {...s,groups:s.groups.map(g=>g.id!==id?g:action==='edit'?{...g,edit,revision:g.revision+1}:action==='pin'?{...g,pinned:g.pinned?undefined:displayed(g,drafts)}:{...g,interpreted:displayed(g,drafts)})};}
export function changedAfter(g:Group){return !!g.interpreted&&(g.interpreted.source!==displayed(g,true).source||g.interpreted.translation!==displayed(g,true).translation);}

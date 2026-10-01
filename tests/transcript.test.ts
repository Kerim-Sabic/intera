import {describe,it,expect} from 'vitest';
import {initialTranscript,beginEpoch,reduceTokens,changeGroup,displayed,changedAfter,compactGroup,type Token} from '../src/shared/transcript';
const t=(text:string,final=true,other:Partial<Token>={}):Token=>({text,is_final:final,language:'en',speaker:'1',translation_status:'original',...other});
const initial=()=>beginEpoch(initialTranscript(),1);
describe('faithful streaming state',()=>{
 it('keeps returning speakers chronological and late ambiguous translations unpaired',()=>{let s=reduceTokens(initial(),1,1,[t('A first'),t('B',true,{speaker:'2'}),t('A later')]);expect(s.groups.map(g=>g.source)).toEqual(['A first','B','A later']);s=reduceTokens(s,1,2,[t('uncertain',true,{translation_status:'translation',language:'bs',source_language:'en'})]);expect(s.groups.slice(0,3).every(g=>!g.translation)).toBe(true);expect(s.groups[3]).toMatchObject({translation:'uncertain',unpaired:true});});
 it('replaces hypotheses and preserves genuine repeated words',()=>{let s=reduceTokens(initial(),1,1,[t('no no',false)]);s=reduceTokens(s,1,2,[t('no'),t(' no'),t(' pain',false)]);s=reduceTokens(s,1,3,[t(' fever')]);expect(displayed(s.groups[0],true).source).toBe('no no fever');});
 it('ignores stale epochs and duplicate local events',()=>{const s=reduceTokens(initial(),1,1,[t('hello')]);expect(reduceTokens(s,0,2,[t('bad')])).toBe(s);expect(reduceTokens(s,1,1,[t('bad')])).toBe(s);});
 it('streams final source and draft translations without endpoints',()=>{const s=reduceTokens(initial(),1,1,[t('No pain.'),t('Nema',false,{translation_status:'translation',language:'bs',source_language:'en'})]);expect(displayed(s.groups[0],true)).toMatchObject({source:'No pain.',translation:'Nema'});expect(displayed(s.groups[0],false).translation).toBe('');});
 it('does not attach delayed translations to a different speaker',()=>{let s=reduceTokens(initial(),1,1,[t('one'),t('two',true,{speaker:'2'})]);s=reduceTokens(s,1,2,[t('jedan',true,{translation_status:'translation',language:'bs',source_language:'en'})]);expect(s.groups[0].translation).toBe('jedan');expect(s.groups[1].translation).toBe('');});
 it('keeps unknown-alignment translation unpaired',()=>{const s=reduceTokens(initial(),1,1,[t('word'),t('riječ',true,{translation_status:'translation',speaker:undefined,language:'bs',source_language:undefined})]);expect(s.groups).toHaveLength(2);expect(s.groups[1].unpaired).toBe(true);});
 it('pin and interpreted freeze exact revisions; edits survive late results',()=>{let s=reduceTokens(initial(),1,1,[t('15 mg')]);const id=s.groups[0].id;s=changeGroup(s,id,'pin',true);s=changeGroup(s,id,'interpreted',true);s=reduceTokens(s,1,2,[t(', not 50 mg')]);expect(s.groups[0].pinned?.source).toBe('15 mg');expect(changedAfter(s.groups[0])).toBe(true);s=changeGroup(s,id,'edit',true,{source:'Human correction',translation:'Ispravka'});s=reduceTokens(s,1,3,[t('.')]);expect(displayed(s.groups[0],true).source).toBe('Human correction');expect(s.groups[0].source).toBe('15 mg, not 50 mg.');});
 it('preserves diacritics and different language metadata',()=>{const s=reduceTokens(initial(),1,1,[t('Nisam siguran. 0,5 mg.',true,{language:'bs'}),t('lijek',true,{language:'hr'})]);expect(s.groups.map(g=>g.language)).toEqual(['bs','hr']);});
});

it('compact retains late unpaired translation when a newer source arrives',()=>{
 let s=reduceTokens(initial(),1,1,[t('First'),t('Second',true,{speaker:'2'}),t('First again')]);
 s=reduceTokens(s,1,2,[t('Kasni prevod',true,{translation_status:'translation',language:'bs',source_language:'en'})]);
 const translated=s.groups.at(-1)!;
 s=reduceTokens(s,1,3,[t('New speech',true,{speaker:'2'})]);
 expect(compactGroup(s.groups,true)?.id).toBe(translated.id);
 expect(compactGroup(s.groups,true)?.unpaired).toBe(true);
 const resumed=reduceTokens(beginEpoch(s,2),2,1,[t('New connection')]);
 expect(compactGroup(resumed.groups,true)?.source).toBe('New connection');
});
it('compact respects draft visibility and pinned snapshots',()=>{
 let s=reduceTokens(initial(),1,1,[t('First'),t('Prvi',true,{translation_status:'translation',language:'bs',source_language:'en'})]);
 s=reduceTokens(s,1,2,[t('Second',true,{speaker:'2'}),t('Drugi',false,{speaker:'2',translation_status:'translation',language:'bs',source_language:'en'})]);
 expect(compactGroup(s.groups,{source:true,translation:false})?.translation).toBe('Prvi');
 expect(compactGroup(s.groups,true)?.source).toBe('Second');
 s=changeGroup(s,s.groups[1].id,'pin',false);
 expect(compactGroup(s.groups,true)?.source).toBe('First');
});

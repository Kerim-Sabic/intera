import {it,expect} from 'vitest';
import {defaults} from '../src/shared/config';
import {exportTranscript} from '../src/shared/export-transcript';
import {visualFixture} from '../src/shared/visual-fixture';
import {meetingTokens} from '../src/shared/meeting-tokens';
it('exports unfinished translation, human corrections and speaker names without hiding drafts',()=>{
 const transcript=visualFixture();transcript.groups[0].edit={source:'مرحبا',translation:'Hello'};
 const text=exportTranscript(transcript,{demo:true,title:'Practice',processing:defaults.processing,names:{'1:1':'Host'}});
 expect(text).toContain('Practice');expect(text).toContain('Host');expect(text).toContain('مرحبا');expect(text).toContain('SIMULATED DEMO');
 expect(text).toContain('Translation (includes unfinished draft): Da. Donesite obrazac…');
});
it('rejects explicitly unselected source and translation languages locally',()=>{
 const p={...defaults.processing,languageA:'fr' as const,languageB:'ar' as const};
 const source={text:'Bonjour',language:'fr',is_final:true};
 const foreign={text:'Unexpected',language:'en',is_final:true};
 const translated={text:'مرحبا',source_language:'fr',language:'ar',translation_status:'translation' as const,is_final:true};
 const wrong={...translated,language:'ja'};
 expect(meetingTokens([source,foreign,translated,wrong],p)).toEqual([source,translated]);
 expect(meetingTokens([{text:'<end>',is_final:true},{text:'Unidentified',is_final:false}],p)).toHaveLength(2);
 expect(meetingTokens([translated],{...p,mode:'none'})).toEqual([]);
});

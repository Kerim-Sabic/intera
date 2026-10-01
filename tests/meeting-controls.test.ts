import {it,expect} from 'vitest';
import {commandSchema} from '../src/shared/protocol';
import {macUpdateFeed} from '../src/shared/updates';
import catalog from '../src/shared/glossary-catalog.json';
it('restricts meeting and native window commands to validated data',()=>{
 expect(commandSchema.safeParse({type:'open-meeting',id:'../../secrets'}).success).toBe(false);
 expect(commandSchema.safeParse({type:'window-options',floating:true,protection:true,url:'https://evil.test'}).success).toBe(false);
 expect(commandSchema.parse({type:'save-meeting',title:'Synthetic'})).toEqual({type:'save-meeting',title:'Synthetic'});
});
it('pins Mac update feeds to the Intera repository and supported architecture',()=>{
 expect(macUpdateFeed('arm64','0.2.0-beta.7')).toBe('https://update.electronjs.org/Kerim-Sabic/intera/darwin-arm64/0.2.0-beta.7');
 expect(()=>macUpdateFeed('../../evil','1.0.0')).toThrow();expect(()=>macUpdateFeed('x64','https://evil.test')).toThrow();
});
it('preserves both working indexes and excludes original/error archives from the supplied preset',()=>{
 expect(catalog.entries.filter(e=>e.direction==='en-bs')).toHaveLength(2192);expect(catalog.entries.filter(e=>e.direction==='bs-en')).toHaveLength(2192);
 expect(catalog.entries.every(e=>e.source.length<=100&&e.target.length<=100)).toBe(true);
 expect(catalog.entries.some(e=>e.notes.length>0)).toBe(true);expect(catalog.sha256).toMatch(/^[a-f0-9]{64}$/);
});

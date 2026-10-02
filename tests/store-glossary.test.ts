import {it,expect,vi} from 'vitest';
const file=vi.hoisted(()=>({value:''}));
vi.mock('electron',()=>({app:{getPath:()=>'/synthetic-user-data'},safeStorage:{}}));
vi.mock('node:fs',async original=>({...await original<typeof import('node:fs')>(),readFileSync:()=>file.value}));
import {Store} from '../src/main/store';
import {Coordinator} from '../src/main/coordinator';
import {defaults} from '../src/shared/config';
it('retains an oversized legacy glossary for editing but rejects Start before capture or provider admission',async()=>{
 const saved={terms:Array.from({length:100},(_,i)=>`${i}${'x'.repeat(97)}`),translations:[]};file.value=JSON.stringify(saved);
 const restored=new Store().glossary();expect(restored).toEqual(saved);
 const capture={start:vi.fn(async()=>{}),stop:vi.fn()},connect=vi.fn(),boundary={admit:vi.fn(),end:vi.fn()};
 const c=new Coordinator(capture,()=>{},structuredClone(defaults),connect,boundary);c.glossary=restored;
 try{await expect(c.start()).rejects.toThrow('Glossary is too large');expect(capture.start).not.toHaveBeenCalled();expect(connect).not.toHaveBeenCalled();expect(boundary.admit).not.toHaveBeenCalled();expect(c.state.status).toBe('idle');expect(c.glossary).toEqual(saved);}finally{c.dispose();}
});

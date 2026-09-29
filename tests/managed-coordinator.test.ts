import {it,expect,vi} from 'vitest';
import {Coordinator} from '../src/main/coordinator';
import {defaults,destination} from '../src/shared/config';
import type {Admission} from '../src/shared/managed';
const admission:Admission={leaseId:'10000000-0000-4000-8000-000000000001',status:'issued',apiKey:'synthetic-temporary',expiresAt:'2099-01-01T00:00:00Z',maxSeconds:60,region:'eu',endpoint:destination('eu')};
it('stopping an unresolved admission never starts capture when the credential arrives',async()=>{
 let resolve!:(v:Admission)=>void;const pending=new Promise<Admission>(r=>resolve=r);
 const capture={start:vi.fn(async()=>{}),stop:vi.fn()},boundary={admit:vi.fn(()=>pending),end:vi.fn(async()=>{})};
 const c=new Coordinator(capture,()=>{},structuredClone(defaults),undefined,boundary);
 const start=c.start();await c.stop();resolve(admission);await start;
 expect(capture.start).not.toHaveBeenCalled();expect(boundary.end).toHaveBeenCalledWith(admission.leaseId);expect(c.state.status).toBe('stopped');expect(JSON.stringify(c.state)).not.toContain(admission.apiKey);c.dispose();
});
it('personal-key mode never asks the company for admission',async()=>{
 const capture={start:vi.fn(async()=>{}),stop:vi.fn()},boundary={admit:vi.fn(async()=>admission),end:vi.fn(async()=>{})};
 const c=new Coordinator(capture,()=>{},{...structuredClone(defaults),funding:'personal'},undefined,boundary);c.key='synthetic-personal';await c.start();expect(capture.start).toHaveBeenCalledOnce();expect(boundary.admit).not.toHaveBeenCalled();c.dispose();
});
it('managed mode works without a personal key and keeps its credential out of snapshots',async()=>{
 const capture={start:vi.fn(async()=>{}),stop:vi.fn()},boundary={admit:vi.fn(async()=>admission),end:vi.fn(async()=>{})};
 const c=new Coordinator(capture,()=>{},structuredClone(defaults),undefined,boundary);await c.start();expect(capture.start).toHaveBeenCalledOnce();expect(c.state.managed?.reservedMs).toBe(60000);expect(JSON.stringify(c.state)).not.toContain(admission.apiKey);await c.stop();expect(c.state.managed?.finalizing).toBe(true);expect(boundary.end).toHaveBeenCalledOnce();c.dispose();
});

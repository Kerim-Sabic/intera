import {EventEmitter} from 'node:events';
import type WebSocket from 'ws';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {Coordinator} from '../src/main/coordinator';
import {defaults,selectProfile} from '../src/shared/config';
const create=()=>{const capture={start:vi.fn(async()=>{}),stop:vi.fn()};const c=new Coordinator(capture,()=>{});return {c,capture};};
afterEach(()=>vi.useRealTimers());
describe('session ownership',()=>{
 it('requires credentials for live streams',async()=>{const {c,capture}=create();await expect(c.start()).rejects.toThrow();expect(capture.start).not.toHaveBeenCalled();});
 it('rapid Start is idempotent; stop releases capture and rejects late formats',async()=>{const {c,capture}=create();await Promise.all([c.start(false,true),c.start(false,true)]);expect(capture.start).toHaveBeenCalledTimes(1);const epoch=c.state.transcript.epoch;await c.stop();c.format(epoch,{sampleRate:48000,channels:2});expect(c.state.audio).toBeNull();expect(capture.stop).toHaveBeenCalled();c.dispose();});
 it('local test gets real sample statistics and never opens a socket',async()=>{const {c}=create();await c.start(false,true);const epoch=c.state.transcript.epoch;c.format(epoch,{sampleRate:48000,channels:2});c.packet(epoch,0,new Int16Array([1000,-1000,1000,-1000]).buffer);expect(c.state.packets).toBe(1);expect(c.state.meter).toBeGreaterThan(0);expect(c.state.networkHealth).toBe('Not connected');c.dispose();});
 it('packet discontinuity stops instead of silently dropping',async()=>{const {c}=create();await c.start(false,true);const epoch=c.state.transcript.epoch;c.format(epoch,{sampleRate:48000,channels:2});c.packet(epoch,5,new Int16Array([0,0]).buffer);expect(c.state.status).toBe('error');c.dispose();});
 it('profile changes stage; display-only changes do not restart',async()=>{vi.useFakeTimers();const {c,capture}=create();await c.start(true);const updated={...c.state.preferences,processing:selectProfile(defaults.processing,'Speed')};await c.preferences(updated,'pause');expect(c.state.effective?.profile).toBe('Balanced');expect(c.state.pending?.config.profile).toBe('Speed');await c.preferences({...updated,drafts:false},'pause');expect(c.state.effective?.profile).toBe('Balanced');expect(capture.start).not.toHaveBeenCalled();await c.stop('paused');await c.start(true);expect(c.state.effective?.profile).toBe('Speed');expect(c.state.preferences.drafts).toBe(false);c.dispose();});
 it('next-session changes do not apply on resume',async()=>{vi.useFakeTimers();const {c}=create();await c.start(true);await c.preferences({...c.state.preferences,processing:selectProfile(defaults.processing,'Accuracy-first')},'next');await c.stop('paused');await c.start(true);expect(c.state.effective?.profile).toBe('Balanced');await c.stop();await c.start(true);expect(c.state.effective?.profile).toBe('Accuracy-first');c.dispose();});
 it('clear prevents late demo tokens restoring transcript',async()=>{vi.useFakeTimers();const {c}=create();await c.start(true);vi.advanceTimersByTime(1200);expect(c.state.transcript.groups.length).toBeGreaterThan(0);await c.clear();vi.advanceTimersByTime(5000);expect(c.state.transcript.groups).toHaveLength(0);c.dispose();});
});

it('reports missing provider translations, clears on arrival, and resets on reconnect',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));
 const ws=Object.assign(new EventEmitter(),{readyState:1,bufferedAmount:0,send:vi.fn(),terminate:vi.fn(),close:vi.fn()});
 const capture={start:vi.fn(async()=>{}),stop:vi.fn()};
 const c=new Coordinator(capture,()=>{},{...structuredClone(defaults),funding:'personal'},()=>ws as unknown as WebSocket);c.key='synthetic-test-key';
 await c.start();const epoch=c.state.transcript.epoch;c.format(epoch,{sampleRate:48000,channels:1});ws.emit('open');
 const config=JSON.parse(ws.send.mock.calls[0][0]);expect(config.translation).toEqual({type:'two_way',language_a:'en',language_b:'bs'});
 ws.emit('message',Buffer.from(JSON.stringify({tokens:[{text:'Hello',is_final:true,language:'en',speaker:'1',translation_status:'original'}]})));
 for(let i=0;i<21;i++){c.packet(epoch,i,new Int16Array([0]).buffer);vi.advanceTimersByTime(1000);}
 expect(c.state.translationHealth).toMatchObject({sourceTokens:1,translationTokens:0,stalled:true});
 ws.emit('message',Buffer.from(JSON.stringify({tokens:[{text:'Zdravo',is_final:false,language:'bs',source_language:'en',speaker:'1',translation_status:'translation'}]})));
 expect(c.state.translationHealth).toMatchObject({translationTokens:1,stalled:false});
 expect(c.state.transcript.groups[0].translationDraft).toBe('Zdravo');
 for(let i=21;i<43;i++){c.packet(epoch,i,new Int16Array([0]).buffer);vi.advanceTimersByTime(1000);}
 expect(c.state.translationHealth?.stalled).toBe(false);
 c.fail('Synthetic disconnect');await c.start();expect(c.state.translationHealth).toMatchObject({sourceTokens:0,translationTokens:0,stalled:false});c.dispose();
});

const liveMock=async()=>{
 const ws=Object.assign(new EventEmitter(),{readyState:1,bufferedAmount:0,send:vi.fn(),terminate:vi.fn(),close:vi.fn()});
 const capture={start:vi.fn(async()=>{}),stop:vi.fn()};
 const c=new Coordinator(capture,()=>{},{...structuredClone(defaults),funding:'personal'},()=>ws as unknown as WebSocket);c.key='synthetic-test-key';
 await c.start();const epoch=c.state.transcript.epoch;c.format(epoch,{sampleRate:48000,channels:1});ws.emit('open');return {c,ws,capture,epoch};
};
it('stops capture immediately but retains delayed translation until confirmed provider completion',async()=>{
 vi.useFakeTimers();const {c,ws,capture,epoch}=await liveMock();
 ws.emit('message',Buffer.from(JSON.stringify({tokens:[{text:'Hello',is_final:true,language:'en',speaker:'1',translation_status:'original'}]})));
 const done=c.stop();expect(capture.stop).toHaveBeenCalled();expect(c.state.status).toBe('stopping');
 c.packet(epoch,0,new Int16Array([1000]).buffer);expect(c.state.packets).toBe(0);
 vi.advanceTimersByTime(5000);expect(c.state.status).toBe('stopping');
 ws.emit('message',Buffer.from(JSON.stringify({tokens:[{text:'Zdravo',is_final:true,language:'bs',source_language:'en',speaker:'1',translation_status:'translation'}],finished:true})));
 await done;expect(c.state.status).toBe('stopped');expect(c.state.transcript.groups[0].translation).toBe('Zdravo');c.dispose();
});
it('bounds unconfirmed provider finalization and reports potentially incomplete translation',async()=>{
 vi.useFakeTimers();const {c}=await liveMock();const done=c.stop();vi.advanceTimersByTime(15000);await done;
 expect(c.state.status).toBe('stopped');expect(c.state.message).toContain('Latest translation may be incomplete');c.dispose();
});

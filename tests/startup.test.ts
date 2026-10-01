import {describe,it,expect,vi} from 'vitest';
import {startupDeadline} from '../src/main/startup';
describe('optional storage startup deadline',()=>{
 it('returns restored state and removes its timer',async()=>{vi.useFakeTimers();try{expect(await startupDeadline(Promise.resolve('restored'))).toBe('restored');expect(vi.getTimerCount()).toBe(0);}finally{vi.useRealTimers();}});
 it('does not wait forever for a keychain and ignores late results',async()=>{vi.useFakeTimers();try{let resolve!:(v:string)=>void;const work=new Promise<string>(r=>{resolve=r;});const result=expect(startupDeadline(work,100)).rejects.toThrow('deadline');await vi.advanceTimersByTimeAsync(100);await result;resolve('late credential');expect(vi.getTimerCount()).toBe(0);}finally{vi.useRealTimers();}});
});

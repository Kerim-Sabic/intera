import {it,expect} from 'vitest';
import {captureDiagnosticSchema} from '../src/shared/capture-diagnostic';
it('admits only fixed diagnostic stages and codes, never arbitrary error text or capture data',()=>{
 expect(captureDiagnosticSchema.safeParse({stage:'worklet',code:'AbortError'}).success).toBe(true);
 for(const value of [{stage:'private file path'},{stage:'acquire',code:'private provider error'},{stage:'ready',audio:'recording'},{stage:'ready',transcript:'patient text'}])expect(captureDiagnosticSchema.safeParse(value).success).toBe(false);
});

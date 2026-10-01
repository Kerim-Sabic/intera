import {it,expect} from 'vitest';
import {gazeSupported,gazeRelease} from '../src/shared/eye-contact';
it('gates upstream camera integration to explicit modern macOS versions',()=>{for(const version of ['14.0','15.7.9','27.0.1'])expect(gazeSupported('darwin',version)).toBe(true);for(const version of ['13.1','unknown','14junk.0'])expect(gazeSupported('darwin',version)).toBe(false);expect(gazeSupported('win32','27.0.1')).toBe(false);expect(gazeRelease).toBe('https://github.com/WangWilly/gaze-correction-cam/releases/tag/v1.0.1-alpha');});

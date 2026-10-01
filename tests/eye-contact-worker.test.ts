import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {it,expect,vi,afterEach} from 'vitest';
const mocks=vi.hoisted(()=>({spawn:vi.fn(),access:vi.fn(async()=>{})}));
vi.mock('electron',()=>({app:{isPackaged:false,getAppPath:()=>'/intera',getPath:()=>'/private-test'}}));
vi.mock('node:fs/promises',()=>({access:mocks.access}));
vi.mock('node:child_process',()=>({spawn:mocks.spawn}));
vi.mock('../src/shared/eye-contact',async original=>({...await original<typeof import('../src/shared/eye-contact')>(),gazeSupported:()=>true}));
import {EyeContact} from '../src/main/eye-contact';
import {gazeDefaults} from '../src/shared/eye-contact';
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.clearAllMocks();});
function setup(){vi.stubEnv('INTERA_GAZE_PYTHON','/reviewed/development/python');const child=Object.assign(new EventEmitter(),{stdin:new PassThrough(),stdout:new PassThrough(),stderr:new PassThrough(),kill:vi.fn()});mocks.spawn.mockReturnValue(child);const frames=vi.fn();const engine=new EyeContact(()=>{},frames);return {engine,child,frames};}
it('concurrent starts mint one worker; ready frames never enter transcript state',async()=>{vi.useFakeTimers();const {engine,child,frames}=setup();await Promise.all([engine.start(gazeDefaults),engine.start(gazeDefaults)]);expect(mocks.spawn).toHaveBeenCalledTimes(1);expect(engine.view.status).toBe('starting');child.stdout.write('{"type":"ready"}\n');expect(engine.view.status).toBe('preview');vi.advanceTimersByTime(200);child.stdout.write('{"type":"frame","jpeg":"/9j/"}\n');expect(frames).toHaveBeenCalledWith('/9j/');engine.stop();expect(child.kill).toHaveBeenCalledWith('SIGTERM');expect(frames).toHaveBeenLastCalledWith('');child.stdout.write('{"type":"ready"}\n');expect(engine.view.status).toBe('off');});
it('models failure remains a failure, with no stale active preview',async()=>{vi.useFakeTimers();const {engine,child}=setup();await engine.start(gazeDefaults);child.stdout.write('{"type":"error","code":"models"}\n');expect(engine.view.status).toBe('error');expect(engine.view.message).toContain('Camera was not opened');expect(child.kill).toHaveBeenCalled();});
it('bounds startup and hung inference; never buffers unlimited previews',async()=>{vi.useFakeTimers();const {engine,child}=setup();await engine.start(gazeDefaults);vi.advanceTimersByTime(30000);expect(engine.view.status).toBe('error');await engine.start(gazeDefaults);child.stdout.write('{"type":"ready"}\n');vi.advanceTimersByTime(10200);expect(engine.view.status).toBe('error');});

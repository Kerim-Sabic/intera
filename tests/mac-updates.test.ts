import {it,expect,vi} from 'vitest';
vi.mock('electron',()=>({autoUpdater:{setFeedURL:vi.fn(),checkForUpdates:vi.fn(),quitAndInstall:vi.fn(),on:vi.fn()}}));
import {autoUpdater} from 'electron';
import {MacUpdates} from '../src/main/updates';
it('unapproved and unpackaged builds never configure or contact the updater',async()=>{
 const controller=new MacUpdates(()=>{},()=>false);
 await controller.initialize({packaged:true,platform:'darwin',arch:'arm64',version:'0.2.0-beta.7',bundlePath:'/synthetic/Intera.app',approved:false});
 await controller.initialize({packaged:false,platform:'darwin',arch:'arm64',version:'0.2.0-beta.7',bundlePath:'/synthetic/Intera.app',approved:true,teamId:'SYNTHETIC'});
 expect(autoUpdater.setFeedURL).not.toHaveBeenCalled();expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();expect(()=>controller.check()).toThrow('signed');controller.dispose();
});
it('ready updates cannot restart during capture and only install on explicit idle action',()=>{
 let busy=true;const controller=new MacUpdates(()=>{},()=>busy);controller.view={status:'ready',message:'Synthetic downloaded-update fixture'};
 expect(()=>controller.install()).toThrow('Finish your meeting');expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();busy=false;controller.install();expect(autoUpdater.quitAndInstall).toHaveBeenCalledOnce();controller.dispose();
});

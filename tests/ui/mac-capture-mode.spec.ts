import {_electron as electron,test,expect} from '@playwright/test';
test('Mac compatibility selection persists and activates only on the next launch',async()=>{
 test.skip(process.platform!=='darwin','Mac capture feature selection');
 const env=Object.fromEntries(Object.entries(process.env).filter(([key,value])=>key!=='ELECTRON_RUN_AS_NODE'&&value!==undefined)) as Record<string,string>;
 const args=['--test-isolated',`--test-profile=capture-mode-${Date.now()}`];
 const options=process.env.INTERA_MAC_EXECUTABLE?{executablePath:process.env.INTERA_MAC_EXECUTABLE,args,env}:{args:['.',...args],env};
 let app=await electron.launch(options);
 try{const page=await app.firstWindow();const before=await page.evaluate(()=>window.intera.snapshot());expect(before.macCapture?.compatibility).toBe(false);const result=await page.evaluate(()=>window.intera.command({type:'mac-capture-compatibility',enabled:true}));expect(result.ok).toBe(true);const after=await page.evaluate(()=>window.intera.snapshot());expect(after.macCapture).toEqual({compatibility:false,nextCompatibility:true});expect(after.status).toBe('idle');}finally{await app.close();}
 app=await electron.launch(options);
 try{const page=await app.firstWindow();expect((await page.evaluate(()=>window.intera.snapshot())).macCapture).toEqual({compatibility:true,nextCompatibility:true});expect(await app.evaluate(({app})=>app.commandLine.getSwitchValue('disable-features'))).toContain('MacCatapLoopbackAudioForScreenShare');}finally{await app.close();}
});

import {_electron as electron,test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test('Mac installed bundle launches, renders, opens compact, persists and quits',async()=>{
 test.skip(process.platform!=='darwin'||!process.env.INTERA_MAC_EXECUTABLE,'Requires the actual packaged Mac executable');
 const env=Object.fromEntries(Object.entries(process.env).filter(([k,v])=>k!=='ELECTRON_RUN_AS_NODE'&&v!==undefined)) as Record<string,string>;
 const args=['--test-isolated',`--test-profile=mac-package-${Date.now()}`,'--visual-fixture'];
 let app=await electron.launch({executablePath:process.env.INTERA_MAC_EXECUTABLE,args,env});
 await mkdir('test-results/mac',{recursive:true});
 try{
  expect(await app.evaluate(({app})=>app.isPackaged)).toBe(true);
  const page=await app.firstWindow();await expect(page.locator('.turn')).toHaveCount(12);
  const win=await app.browserWindow(page);await win.evaluate(w=>w.setSize(1280,800));
  await page.screenshot({path:'test-results/mac/packaged-reader.png'});
  const next=app.waitForEvent('window');await page.getByRole('button',{name:'Open compact view'}).click();const compact=await next;
  await expect(compact.locator('.translation p')).toContainText('Prije nego završimo');
  expect(await compact.locator('.conversation').evaluate(el=>el.scrollTop)).toBe(0);
  await compact.screenshot({path:'test-results/mac/packaged-compact.png'});
  await page.evaluate(async()=>{const s=await window.intera.snapshot();await window.intera.command({type:'preferences',preferences:{...s.preferences,theme:'dark',translationSize:30},timing:'next'});});
  const runtime=await app.evaluate(()=>({electron:process.versions.electron,os:process.getSystemVersion(),arch:process.arch}));
  await writeFile('test-results/mac/launch.json',JSON.stringify({runtime,packaged:true,content:'12 synthetic turns, not live capture',restart:'tested in same test',physicalMac:'NOT RUN'},null,2));
 }finally{await app.close();}
 app=await electron.launch({executablePath:process.env.INTERA_MAC_EXECUTABLE,args,env});
 try{const page=await app.firstWindow();await page.waitForFunction(()=>!!window.intera);const s=await page.evaluate(()=>window.intera.snapshot());expect(s.preferences.theme).toBe('dark');expect(s.preferences.translationSize).toBe(30);expect(s.status).toBe('stopped');}finally{await app.close();}
});

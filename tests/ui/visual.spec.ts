import {desktopScreenshot} from './desktop-screenshot';
import {_electron as electron,test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test('synthetic 12-turn visual matrix and compact beginning',async()=>{
 const app=await electron.launch({args:['.','--test-isolated','--visual-fixture'],env:Object.fromEntries(Object.entries(process.env).filter(([k,v])=>k!=='ELECTRON_RUN_AS_NODE'&&v!==undefined)) as Record<string,string>});
 const dir='test-results/visual';await mkdir(dir,{recursive:true});
 try{const page=await app.firstWindow(),win=await app.browserWindow(page);await expect(page.locator('.turn')).toHaveCount(12);
  const evidence=[];
  for(const theme of ['light','dark'] as const)for(const [width,height,zoom,large] of [[1280,800,1,0],[1440,900,1,0],[680,700,1,0],[1280,800,1.5,1]]){
   await page.evaluate(async({theme,large})=>{const s=await window.intera.snapshot();await window.intera.command({type:'preferences',preferences:{...s.preferences,theme,sourceSize:large?24:19,translationSize:large?36:26},timing:'next'});},{theme,large});
   await win.evaluate((w,{width,height,zoom})=>{w.setSize(width,height);w.webContents.setZoomFactor(zoom);},{width,height,zoom});
   await expect.poll(()=>page.evaluate(()=>innerWidth)).toBeLessThanOrEqual(width/zoom);
   await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
   await page.locator('.conversation').evaluate(el=>{el.scrollTop=0;});
   const capture=await win.evaluate(async w=>(await w.capturePage()).toPNG().toString('base64'));
   await writeFile(`${dir}/${theme}-${width}x${height}-${zoom}x.png`,Buffer.from(capture,'base64'));
   const metrics=await page.evaluate(()=>({viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,controlsFit:[...document.querySelectorAll('.toolbar button')].every(el=>el.getBoundingClientRect().right<=innerWidth),turns:document.querySelectorAll('.turn').length}));expect(metrics.overflow).toBe(false);expect(metrics.controlsFit).toBe(true);evidence.push({theme,width,height,zoom,large,...metrics});
  }
  await win.evaluate(w=>{w.setSize(1280,800);w.webContents.setZoomFactor(1);});
  await page.evaluate(async()=>{const s=await window.intera.snapshot();await window.intera.command({type:'preferences',preferences:{...s.preferences,theme:'light',sourceSize:19,translationSize:26},timing:'next'});});
  await page.getByRole('button',{name:'Settings',exact:true}).click();await desktopScreenshot(app,page,{path:`dir/settings.png`.replace('dir',dir)});
  await page.getByRole('button',{name:'Setup guide',exact:true}).click();await desktopScreenshot(app,page,{path:`${dir}/onboarding.png`});
  await page.getByRole('button',{name:'Account',exact:true}).click();await desktopScreenshot(app,page,{path:`${dir}/account.png`});await page.getByRole('button',{name:'Close settings'}).click();
  const pending=app.waitForEvent('window');await page.getByRole('button',{name:'Open compact view'}).click();const compact=await pending;await compact.waitForLoadState();await expect(compact.locator('.translation p')).toContainText('Prije nego završimo');
  expect(await compact.locator('.conversation').evaluate(el=>el.scrollTop)).toBe(0);
  await desktopScreenshot(app,compact,{path:`${dir}/compact-default.png`});
  await writeFile(`${dir}/matrix.json`,JSON.stringify({kind:'accelerated synthetic UI, not live provider evidence',cases:evidence},null,2));
 }finally{await app.close();}
});

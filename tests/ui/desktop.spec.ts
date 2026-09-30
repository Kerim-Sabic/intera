import {desktopScreenshot} from './desktop-screenshot';
import {_electron as electron,test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
test('custom preferences persist through a real desktop restart',async()=>{
 const args=['.','--test-isolated',`--test-profile=persist-${Date.now()}`];
 const env=Object.fromEntries(Object.entries(process.env).filter(([k,v])=>k!=='ELECTRON_RUN_AS_NODE'&&v!==undefined)) as Record<string,string>;
 let app=await electron.launch({args,env});
 try{const page=await app.firstWindow();await page.waitForFunction(()=>!!window.intera);await page.evaluate(async()=>{const s=await window.intera.snapshot();await window.intera.command({type:'preferences',preferences:{...s.preferences,drafts:false,processing:{...s.preferences.processing,profile:'Custom',endpoint:{enabled:true,delay:1800,level:1,sensitivity:0.2}}},timing:'next'});});}finally{await app.close();}
 app=await electron.launch({args,env});
 try{const page=await app.firstWindow();await page.waitForFunction(()=>!!window.intera);const s=await page.evaluate(()=>window.intera.snapshot());expect(s.preferences.drafts).toBe(false);expect(s.preferences.processing).toMatchObject({profile:'Custom',endpoint:{enabled:true,delay:1800,level:1,sensitivity:0.2}});expect(s.status).toBe('idle');}finally{await app.close();}
});
test('native desktop setup, profiles, demo, hold, compact and clear',async()=>{
 const app=await electron.launch({args:['.','--test-isolated'],env:Object.fromEntries(Object.entries(process.env).filter(([k,v])=>k!=='ELECTRON_RUN_AS_NODE' && v!==undefined)) as Record<string,string>});
 try{
  const page=await app.firstWindow();await expect(page.getByText('Ready to interpret',{exact:true})).toBeVisible();
  await mkdir('test-results/screenshots',{recursive:true});await desktopScreenshot(app,page,{path:'test-results/screenshots/idle.png'});
  await page.getByRole('button',{name:'Performance profile'}).click();await page.getByRole('button',{name:'Speed',exact:true}).click();await page.getByRole('button',{name:'Save preferences',exact:true}).click();await expect(page.getByText('1000 ms',{exact:true})).toBeVisible();await desktopScreenshot(app,page,{path:'test-results/screenshots/profile.png'});
  await page.getByRole('button',{name:'Custom',exact:true}).click();await page.getByLabel('Maximum delay (500–3000 ms)').fill('1700');await page.getByRole('button',{name:'Save preferences',exact:true}).click();await desktopScreenshot(app,page,{path:'test-results/screenshots/custom.png'});await page.getByRole('button',{name:'Close settings'}).click();
  const saved=await page.evaluate(()=>window.intera.snapshot());expect(saved.preferences.processing.endpoint.delay).toBe(1700);
  await page.getByRole('button',{name:'Explore a clearly labeled demo'}).click();await expect(page.getByText('Do not take 50 mg. Take 15 mg, once a day.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Hold reading',exact:true}).click();await desktopScreenshot(app,page,{path:'test-results/screenshots/held.png'});
  await page.getByRole('button',{name:'Open compact view'}).click();const compact=await app.waitForEvent('window');await compact.waitForLoadState();await expect(compact.locator('.demo-banner')).toBeVisible();await desktopScreenshot(app,compact,{path:'test-results/screenshots/compact.png'});
  await page.getByRole('button',{name:'Release reading',exact:false}).click();await expect(page.getByText('Nemojte uzimati 50 mg. Uzimajte 15 mg, jednom dnevno.',{exact:true})).toBeVisible();await desktopScreenshot(app,page,{path:'test-results/screenshots/live-demo.png'});
  await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(page.getByRole('button',{name:'Resume',exact:true})).toBeVisible();await desktopScreenshot(app,page,{path:'test-results/screenshots/paused.png'});
  await page.evaluate(async()=>{const s=await window.intera.snapshot();await window.intera.command({type:'preferences',preferences:{...s.preferences,theme:'dark',translationSize:36},timing:'pause'});});
  const windowHandle=await app.browserWindow(page);await windowHandle.evaluate(w=>{w.restore();w.setSize(680,520);});await expect.poll(()=>page.evaluate(()=>innerWidth)).toBeLessThan(700);await desktopScreenshot(app,page,{path:'test-results/screenshots/dark-narrow.png'});
  await page.evaluate(()=>window.intera.command({type:'clear'}));await expect(page.getByText('Ready to interpret',{exact:true})).toBeVisible();
 }finally{await app.close();}
});

test('account panel is explicit about unconfigured billing and does not expose a payment key',async()=>{
 const env=Object.fromEntries(Object.entries(process.env).filter(([k,v])=>k!=='ELECTRON_RUN_AS_NODE'&&!k.startsWith('INTERA_')&&v!==undefined)) as Record<string,string>;
 const app=await electron.launch({args:['.','--test-isolated'],env});
 try{
  const page=await app.firstWindow();await page.getByRole('button',{name:'Performance profile'}).click();
  await page.getByRole('button',{name:'Account',exact:true}).click();
  await expect(page.getByText('Paid plans are not available in this build yet.')).toBeVisible();
  expect(await page.evaluate(()=>window.intera.billing({type:'status'}))).toEqual({ok:true,view:{configured:false}});
  await mkdir('test-results/screenshots',{recursive:true});await desktopScreenshot(app,page,{path:'test-results/screenshots/whop-account-unconfigured.png'});
  await page.getByRole('button',{name:'Close settings'}).click();
  await expect(page.getByText('Ready to interpret',{exact:true})).toBeVisible();
 }finally{await app.close();}
});

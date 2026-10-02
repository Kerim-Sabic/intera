import {desktopScreenshot} from './desktop-screenshot';
import {_electron as electron,test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test('direct payment onboarding works without Intera AI auth and keeps session-only keys out of snapshots and restart',async()=>{
 const env=Object.fromEntries(Object.entries(process.env).filter(([k,v])=>k!=='ELECTRON_RUN_AS_NODE'&&!k.startsWith('INTERA_')&&v!==undefined)) as Record<string,string>;
 const args=['.','--test-isolated',`--test-profile=direct-${Date.now()}`];let app=await electron.launch({args,env});
 const dir='test-results/direct-soniox';await mkdir(dir,{recursive:true});
 try{
  const page=await app.firstWindow(),win=await app.browserWindow(page);await win.evaluate(w=>w.setSize(1280,800));
  await page.getByRole('button',{name:'Set up Intera AI',exact:true}).click();
  const setup=page.getByRole('region',{name:'Pay Soniox directly',exact:true});
  await expect(setup.getByText('Intera AI adds no usage fee.',{exact:true})).toBeVisible();
  await expect(setup.getByRole('button',{name:'Open Soniox API Console'})).toBeVisible();
  await desktopScreenshot(app,page,{path:`${dir}/onboarding-light.png`});
  await setup.getByRole('button',{name:'I have a project'}).click();
  await expect(setup.getByRole('heading',{name:'2. Check payment and set a limit'})).toBeVisible();
  await setup.getByRole('button',{name:'I reviewed billing'}).click();
  await expect(setup.getByText('Speech-to-text, real-time',{exact:true})).toBeVisible();
  await desktopScreenshot(app,page,{path:`${dir}/create-key-light.png`});
  await setup.getByRole('button',{name:'I copied my key'}).click();
  await setup.getByLabel('Your Soniox API key',{exact:true}).scrollIntoViewIfNeeded();
  await desktopScreenshot(app,page,{path:`${dir}/connect-key-light.png`});
  await setup.getByLabel('Soniox project region').selectOption('eu');
  const remembered=setup.getByLabel('Remember on this device using secure storage');if(await remembered.isEnabled())await remembered.uncheck();
  await setup.getByLabel('Your Soniox API key',{exact:true}).fill('synthetic-direct-test-key');
  await setup.getByRole('button',{name:'Connect my Soniox key'}).click();
  await expect(setup.getByText('Direct payment selected · Key connected')).toBeVisible();
  await expect(setup.getByLabel('Your Soniox API key',{exact:true})).toHaveValue('');
  let snapshot=await page.evaluate(()=>window.intera.snapshot());expect(snapshot.preferences).toMatchObject({funding:'personal',region:'eu'});expect(snapshot.keyStored).toBe(true);expect(JSON.stringify(snapshot)).not.toContain('synthetic-direct-test-key');
  expect(await page.evaluate(()=>window.intera.billing({type:'status'}))).toEqual({ok:true,view:{configured:false}});
  await setup.getByRole('button',{name:'Check key without audio'}).scrollIntoViewIfNeeded();await desktopScreenshot(app,page,{path:`${dir}/connected-key.png`});
  await setup.getByRole('button',{name:'Go to playback test'}).click();
  await expect(page.getByRole('heading',{name:'Listen to meeting playback'})).toBeVisible();
  await page.getByRole('button',{name:'4. Ready',exact:true}).click();await expect(page.getByText('Soniox bills your API use directly.',{exact:false})).toBeVisible();await desktopScreenshot(app,page,{path:`${dir}/ready.png`});
  await page.getByRole('button',{name:'Close settings'}).click();await page.getByRole('button',{name:'Start',exact:true}).click();
  await expect(page.getByText('Intera AI adds no usage fee and does not use your subscription allowance.',{exact:false})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Billed by Soniox',exact:true}).click();
  await page.getByRole('button',{name:'4. Connect & test'}).click();
  await page.evaluate(async()=>{const s=await window.intera.snapshot();await window.intera.command({type:'preferences',preferences:{...s.preferences,theme:'dark'},timing:'next'});});
  await win.evaluate(w=>{w.setSize(680,700);w.webContents.setZoomFactor(1.5);});
  await page.getByRole('heading',{name:'Pay Soniox directly',exact:true}).scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await writeFile(`${dir}/account-dark-narrow.png`,Buffer.from(await win.evaluate(async w=>(await w.webContents.capturePage()).toPNG().toString("base64")),"base64"));
  await page.evaluate(()=>window.intera.command({type:'demo'}));
  const blocked=await page.evaluate(()=>window.intera.command({type:'connect-personal',key:'replacement-fixture',persist:false,region:'us'}));expect(blocked.ok).toBe(false);
  snapshot=await page.evaluate(()=>window.intera.snapshot());expect(snapshot.preferences.region).toBe('eu');await page.evaluate(()=>window.intera.command({type:'stop'}));
 }finally{await app.close();}
 app=await electron.launch({args,env});try{const page=await app.firstWindow();await page.waitForFunction(()=>!!window.intera);const s=await page.evaluate(()=>window.intera.snapshot());expect(s.preferences.funding).toBe('personal');expect(s.keyStored).toBe(false);expect(s.status).toBe('idle');}finally{await app.close();}
});

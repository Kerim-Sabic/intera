import {_electron as electron,test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {desktopScreenshot} from './desktop-screenshot';
const env=Object.fromEntries(Object.entries(process.env).filter(([k,v])=>k!=='ELECTRON_RUN_AS_NODE'&&v!==undefined)) as Record<string,string>;

test('meeting language setup requires distinct selections and sends no audio before confirmation',async()=>{
 const app=await electron.launch({args:['.','--test-isolated'],env});
 try{const page=await app.firstWindow();await expect.poll(()=>page.evaluate(()=>window.intera.snapshot().then(s=>s.storageLoading))).toBe(false);
  await page.evaluate(()=>window.intera.command({type:'connect-personal',key:'synthetic-never-sent',persist:false,region:'eu'}));
  await page.getByRole('button',{name:'Start',exact:true}).click();
  const setup=page.getByRole('dialog');await expect(setup.getByText('Set up this meeting',{exact:true})).toBeVisible();
  await setup.getByLabel('First meeting language').selectOption('ar');await setup.getByLabel('Second meeting language').selectOption('ar');await expect(setup.getByRole('button',{name:'Start listening',exact:true})).toBeDisabled();
  await setup.getByLabel('Second meeting language').selectOption('ja');await expect(setup.getByRole('button',{name:'Start listening',exact:true})).toBeEnabled();
  await expect(setup.locator('.language-summary')).toHaveText('Arabic ↔ Japanese');
  await setup.getByRole('button',{name:'Swap meeting languages'}).click();await expect(setup.getByLabel('First meeting language')).toHaveValue('ja');
  await setup.getByLabel('Meeting mode').selectOption('none');await setup.getByLabel('One language only').check();
  await setup.getByLabel('First meeting language').selectOption('fr');await expect(setup.getByLabel('Second meeting language')).toHaveValue('fr');await expect(setup.getByLabel('Second meeting language')).toBeDisabled();
  await expect(setup.getByRole('button',{name:'Start listening',exact:true})).toBeEnabled();await expect(setup.locator('.language-summary')).toHaveText('French · transcription');
  const state=await page.evaluate(()=>window.intera.snapshot());expect(state.packets).toBe(0);expect(state.status).toBe('idle');expect(state.networkHealth).toBe('Disconnected');
  await mkdir('test-results/workspace',{recursive:true});await desktopScreenshot(app,page,{path:'test-results/workspace/meeting-language-setup.png'});
  await setup.getByRole('button',{name:'Cancel',exact:true}).click();
  expect((await page.evaluate(()=>window.intera.snapshot())).preferences.processing.languageA).toBe('en');
 }finally{await app.close();}
});

test('transcription and target-language speech remain readable with originals hidden',async()=>{
 const app=await electron.launch({args:['.','--test-isolated','--visual-fixture'],env});
 try{const page=await app.firstWindow();await expect(page.locator('.turn')).toHaveCount(12);
  const source=await page.evaluate(async()=>{const s=await window.intera.snapshot();await window.intera.command({type:'preferences',preferences:{...s.preferences,showSource:false,processing:{...s.preferences.processing,mode:'none',languageA:'en',languageB:'en'}},timing:'now'});return s.transcript.groups[0].source;});
  await expect(page.locator('.source p').first()).toHaveText(source);await expect(page.locator('.translation')).toHaveCount(0);
  await page.evaluate(async()=>{const s=await window.intera.snapshot();await window.intera.command({type:'preferences',preferences:{...s.preferences,processing:{...s.preferences.processing,mode:'one_way',languageA:'bs',targetLanguage:'en'}},timing:'now'});});
  await expect(page.locator('.translation p').first()).toHaveText(source);await expect(page.locator('.translation .column-label').first()).toContainText('ALREADY IN TARGET');
 }finally{await app.close();}
});

test('save and start fresh keeps one editable meeting and restores its language context',async()=>{
 const args=['.','--test-isolated',`--test-profile=workspace-${Date.now()}`,'--visual-fixture'];
 let app=await electron.launch({args,env});
 try{const page=await app.firstWindow();await expect.poll(()=>page.evaluate(()=>window.intera.snapshot().then(s=>s.storageLoading))).toBe(false);
  const native=await app.browserWindow(page);await native.evaluate(w=>w.setSize(1280,900));
  const initial=await page.evaluate(()=>window.intera.snapshot());test.skip(!initial.secureStorage,'Device encryption unavailable');
  await page.getByLabel('Current meeting title',{exact:true}).fill('Language practice');await page.getByRole('button',{name:'Save meeting',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.intera.snapshot().then(s=>s.meetings?.length))).toBe(1);
  const first=await page.evaluate(()=>window.intera.snapshot());const id=first.meetingId!;
  await page.evaluate(async()=>{const s=await window.intera.snapshot();await window.intera.command({type:'group',id:s.transcript.groups[0].id,action:'edit',edit:{source:'مرحبا بالجميع',translation:'Hello everyone'}});});
  await expect(page.locator('.source p').first()).toHaveAttribute('dir','auto');
  await page.getByLabel('Current meeting title',{exact:true}).fill('Updated language practice');await page.getByRole('button',{name:'Save meeting',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.intera.snapshot().then(s=>s.savedMeeting))).toBe(id);
  expect((await page.evaluate(()=>window.intera.snapshot())).meetings).toHaveLength(1);
  await page.evaluate(()=>window.intera.command({type:'rename',id:'1:1',name:'Meeting host'}));
  await page.locator('.meeting-strip').getByRole('button',{name:'New meeting',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save & start fresh',exact:true})).toBeVisible();await page.getByLabel('Save current meeting as').fill('Updated language practice');
  await page.getByRole('button',{name:'Save & start fresh',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.intera.snapshot().then(s=>s.transcript.groups.length))).toBe(0);
  const fresh=await page.evaluate(()=>window.intera.snapshot());expect(fresh.demo).toBe(false);expect(fresh.names).toEqual({});expect(fresh.meetingId).toBeUndefined();expect(fresh.meetings).toHaveLength(1);expect(fresh.status).toBe('idle');
  await page.getByRole('button',{name:'Your meetings',exact:true}).click();await page.getByRole('button',{name:'Open',exact:true}).click();
  const reopened=await page.evaluate(()=>window.intera.snapshot());expect(reopened.meetingReview).toBe(true);expect(reopened.transcript.groups[0].edit?.source).toBe('مرحبا بالجميع');
  await page.getByRole('button',{name:'Close settings'}).click();await page.locator('.conversation').evaluate(el=>{el.scrollTop=0;});
  await mkdir('test-results/workspace',{recursive:true});await desktopScreenshot(app,page,{path:'test-results/workspace/saved-meeting.png'});
 }finally{await app.close();}
 app=await electron.launch({args:args.filter(a=>a!=='--visual-fixture'),env});
 try{const page=await app.firstWindow();await expect.poll(()=>page.evaluate(()=>window.intera.snapshot().then(s=>s.storageLoading))).toBe(false);
  expect((await page.evaluate(()=>window.intera.snapshot())).meetings).toHaveLength(1);
 }finally{await app.close();}
});

test('canceling a native close retains the unsaved meeting',async()=>{
 const app=await electron.launch({args:['.','--test-isolated','--test-close-guard','--visual-fixture'],env});
 try{const page=await app.firstWindow();await expect(page.locator('.turn')).toHaveCount(12);
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:0,checkboxChecked:false});});
  const native=await app.browserWindow(page);await native.evaluate(w=>w.close());
  await expect(page.locator('.turn')).toHaveCount(12);expect(await native.evaluate(w=>w.isDestroyed())).toBe(false);
 }finally{await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:2,checkboxChecked:false});});await app.close();}
});

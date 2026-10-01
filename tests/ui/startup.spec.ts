import {_electron as electron,test,expect} from '@playwright/test';
test('hung secure storage does not prevent reader, demo or opening message',async()=>{
 const env=Object.fromEntries(Object.entries(process.env).filter(([k,v])=>k!=='ELECTRON_RUN_AS_NODE'&&v!==undefined)) as Record<string,string>;
 const app=await electron.launch({args:['.','--test-isolated','--test-storage-hang'],env});
 try{const page=await app.firstWindow();await expect(page.getByText('I love you Nadin',{exact:false})).toBeVisible();await expect(page.getByText('Opening secure storage · Demo and settings are available')).toBeVisible();
  expect((await page.evaluate(()=>window.intera.command({type:'start'}))).ok).toBe(false);
  expect((await page.evaluate(()=>window.intera.command({type:'demo'}))).ok).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.intera.snapshot().then(s=>s.storageLoading)),{timeout:15000}).toBe(false);
  const s=await page.evaluate(()=>window.intera.snapshot());expect(s.secureStorage).toBe(false);expect(s.keyStored).toBe(false);expect(s.meetingStorageError).toContain('did not respond');
  expect(s.demo).toBe(true);
  const native=await app.browserWindow(page);await native.evaluate(w=>w.hide());
  await app.evaluate(({app})=>app.emit('second-instance'));
  expect(await native.evaluate(w=>w.isVisible())).toBe(true);
  if(await app.evaluate(()=>process.platform)==='darwin'){
   await native.evaluate(w=>w.close());const reopened=app.waitForEvent('window');
   await app.evaluate(({app})=>app.emit('second-instance'));const reader=await reopened;
   await expect(reader.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
  }
 }finally{await app.close();}
});

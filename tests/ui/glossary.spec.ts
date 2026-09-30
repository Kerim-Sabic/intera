import {_electron as electron,test,expect} from '@playwright/test';
test('saved generic glossary reloads into editor and failed duplicates do not replace it',async()=>{
 const args=['.','--test-isolated',`--test-profile=glossary-${Date.now()}`];
 const env=Object.fromEntries(Object.entries(process.env).filter(([k,v])=>k!=='ELECTRON_RUN_AS_NODE'&&v!==undefined)) as Record<string,string>;
 let app=await electron.launch({args,env});
 try{
  const page=await app.firstWindow();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Languages',exact:true}).click();
  await page.getByLabel('Recognition terms (one per line)').fill('blood pressure');
  await page.getByLabel('Directional translation mappings (source = target)').fill('blood pressure = krvni pritisak\nkrvni pritisak = blood pressure');
  await page.getByLabel('Save as a generic glossary for later sessions').check();await page.getByRole('button',{name:'Apply glossary',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Glossary applied and saved locally');
 }finally{await app.close();}
 app=await electron.launch({args,env});
 try{
  const page=await app.firstWindow();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Languages',exact:true}).click();
  await expect(page.getByLabel('Recognition terms (one per line)')).toHaveValue('blood pressure');
  await expect(page.getByLabel('Directional translation mappings (source = target)')).toHaveValue('blood pressure = krvni pritisak\nkrvni pritisak = blood pressure');
  const result=await page.evaluate(()=>window.intera.command({type:'glossary',glossary:{terms:['duplicate','DUPLICATE'],translations:[]},save:true}));expect(result.ok).toBe(false);
  expect((await page.evaluate(()=>window.intera.snapshot())).glossary?.terms).toEqual(['blood pressure']);
 }finally{await app.close();}
});

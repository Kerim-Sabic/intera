import type {ElectronApplication,Page} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
/** Capture Electron's rendered surface. CDP Page.captureScreenshot intermittently
 * fails on Mac runners even when the renderer and native window are healthy. */
export async function desktopScreenshot(app:ElectronApplication,page:Page,options:{path:string}){
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 const win=await app.browserWindow(page);
 const png=await win.evaluate(async w=>{const image=await w.webContents.capturePage();if(image.isEmpty())throw new Error('Empty desktop screenshot');return image.toPNG().toString('base64');});
 await writeFile(options.path,Buffer.from(png,'base64'));
}

import { build } from 'esbuild';
import { build as vite } from 'vite';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await vite({root:'src/renderer',base:'./',build:{outDir:'../../dist/ui',emptyOutDir:true}});
await build({entryPoints:['src/main/main.ts','src/preload.ts','src/capture-preload.ts'],bundle:true,platform:'node',format:'cjs',outdir:'dist',entryNames:'[name]',outExtension:{'.js':'.cjs'},external:['electron'],packages:'bundle'});
await copyFile('src/capture/host.html','dist/host.html');
await copyFile('src/capture/host.js','dist/host.js');
await copyFile('src/capture/pcm-worklet.js','dist/pcm-worklet.js');

import {Resvg} from '@resvg/resvg-js';
import {mkdir,writeFile} from 'node:fs/promises';
const root='assets/brand';
await mkdir(`${root}/masters`,{recursive:true});await mkdir(`${root}/exports`,{recursive:true});
const shape=(a='#202D3C',b=a)=>`<path fill="${a}" d="M28 10H20C12 10 8 15 8 23V41C8 49 12 54 20 54H28V44H21C19 44 18 43 18 41V34L28 26V10Z"/><path fill="${b}" d="M36 54H44C52 54 56 49 56 41V23C56 15 52 10 44 10H36V20H43C45 20 46 21 46 23V30L36 38V54Z"/>`;
const svg=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const mark=svg(64,64,shape()),light=svg(64,64,shape('#F5F3ED'));
const wordmark=svg(450,88,`<g transform="translate(4 12)">${shape()}</g><text x="87" y="64" fill="#202D3C" font-family="Segoe UI, sans-serif" font-size="60" font-weight="600" letter-spacing="-2">Intera AI</text>`);
const icon=svg(1024,1024,`<rect x="32" y="32" width="960" height="960" rx="210" fill="#202D3C"/><g transform="translate(160 160) scale(11)">${shape('#F5F3ED','#91AED0')}</g>`);
const social=svg(1200,630,`<rect width="1200" height="630" fill="#F5F3ED"/><g transform="translate(84 82) scale(2)">${shape()}</g><text x="236" y="176" fill="#202D3C" font-family="Segoe UI, sans-serif" font-size="88" font-weight="600" letter-spacing="-3">Intera AI</text><path d="M90 266H1110" stroke="#D9DDD9"/><text x="90" y="352" fill="#202D3C" font-family="Segoe UI, sans-serif" font-size="45">Two languages. Your voice.</text><text x="90" y="416" fill="#526375" font-family="Segoe UI, sans-serif" font-size="27">Live transcription and translation for human interpreters.</text><text x="90" y="552" fill="#526375" font-family="Segoe UI, sans-serif" font-size="22">English ↔ Bosanski</text>`);
const masters={symbol:mark,'symbol-light':light,'symbol-color':svg(64,64,shape('#202D3C','#6D91BB')),wordmark,'wordmark-light':wordmark.replaceAll('#202D3C','#F5F3ED'),'app-icon':icon,social,'whop-cover':social.replaceAll('height="630"','height="675"').replace('0 0 1200 630','0 0 1200 675')};
const png=(source,size)=>new Resvg(source,{fitTo:{mode:'width',value:size},font:{loadSystemFonts:true}}).render().asPng();
for(const [name,source] of Object.entries(masters)){await writeFile(`${root}/masters/${name}.svg`,source);await writeFile(`${root}/exports/${name}.png`,png(source,name==='social'?1200:name==='whop-cover'?1280:name.startsWith('wordmark')?1440:1024));}
const sizes=[16,24,32,48,64,128,256,512,1024];
for(const size of sizes){await writeFile(`${root}/exports/symbol-${size}.png`,png(mark,size));await writeFile(`${root}/exports/icon-${size}.png`,png(icon,size));}
const icoSizes=[16,24,32,48,64,128,256],icoHeader=Buffer.alloc(6+16*icoSizes.length);icoHeader.writeUInt16LE(1,2);icoHeader.writeUInt16LE(icoSizes.length,4);let offset=icoHeader.length;
const icoImages=icoSizes.map((size,i)=>{const data=png(icon,size),p=6+i*16;icoHeader[p]=size===256?0:size;icoHeader[p+1]=icoHeader[p];icoHeader.writeUInt16LE(1,p+4);icoHeader.writeUInt16LE(32,p+6);icoHeader.writeUInt32LE(data.length,p+8);icoHeader.writeUInt32LE(offset,p+12);offset+=data.length;return data;});
await writeFile(`${root}/exports/intera.ico`,Buffer.concat([icoHeader,...icoImages]));
const chunks=Object.entries({icp4:16,icp5:32,icp6:64,ic07:128,ic08:256,ic09:512,ic10:1024,ic11:32,ic12:64,ic13:256,ic14:512}).map(([type,size])=>{const data=png(icon,size),h=Buffer.alloc(8);h.write(type);h.writeUInt32BE(data.length+8,4);return Buffer.concat([h,data]);});
const header=Buffer.alloc(8);header.write('icns');header.writeUInt32BE(8+chunks.reduce((n,b)=>n+b.length,0),4);await writeFile(`${root}/exports/intera.icns`,Buffer.concat([header,...chunks]));
await writeFile(`${root}/exports/favicon.png`,png(mark,32));
console.log('Brand masters, transparent PNGs, social artwork, ICO and ICNS exported.');


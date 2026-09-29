import type {Token} from './transcript';
const token=(text:string,language:string,speaker:string,translation=false,final=true):Token=>({text,is_final:final,language:translation?(language==='en'?'bs':'en'):language,source_language:translation?language:undefined,speaker,translation_status:translation?'translation':'original'});
export const demoEvents:Token[][]=[
 [token('Do not take fifty','en','1',false,false)],
 [token('Do not take 50 mg. Take 15 mg, once a day.','en','1')],
 [token('Nemojte uzimati 50 mg. Uzimajte 15 mg, jednom dnevno.','en','1',true)],
 [{text:'<end>',is_final:true}],
 [token('Nisam siguran. Mislim da je bilo 0,5 mg, ne 5 mg.','bs','2')],
 [token('I am not sure. I think it was 0.5 mg, not 5 mg.','bs','2',true)],
 [token(' Uzimam metformin — oprostite, ne uzimam ga više.','bs','2')],
 [token(' I take metformin — sorry, I no longer take it.','bs','2',true)],
 [token('Please repeat that. Do you have any pain?','en','1',false,false)],
 [token(' Please repeat that. Do you have any pain?','en','1')],
 [token(' Molim vas, ponovite to. Imate li bolova?','en','1',true)],
 [{text:'<end>',is_final:true}]
];

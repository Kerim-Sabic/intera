// Soniox's published real-time language set, verified 2026-10-08.
// https://soniox.com/docs/stt/concepts/supported-languages
export const languageCodes = ['af','sq','ar','az','eu','be','bn','bs','bg','ca','zh','hr','cs','da','nl','en','et','fi','fr','gl','de','el','gu','he','hi','hu','id','it','ja','kn','kk','ko','lv','lt','mk','ms','ml','mr','no','fa','pl','pt','pa','ro','ru','sr','sk','sl','es','sw','sv','tl','ta','te','th','tr','uk','ur','vi','cy'] as const;
export type LanguageCode = typeof languageCodes[number];
export const languageNames:Record<LanguageCode,string> = {
 af:'Afrikaans',sq:'Albanian',ar:'Arabic',az:'Azerbaijani',eu:'Basque',be:'Belarusian',bn:'Bengali',bs:'Bosnian',bg:'Bulgarian',ca:'Catalan',zh:'Chinese',hr:'Croatian',cs:'Czech',da:'Danish',nl:'Dutch',en:'English',et:'Estonian',fi:'Finnish',fr:'French',gl:'Galician',de:'German',el:'Greek',gu:'Gujarati',he:'Hebrew',hi:'Hindi',hu:'Hungarian',id:'Indonesian',it:'Italian',ja:'Japanese',kn:'Kannada',kk:'Kazakh',ko:'Korean',lv:'Latvian',lt:'Lithuanian',mk:'Macedonian',ms:'Malay',ml:'Malayalam',mr:'Marathi',no:'Norwegian',fa:'Persian',pl:'Polish',pt:'Portuguese',pa:'Punjabi',ro:'Romanian',ru:'Russian',sr:'Serbian',sk:'Slovak',sl:'Slovenian',es:'Spanish',sw:'Swahili',sv:'Swedish',tl:'Tagalog',ta:'Tamil',te:'Telugu',th:'Thai',tr:'Turkish',uk:'Ukrainian',ur:'Urdu',vi:'Vietnamese',cy:'Welsh'
};
export function languageName(code:string){return languageNames[code as LanguageCode]??(code==='und'||code==='unknown'?'Not identified yet':code);}
type Direction={mode:string;languageA?:string;languageB?:string;targetLanguage?:string};
export function translationTarget(p:Direction){return p.mode==='en'||p.mode==='bs'?p.mode:p.targetLanguage??'bs';}
export function selectedLanguages(p:Direction):string[]{return [...new Set(p.mode==='en'||p.mode==='bs'?['en','bs']:p.mode==='one_way'?[p.languageA??'en',translationTarget(p)]:[p.languageA??'en',p.languageB??'bs'])];}
export function directionLabel(p:Direction){return p.mode==='none'?`${selectedLanguages(p).map(languageName).join(' / ')} · transcription`:p.mode==='two_way'?`${languageName(p.languageA??'en')} ↔ ${languageName(p.languageB??'bs')}`:`${languageName(p.mode==='en'?'bs':p.mode==='bs'?'en':p.languageA??'en')} → ${languageName(translationTarget(p))}`;}
export function expectsTranslation(language:string,p:Direction){return p.mode!=='none'&&selectedLanguages(p).includes(language)&&(p.mode==='two_way'||language!==translationTarget(p));}

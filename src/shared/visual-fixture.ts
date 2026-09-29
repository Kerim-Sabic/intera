import {initialTranscript,type Group} from './transcript';
// Synthetic visual-test content. Activated only with --test-isolated --visual-fixture.
const turns=[
 ['Good morning. Can everyone hear the meeting clearly?','Dobro jutro. Mogu li svi jasno čuti sastanak?'],
 ['Da, čujem vas. Molim vas da govorite jednu po jednu rečenicu.','Yes, I can hear you. Please speak one sentence at a time.'],
 ['Of course. We will leave space for the interpreter.','Naravno. Ostavit ćemo vremena za prevodioca.'],
 ['Could you confirm the appointment time: 10:15 or 10:50?','Možete li potvrditi vrijeme termina: 10:15 ili 10:50?'],
 ['Termin je u 10:15, u utorak.','The appointment is at 10:15 on Tuesday.'],
 ['Thank you. I will repeat that to make sure I understood.','Hvala. Ponovit ću to da provjerim jesam li razumio.'],
 ['The interpreter is asking for clarification; this is not a new instruction.','Prevodilac traži pojašnjenje; ovo nije nova uputa.'],
 ['Možete li ponoviti naziv mjesta? Nisam siguran da sam dobro čuo.','Could you repeat the name of the place? I am not sure I heard it correctly.'],
 ['The entrance is beside the library, not behind the building.','Ulaz je pored biblioteke, a ne iza zgrade.'],
 ['Razumijem. Da li trebam donijeti obrazac koji ste poslali?','I understand. Should I bring the form you sent?'],
 ['Yes. Bring the form, and leave the signature line blank until we review it together.','Da. Donesite obrazac i ostavite red za potpis prazan dok ga ne pregledamo zajedno.'],
 ['Before we finish, I have one more question. Could we go through the next steps slowly, including where to wait and whom to ask for when I arrive?','Prije nego završimo, imam još jedno pitanje. Možemo li polako proći kroz sljedeće korake, uključujući gdje trebam čekati i kome se trebam obratiti kada stignem?']
];
export function visualFixture(){const t=initialTranscript();t.epoch=1;t.event=12;t.serial=12;t.groups=turns.map(([source,translation],i):Group=>({id:`visual-${i}`,epoch:1,speaker:String(i%3+1),language:i%3===1?'bs':'en',source,translation:i===10?'':translation,sourceDraft:'',translationDraft:i===10?'Da. Donesite obrazac…':'',revision:1,boundary:true,unpaired:false,...(i===2?{pinned:{source,translation,revision:1}}:{}),...(i===5?{edit:{source,translation}}:{}),...(i===8?{interpreted:{source:'The entrance is behind the building.',translation:'Ulaz je iza zgrade.',revision:0}}:{})}));return t;}

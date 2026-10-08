import React,{useEffect,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type {Command,State} from '../shared/protocol';

export function NewMeetingDialog({open,onOpenChange,s,send,done}:{open:boolean;onOpenChange:(open:boolean)=>void;s:State;send:(command:Command)=>Promise<{ok:boolean;message?:string}>;done?:()=>void}){
 const [title,setTitle]=useState(''),[working,setWorking]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(open){setTitle(s.meetingTitle??`Meeting ${new Date().toLocaleDateString()}`);setError('');}},[open]);
 const unsaved=!!s.transcript.groups.length&&!s.savedMeeting;
 async function start(save:boolean){setWorking(true);setError('');try{const result=await send(save?{type:'save-and-new-meeting',title:title.trim()||`Meeting ${new Date().toLocaleString()}`}:{type:'new-meeting'});if(result.ok){onOpenChange(false);done?.();}else setError(result.message??'Could not start a new meeting. Your text is still here.');}catch{setError('Could not complete the request. Your current text has been retained.');}finally{setWorking(false);}}
 return <Dialog.Root open={open} onOpenChange={next=>{if(!working)onOpenChange(next);}}><Dialog.Portal><Dialog.Overlay className="overlay"/><Dialog.Content className="confirm new-meeting-dialog"><Dialog.Title>Start a fresh meeting</Dialog.Title><Dialog.Description>{unsaved?'Keep this conversation before clearing the reader. Your next meeting starts with a clean transcript and new speaker labels.':'Your saved meetings stay in the library. The reader and speaker labels will reset for your next meeting.'}</Dialog.Description>
 {unsaved&&<><label>Save current meeting as<input aria-label="Save current meeting as" value={title} maxLength={120} onChange={e=>setTitle(e.target.value)}/></label>{!s.secureStorage&&<p role="status">Secure saving is unavailable. Export your text before clearing if you need to keep it.</p>}</>}
 <div className="actions"><Dialog.Close disabled={working}>Cancel</Dialog.Close>{unsaved?<><button disabled={working} onClick={()=>void start(false)}>Discard & start fresh</button><button className="primary" disabled={working||!s.secureStorage||s.storageLoading} onClick={()=>void start(true)}>{working?'Saving…':'Save & start fresh'}</button></>:<button className="primary" disabled={working} onClick={()=>void start(false)}>Start fresh</button>}</div>{error&&<p role="alert" className="warning">{error}</p>}
 </Dialog.Content></Dialog.Portal></Dialog.Root>;
}

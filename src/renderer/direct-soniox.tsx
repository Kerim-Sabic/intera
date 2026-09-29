import React,{useEffect,useState} from 'react';
import type {Command,State} from '../shared/protocol';
import {destination,type Preferences} from '../shared/config';

type Reply={ok:boolean;message?:string};
const steps=['Create account','Add funds','Create key','Connect & test'] as const;

export function DirectSoniox({s,send,onNext}:{s:State;send:(c:Command)=>Promise<Reply>;onNext?:()=>void}){
 const [key,setKey]=useState(''),[region,setRegion]=useState(s.preferences.region),[persist,setPersist]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[step,setStep]=useState(0);
 const active=['connecting','listening','stopping','local-test'].includes(s.status);
 useEffect(()=>{setRegion(s.preferences.region);setMessage('');},[s.preferences.region]);
 async function perform(c:Command){
  setBusy(true);setMessage('');
  try{
   const result=await send(c);
   setMessage(result.ok?(c.type==='validate-key'?'The key can list models. No audio was sent. This does not check your balance or live transcription access.':c.type==='connect-personal'?'Key connected. Next, run the local playback test.':c.type==='forget-key'?'Key removed from Intera. You can also revoke it in Soniox.':result.message??''):result.message??'Could not complete this step.');
  }catch{setMessage('Could not complete this step. Your key was not displayed or logged.');}
  finally{setBusy(false);}
 }
 const open=(page:'console'|'pricing'|'keys')=>void perform({type:'provider-page',page});
 return <section className="direct-soniox" aria-label="Pay Soniox directly">
  <h3>Pay Soniox directly</h3>
  <p>Follow four short steps. You pay Soniox for your API use. <strong>Intera adds no usage fee.</strong> You do not need an Intera account.</p>
  <nav className="provider-progress" aria-label="Soniox setup steps">{steps.map((name,i)=><button key={name} aria-current={step===i?'step':undefined} onClick={()=>{setStep(i);setMessage('');}}>{i+1}. {name}</button>)}</nav>
  {step===0&&<div className="provider-step"><h4>1. Create your Soniox account</h4><p>Click below to open the Soniox API Console in your browser. Sign up or sign in there. Create a project if Soniox has not made one for you.</p><p className="hint">Use the API Console. A subscription to the separate Soniox consumer app does not connect Intera.</p><div className="actions"><button onClick={()=>open('console')}>Open Soniox API Console ↗</button><button className="primary" onClick={()=>setStep(1)}>I have a project →</button></div></div>}
  {step===1&&<div className="provider-step"><h4>2. Check payment and set a limit</h4><p>In Soniox, open your organization’s <strong>Billing</strong> page. Review its current price and add credit or choose AutoPay yourself. Intera never asks for your card.</p><p>Set a project budget and alert in Soniox so you can watch spending. Soniox controls the bill; its limits may take time to apply.</p><div className="actions"><button onClick={()=>open('console')}>Open Soniox Console ↗</button><button onClick={()=>open('pricing')}>See Soniox pricing ↗</button><button className="primary" onClick={()=>setStep(2)}>I reviewed billing →</button></div></div>}
  {step===2&&<div className="provider-step"><h4>3. Make a key for Intera</h4><p>In Soniox, open <strong>your project → API keys → Create API key</strong>. Name it “Intera”. Turn on <strong>Speech-to-text, real-time</strong>. You may also turn on <strong>Model listing</strong> for the optional check in step 4. Leave unrelated permissions off.</p><p>Click Create and copy the key when it appears. Soniox shows the full key only once. Keep it private; you will paste it into Intera in the next step.</p><p className="hint">Only a Soniox organization admin can create or edit keys.</p><div className="actions"><button onClick={()=>open('console')}>Open Soniox project ↗</button><button onClick={()=>open('keys')}>See key instructions ↗</button><button className="primary" onClick={()=>setStep(3)}>I copied my key →</button></div></div>}
  {step===3&&<div className="provider-step"><h4>4. Connect and test</h4><p>Choose the same region as your Soniox project, paste the key below, then connect. Intera keeps it on this device and sends audio directly to your Soniox project when you start listening.</p>
   {s.preferences.funding==='personal'&&<p className="account-message">Direct payment selected · {s.keyStored?'Key connected':'Connect your key below'}</p>}
   <form onSubmit={e=>{e.preventDefault();const value=key;setKey('');void perform({type:'connect-personal',key:value,region,persist:persist&&s.secureStorage});}}>
    <label>Soniox project region<select value={region} disabled={active||busy} onChange={e=>setRegion(e.target.value as Preferences['region'])}><option value="us">United States</option><option value="eu">European Union</option><option value="jp">Japan</option><option value="in">India</option></select></label>
    <p className="hint">Match the region shown in your Soniox project. Other regions may require Soniox approval.</p>
    <p className="destination">Audio destination: {destination(region)}</p>
    <label>Your Soniox API key<input type="password" autoComplete="off" spellCheck={false} maxLength={512} value={key} disabled={active||busy} onChange={e=>setKey(e.target.value)} placeholder={s.keyStored?'Paste a new key to replace the connected key':'Paste the key you just copied'}/></label>
    <label className="check"><input type="checkbox" checked={persist&&s.secureStorage} disabled={!s.secureStorage||busy||active} onChange={e=>setPersist(e.target.checked)}/>Remember on this device using secure storage</label>
    <p className="hint">{s.secureStorage?'Uncheck this for a one-session key.':'Secure storage is unavailable, so this key lasts only for this app session.'} Your key does not go to Intera’s billing server.</p>
    <button type="submit" className="primary" disabled={active||busy||!key.trim()}>Connect my Soniox key</button>
   </form>
   {s.keyStored&&<div className="actions"><button disabled={active||busy} onClick={()=>void perform({type:'validate-key'})}>Check key without audio</button><button disabled={active||busy} onClick={()=>void perform({type:'forget-key'})}>Forget key</button>{s.preferences.funding!=='personal'&&<button disabled={active||busy} onClick={()=>void perform({type:'preferences',preferences:{...s.preferences,funding:'personal'},timing:'next'})}>Use this Soniox account</button>}</div>}
   <p className="hint">Next: run Intera’s local playback test, then start an authorized meeting. The local test sends nothing to Soniox. A successful key check does not prove that your account has credit or live access. See final charges in Soniox.</p>
   {onNext&&<button onClick={onNext}>Go to playback test →</button>}
  </div>}
  {active&&<p role="status">Stop listening before changing the key, region or payment mode.</p>}
  {message&&<p role="status" className="account-message">{message}</p>}
  <details className="provider-help"><summary>Something not working?</summary><p><strong>Key rejected:</strong> confirm you copied the full key from the right project and chose its region. <strong>Permission denied:</strong> enable Speech-to-text, real-time for that key in Soniox. <strong>Balance or budget reached:</strong> review Billing and limits in Soniox. After fixing it, start a new session yourself.</p></details>
 </section>;
}

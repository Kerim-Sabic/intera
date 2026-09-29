import React,{useEffect,useState} from 'react';
import type {Command,State} from '../shared/protocol';
import {destination,type Preferences} from '../shared/config';
type Reply={ok:boolean;message?:string};
export function DirectSoniox({s,send}:{s:State;send:(c:Command)=>Promise<Reply>}){
 const [key,setKey]=useState(''),[region,setRegion]=useState(s.preferences.region),[persist,setPersist]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const active=['connecting','listening','stopping','local-test'].includes(s.status);
 useEffect(()=>{setRegion(s.preferences.region);setMessage('');},[s.preferences.region]);
 async function perform(c:Command){setBusy(true);setMessage('');try{const result=await send(c);setMessage(result.ok?(c.type==='validate-key'?'Key accepted by the model-listing API. No audio was sent. Balance, real-time permission and billing are not verified.':c.type==='connect-personal'?'Connected. Soniox bills your account directly. Next, try the local playback test.':c.type==='forget-key'?'Key removed from Intera. You can also revoke it in Soniox.':result.message??''):result.message??'Could not complete this step.');}catch{setMessage('Could not complete this step. Your key was not displayed or logged.');}finally{setBusy(false);}}
 return <section className="direct-soniox" aria-label="Pay Soniox directly">
  <h3>Pay Soniox directly</h3><p>Use your own Soniox account. <strong>No Intera usage fee or markup.</strong> Soniox bills you for API use under its pricing and tax terms. An Intera sign-in is not required for this mode.</p>
  {s.preferences.funding==='personal'&&<p className="account-message">Direct payment selected · {s.keyStored?'Key connected':'Connect your key below'}</p>}
  <ol className="provider-steps">
   <li><h4>Set up your Soniox account</h4><p>Open the Console, create your own organization and project, then review Billing. Add credit or choose AutoPay there yourself. Intera never collects your card or enables recurring charges.</p><div className="actions"><button onClick={()=>void perform({type:'provider-page',page:'console'})}>Open Soniox Console ↗</button><button onClick={()=>void perform({type:'provider-page',page:'pricing'})}>View Soniox pricing ↗</button></div></li>
   <li><h4>Set limits and create a project key</h4><p>Choose a budget and alert threshold in Soniox. Create a dedicated key with Real-time Speech-to-Text access; Model listing access enables the optional check below. Leave unrelated permissions off. Provider limits may take time to apply.</p><button onClick={()=>void perform({type:'provider-page',page:'keys'})}>Key permissions guide ↗</button></li>
   <li><h4>Connect securely</h4><form onSubmit={e=>{e.preventDefault();const value=key;setKey('');void perform({type:'connect-personal',key:value,region,persist:persist&&s.secureStorage});}}>
    <label>Soniox project region<select value={region} disabled={active||busy} onChange={e=>setRegion(e.target.value as Preferences['region'])}><option value="us">United States</option><option value="eu">European Union</option><option value="jp">Japan</option><option value="in">India</option></select></label>
    <p className="hint">Match the region of your Soniox project. Regional access may need Soniox approval; selecting a region here does not enable it.</p>
    <p className="destination">{destination(region)}</p>
    <label>Your Soniox API key<input type="password" autoComplete="off" spellCheck={false} maxLength={512} value={key} disabled={active||busy} onChange={e=>setKey(e.target.value)} placeholder={s.keyStored?'Enter a new key to replace the connected key':'Paste your project key here'}/></label>
    <label className="check"><input type="checkbox" checked={persist&&s.secureStorage} disabled={!s.secureStorage||busy||active} onChange={e=>setPersist(e.target.checked)}/>Remember using this device’s secure storage</label>
    <p className="hint">{s.secureStorage?'Otherwise, the key is kept only for this app session.':'Secure storage is unavailable. The key will be kept only for this app session.'} It is sent to Soniox, never to Intera’s billing server.</p>
    <button type="submit" className="primary" disabled={active||busy||!key.trim()}>Connect and use direct payment</button>
   </form>
   {s.keyStored&&<div className="actions"><button disabled={active||busy} onClick={()=>void perform({type:'validate-key'})}>Check saved key without audio</button><button disabled={active||busy} onClick={()=>void perform({type:'forget-key'})}>Forget key</button>{s.preferences.funding!=='personal'&&<button disabled={active||busy} onClick={()=>void perform({type:'preferences',preferences:{...s.preferences,funding:'personal'},timing:'next'})}>Use connected Soniox account</button>}</div>}
   </li>
  </ol>
  {active&&<p role="status">Stop listening before changing the key, region or payment mode.</p>}
  {message&&<p role="status" className="account-message">{message}</p>}
  <p className="hint">Your key being accepted does not prove a funded balance. View final charges in Soniox. Personal sessions never spend Intera subscription hours.</p>
 </section>;
}

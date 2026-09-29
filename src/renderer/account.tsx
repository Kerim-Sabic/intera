import React,{useEffect,useState} from 'react';
import type {BillingCommand,BillingView} from '../shared/billing';

export function AccountPanel(){
  const [view,setView]=useState<BillingView|null>(null),[email,setEmail]=useState(''),[code,setCode]=useState(''),
    [sent,setSent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function send(command:BillingCommand){
    setBusy(true);setMessage('');
    try{const result=await window.intera.billing(command);if(result.view)setView(result.view);
      setMessage(result.message??'');if(result.ok&&command.type==='send-code')setSent(true);
      if(result.ok&&command.type==='verify-code')setCode('');
    }catch{setMessage('The account service could not be reached. Please try again.');}finally{setBusy(false);}
  }
  useEffect(()=>{void send({type:'status'});},[]);
  const summary=view?.summary;
  return <section className="account-panel" aria-label="Account and billing">
    <h2>Account & billing</h2>
    <p>English ↔ Bosnian, with the same interpretation settings on every plan.</p>
    {message&&<p role="status" className="account-message">{message}</p>}
    {!view?<div><p>{busy?'Loading account…':'Account unavailable.'}</p><button disabled={busy} onClick={()=>void send({type:'status'})}>Try again</button></div>:!view.configured?<>
      <p className="account-message">Paid plans are not available in this build yet.</p>
      <p>Your existing Soniox key and desktop settings continue to work. Account service setup and payment testing are still required.</p>
    </>:!view.email?<form onSubmit={e=>{e.preventDefault();void send(sent?{type:'verify-code',email,code}:{type:'send-code',email});}}>
      <label>Email<input type="email" value={email} disabled={busy||sent} required onChange={e=>setEmail(e.target.value)}/></label>
      {sent&&<label>Sign-in code<input inputMode="numeric" autoComplete="one-time-code" value={code} required pattern="[0-9]{6,10}" onChange={e=>setCode(e.target.value)}/></label>}
      <button className="primary" disabled={busy}>{sent?'Verify code':'Email me a code'}</button>
      {sent&&<button type="button" disabled={busy} onClick={()=>{setSent(false);setCode('');}}>Use another email</button>}
    </form>:<>
      <div className="account-actions"><span>{view.email}</span><button disabled={busy} onClick={()=>void send({type:'sign-out'})}>Sign out</button><button disabled={busy} onClick={()=>void send({type:'status'})}>Refresh billing</button></div>
      {summary&&<>
        <p><strong>{Math.floor(summary.remainingMs/60_000).toLocaleString()} minutes remaining</strong> · {summary.environment==='sandbox'?'Sandbox · test purchases only':'Paid allowance'}</p>
        <p>Managed streaming is not released yet. This balance does not enable listening with an Intera company key.</p>
        {summary.memberships.map(m=><div className="membership" key={m.id}>
          <span>Subscription: {m.blocked?'Ownership review required':m.status}{m.cancel_at_period_end?' · cancels at period end':''}</span>
          <button disabled={busy||m.blocked} onClick={()=>void send({type:'portal',membershipId:m.id})}>Manage subscription</button>
        </div>)}
        <div className="plan-list">{summary.catalog.map(offer=><div className="plan" key={offer.id}>
          <div><strong>{offer.label}</strong><p>{offer.milliseconds/3_600_000} hours · ${offer.cents/100} {offer.recurring?'every 30 days':'one-time'}</p></div>
          <button disabled={busy||!summary.salesEnabled} onClick={()=>void send({type:'checkout',offer:offer.id})}>{offer.recurring?'Choose plan':'Buy extra time'}</button>
        </div>)}</div>
        <p>Tax is added at checkout where applicable. Extra time is an explicit purchase and does not expire. Payment must be confirmed by the server before time appears here.</p>
      </>}
    </>}
  </section>;
}

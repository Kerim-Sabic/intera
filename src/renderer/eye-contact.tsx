import React,{useEffect,useState,useRef} from 'react';
import type {State,Command} from '../shared/protocol';
import {gazeDefaults,gazeSettingsSchema,type GazeSettings} from '../shared/eye-contact';
function savedCalibration(){try{const parsed=gazeSettingsSchema.safeParse(JSON.parse(localStorage.getItem('intera-gaze-calibration')??'null'));if(parsed.success)return parsed.data;}catch{/* Only generic calibration preferences are stored. */}return {...gazeDefaults};}
export function EyeContactPanel({s,send}:{s:State;send:(command:Command)=>Promise<{ok:boolean;message?:string}>}){
 const [settings,setSettings]=useState<GazeSettings>(savedCalibration),[frame,setFrame]=useState(''),[message,setMessage]=useState('');
 const output=useRef(false);output.current=!!s.eyeContact?.output;
 useEffect(()=>{const remove=window.intera.gazeFrames(setFrame);void send({type:'gaze-check'});return()=>{remove();if(!output.current)void send({type:'gaze-stop'});};},[]);
 const view=s.eyeContact,active=view?.status==='preview'||view?.status==='starting';
 async function perform(command:Command){const result=await send(command);setMessage(result.ok?'':result.message??'Camera action failed.');}
 function change(next:GazeSettings){setSettings(next);const checked=gazeSettingsSchema.safeParse(next);if(!checked.success)return;try{localStorage.setItem('intera-gaze-calibration',JSON.stringify(checked.data));}catch{/* Storage failure does not start a camera. */}if(view?.status==='preview')void perform({type:'gaze-configure',settings:checked.data});}
 return <section aria-label="Integrated eye contact">
  <h3>Eye contact · gaze correction</h3><p>Local gaze correction with an Intera Camera output for your meeting app. Development feature for macOS 14 or later.</p>
  <div className="config-preview" aria-label="Camera readiness checklist">
   <span>Supported Mac <b>{view?.supported?'macOS requirement met':'Requires macOS 14 or later'}</b></span>
   <span>Camera engine <b>{view?.installed?'Present · models checked when starting':'Not included in this installer'}</b></span>
   <span>Signed camera bridge <b>{view?.extensionAvailable?'Available · owner activation required':'Unavailable'}</b></span>
   <span>Meeting output <b>{view?.output?'On · verify your meeting preview':'Off'}</b></span>
  </div>
  {view?.checked&&!view.installed&&<p role="note">This setting is included, but gaze correction cannot run in this build. Updating macOS or granting camera permission does not install the missing engine, approved models, or signed camera extension.</p>}
  <p role="status">{view?.message??'Checking availability…'}</p>
  {view?.installed&&<div style={{background:'#171D26',minHeight:160,borderRadius:12,display:'grid',placeItems:'center',overflow:'hidden'}}>{frame?<img alt="Live local camera preview" src={'data:image/jpeg;base64,'+frame} style={{width:'100%',maxWidth:640,maxHeight:240,objectFit:'contain'}}/>:<p style={{color:'#EDF1F5'}}>Camera off</p>}</div>}
  <p className="hint">Zoom output requires the signed Intera Camera extension and your macOS approval. This beta has not been verified in a real Zoom call. No camera recordings or frame uploads.</p>
  <div className="actions">
   <button disabled={active||!view?.installed} onClick={()=>void perform({type:'gaze-start',settings})}>Start local camera preview</button>
   <button disabled={!active} onClick={()=>void perform({type:'gaze-stop'})}>Stop camera</button>
   <button onClick={()=>void perform({type:'gaze-check'})}>Check camera readiness</button>
  </div>
  {view?.supported&&<>
   <label style={{display:'flex',alignItems:'center',gap:12}}>Camera index<input style={{width:80}} type="number" min="0" max="8" value={settings.camera} disabled={active} onChange={e=>change({...settings,camera:Number(e.target.value)})}/></label>
   <p className="hint">0 selects the first input camera; Intera Camera is excluded to prevent feedback. Stop preview before selecting another input.</p>
   <label style={{display:'flex',alignItems:'center',gap:10}}><input style={{width:18,height:18}} type="checkbox" checked={settings.enabled} onChange={e=>change({...settings,enabled:e.target.checked})}/>Enable gaze correction</label>
   <details><summary>Adjust camera calibration</summary>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12}}>
     {(['offsetX','offsetY','offsetZ','focalLength'] as const).map(key=><label key={key}>{({offsetX:'Horizontal offset (cm)',offsetY:'Vertical offset (cm)',offsetZ:'Depth offset (cm)',focalLength:'Focal length (px)'})[key]}<input type="number" step={key==='focalLength'?10:0.5} min={key==='focalLength'?300:key==='offsetY'?-40:key==='offsetX'?-30:-20} max={key==='focalLength'?1500:key==='offsetY'?40:key==='offsetX'?30:20} value={settings[key]} onChange={e=>change({...settings,[key]:Number(e.target.value)})}/></label>)}
    </div><button onClick={()=>change({...gazeDefaults,camera:settings.camera})}>Reset calibration</button>
   </details>
   <div className="actions">
    <button disabled={!view?.extensionAvailable||active} onClick={()=>void perform({type:'gaze-activate'})}>Enable Intera Camera in macOS</button>
    <button disabled={view?.status!=='preview'||!view?.extensionAvailable||view?.output} onClick={()=>void perform({type:'gaze-output'})}>Start camera output</button>
   </div>
   <p className="hint">After activation, select Intera Camera in Zoom’s camera menu. Preview alone stops when this section closes. Once camera output starts, close Settings to read and use Camera on · Stop in the toolbar to end it. Listening and playback permissions remain separate.</p>
  </>}
  {message&&<p role="status">{message}</p>}
 </section>;
}

let stream,context,node,generation=0;
async function stop(){if(node){node.port.postMessage('stop');node.disconnect();node=null;}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}if(context){const old=context;context=null;await old.close();}}
window.capture.onCommand(async cmd=>{
 const current=++generation;
 let stage='cleanup';
 try{
  await stop();if(cmd.type==='stop'||current!==generation)return;
  const phase=value=>{stage=value;window.capture.diagnostic(cmd.epoch,value);};
  phase('acquire');
  const acquired=await navigator.mediaDevices.getDisplayMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:{width:16,height:16,frameRate:1}});
  if(current!==generation){acquired.getTracks().forEach(t=>t.stop());return;}
  phase('validate-tracks');stream=acquired;if(!stream.getAudioTracks().length){const error=new Error();error.name='NoPlaybackTrack';throw error;}
  if(stream.getAudioTracks().some(t=>t.readyState==='ended')){const error=new Error();error.name='DeadAudioTrack';throw error;}
  stream.getTracks().forEach(t=>t.onended=()=>{if(current!==generation)return;generation++;window.capture.error(cmd.epoch,'SourceEnded','ready');void stop();});
  phase('audio-context');context=new AudioContext({latencyHint:'interactive'});const localContext=context;phase('worklet');await localContext.audioWorklet.addModule('pcm-worklet.js');
  if(current!==generation)return;
  phase('audio-graph');const source=context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
  node=new AudioWorkletNode(context,'pcm',{numberOfOutputs:1,channelCountMode:'max',processorOptions:{packetMs:cmd.packetMs}});
  const mute=context.createGain();mute.gain.value=0;source.connect(node);node.connect(mute).connect(context.destination);
  const localNode=node;
  node.port.onmessage=async e=>{if(current!==generation)return;const d=e.data;if(d.error){const code=({'Unsupported channel count':'UnsupportedChannels','Audio format changed':'AudioFormatChanged','Audio backlog exceeded two seconds':'QueueOverflow'})[d.error]??'CaptureFailure';window.capture.error(cmd.epoch,code,'ready');await stop();}else if(d.format){window.capture.format(cmd.epoch,d.format);}else if(d.buffer){await window.capture.packet(cmd.epoch,d.position,d.buffer);localNode.port.postMessage('ack');}};
  phase('context-resume');await localContext.resume();phase('ready');
 }catch(error){if(current===generation){window.capture.error(cmd.epoch,['NotAllowedError','InvalidStateError','NotFoundError','NotReadableError','AbortError','OverconstrainedError','TypeError','SecurityError','NoPlaybackTrack','DeadAudioTrack'].includes(error?.name)?error.name:'CaptureFailure',stage);try{await stop();}catch{/* Preserve the original capture failure. */}}}
});

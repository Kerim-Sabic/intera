let stream,context,node,generation=0;
async function stop(){generation++;if(node){node.port.postMessage('stop');node.disconnect();node=null;}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}if(context){const old=context;context=null;await old.close();}}
window.capture.onCommand(async cmd=>{
 if(cmd.type==='stop'){await stop();return;}
 await stop();const current=generation;
 try{
  const acquired=await navigator.mediaDevices.getDisplayMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:{width:16,height:16,frameRate:1}});
  if(current!==generation){acquired.getTracks().forEach(t=>t.stop());return;}
  stream=acquired;if(!stream.getAudioTracks().length){const error=new Error();error.name='NoPlaybackTrack';throw error;}
  if(stream.getAudioTracks().some(t=>t.readyState==='ended')){const error=new Error();error.name='DeadAudioTrack';throw error;}
  stream.getTracks().forEach(t=>t.onended=()=>{window.capture.error(cmd.epoch,'SourceEnded');void stop();});
  context=new AudioContext({latencyHint:'interactive'});await context.audioWorklet.addModule('pcm-worklet.js');
  if(current!==generation)return;
  const source=context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
  node=new AudioWorkletNode(context,'pcm',{numberOfOutputs:1,channelCountMode:'max',processorOptions:{packetMs:cmd.packetMs}});
  const mute=context.createGain();mute.gain.value=0;source.connect(node);node.connect(mute).connect(context.destination);
  const localNode=node;
  node.port.onmessage=async e=>{if(current!==generation)return;const d=e.data;if(d.error){window.capture.error(cmd.epoch,d.error);await stop();}else if(d.format){window.capture.format(cmd.epoch,d.format);}else if(d.buffer){await window.capture.packet(cmd.epoch,d.position,d.buffer);localNode.port.postMessage('ack');}};
  await context.resume();
 }catch(error){if(current===generation){window.capture.error(cmd.epoch,['NotAllowedError','InvalidStateError','NotFoundError','NotReadableError','AbortError','NoPlaybackTrack','DeadAudioTrack'].includes(error.name)?error.name:'CaptureFailure');await stop();}}
});

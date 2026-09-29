/* Native AudioContext rate; interleaved signed PCM16 LE, channels preserved. */
class PCM extends AudioWorkletProcessor {
  constructor(options){super();this.ms=options.processorOptions.packetMs;this.size=Math.round(sampleRate*this.ms/1000);this.channels=0;this.offset=0;this.position=0;this.inflight=0;this.stopped=false;this.port.onmessage=e=>{if(e.data==='ack')this.inflight=Math.max(0,this.inflight-1);if(e.data==='stop')this.stopped=true;};}
  process(inputs){
    if(this.stopped)return false;
    const input=inputs[0];if(!input?.length||!input[0]?.length)return true;
    if(!this.channels){this.channels=input.length;if(this.channels>2){this.port.postMessage({error:'Unsupported channel count'});return false;}this.data=new ArrayBuffer(this.size*this.channels*2);this.view=new DataView(this.data);this.port.postMessage({format:{sampleRate,channels:this.channels}});}
    if(input.length!==this.channels){this.port.postMessage({error:'Audio format changed'});return false;}
    for(let n=0;n<input[0].length;n++){
      for(let c=0;c<this.channels;c++){const f=Math.max(-1,Math.min(1,input[c][n]));this.view.setInt16((this.offset*this.channels+c)*2,Math.round(f<0?f*32768:f*32767),true);}
      this.offset++;
      if(this.offset===this.size){
        if(this.inflight>=Math.ceil(2000/this.ms)){this.stopped=true;this.port.postMessage({error:'Audio backlog exceeded two seconds'});return false;}
        this.inflight++;this.port.postMessage({buffer:this.data,position:this.position},[this.data]);this.position+=this.size;this.offset=0;this.data=new ArrayBuffer(this.size*this.channels*2);this.view=new DataView(this.data);
      }
    }
    return true;
  }
}
registerProcessor('pcm',PCM);

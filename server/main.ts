import { configuration } from './catalog';
import { postgres } from './db';
import { WhopProvider } from './whop';
import { BillingService } from './billing';
import { billingServer, supabaseAuthenticator } from './http';
import {SonioxProvider,streamConfiguration} from './soniox';
import {StreamingService} from './streaming';
import {vipConfiguration} from './vip-config';
import {VipService} from './vip';
import {VipTreasury} from './vip-treasury';

const config=configuration(process.env);
const db=postgres(process.env.DATABASE_URL??'');
const service=new BillingService(db,new WhopProvider(config),config);
const streamConfig=streamConfiguration(process.env);
const streaming=new StreamingService(db,new SonioxProvider(streamConfig),streamConfig);
const vipConfig=vipConfiguration(process.env);
const vip=new VipService(db,service.provider,config,vipConfig,new VipTreasury(db,vipConfig,{environment:config.environment,companyId:config.companyId,projectRef:streamConfig.projectRef,region:streamConfig.region}));
service.vipPayments=vip;streaming.vip=vip;
const server=billingServer(service,supabaseAuthenticator(db,process.env.SUPABASE_URL??'',process.env.SUPABASE_PUBLISHABLE_KEY??''),streaming,vip);
server.requestTimeout=15_000;server.headersTimeout=10_000;server.maxHeadersCount=40;
const ready=service.initialize().then(async()=>{try{await streaming.initialize();}catch{console.error('Managed streaming is unavailable; billing remains independent.');}});
ready.then(()=>server.listen(Number(process.env.PORT??8787),process.env.BIND_HOST??'127.0.0.1'))
  .catch(()=>{console.error('Billing database initialization failed. Server not started.');process.exitCode=1;void close();});
let working=false,reconciling=false;
const jobs=setInterval(async()=>{if(working)return;working=true;try{await ready;await service.workOne();}
  catch{console.error('Billing worker failed; durable jobs remain queued.');}finally{working=false;}},1000);
async function reconcile(){if(reconciling)return;reconciling=true;try{await ready;await service.reconcileAll();}
  catch{console.error('Canonical billing reconciliation failed; retry required.');}finally{reconciling=false;}}
const sweep=setInterval(()=>void reconcile(),5*60_000);void reconcile();
let metering=false;
const usage=setInterval(async()=>{if(metering)return;metering=true;try{await ready;await streaming.reconcile();}catch{console.error('Provider usage reconciliation failed; reservations retained.');}finally{metering=false;}},30_000);
async function close(){clearInterval(jobs);clearInterval(sweep);clearInterval(usage);server.close();await db.close();}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());

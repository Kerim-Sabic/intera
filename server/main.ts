import { configuration } from './catalog';
import { postgres } from './db';
import { WhopProvider } from './whop';
import { BillingService } from './billing';
import { billingServer, supabaseAuthenticator } from './http';

const config=configuration(process.env);
const db=postgres(process.env.DATABASE_URL??'');
const service=new BillingService(db,new WhopProvider(config),config);
const server=billingServer(service,supabaseAuthenticator(db,process.env.SUPABASE_URL??'',process.env.SUPABASE_PUBLISHABLE_KEY??''));
server.requestTimeout=15_000;server.headersTimeout=10_000;server.maxHeadersCount=40;
const ready=service.initialize();
ready.then(()=>server.listen(Number(process.env.PORT??8787),process.env.BIND_HOST??'127.0.0.1'))
  .catch(()=>{console.error('Billing database initialization failed. Server not started.');process.exitCode=1;void close();});
let working=false,reconciling=false;
const jobs=setInterval(async()=>{if(working)return;working=true;try{await ready;await service.workOne();}
  catch{console.error('Billing worker failed; durable jobs remain queued.');}finally{working=false;}},1000);
async function reconcile(){if(reconciling)return;reconciling=true;try{await ready;await service.reconcileAll();}
  catch{console.error('Canonical billing reconciliation failed; retry required.');}finally{reconciling=false;}}
const sweep=setInterval(()=>void reconcile(),5*60_000);void reconcile();
async function close(){clearInterval(jobs);clearInterval(sweep);server.close();await db.close();}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());

import {streamConfiguration,SonioxProvider} from '../server/soniox';
import {postgres} from '../server/db';
import {StreamingService} from '../server/streaming';
async function main(){
const required=['DATABASE_URL','SONIOX_API_KEY','SONIOX_PROJECT_REF','SONIOX_REGION','MANAGED_BETA_ACCOUNT_IDS'];
const missing=required.filter(k=>!process.env[k]);
if(missing.length){console.log(JSON.stringify({status:'NOT_RUN',missing,publicAdmission:'DISABLED',liveSettlement:'NOT_RUN'},null,2));process.exitCode=2;}
else{const config=streamConfiguration(process.env),db=postgres(process.env.DATABASE_URL!);try{
 const provider=new SonioxProvider(config);await provider.check();
 const service=new StreamingService(db,provider,config);await service.initialize();
 console.log(JSON.stringify({status:'CONFIGURATION_CHECK_PASSED',region:config.region,internalBeta:config.enabled,publicAdmission:'DISABLED',liveSettlement:'NOT_RUN',note:'No temporary key issued; no audio sent. Project safeguards and real settlement still require verification.'},null,2));
}catch{console.log(JSON.stringify({status:'BLOCKED',reason:'Provider or database readiness check failed. No secrets or raw provider response logged.'}));process.exitCode=1;}finally{await db.close();}}

}
void main();


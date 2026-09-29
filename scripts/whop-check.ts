import {configuration} from '../server/catalog';

async function main(){
  const required=['DATABASE_URL','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','WHOP_COMPANY_ID','WHOP_API_KEY',
    'WHOP_WEBHOOK_SECRET','WHOP_PLAN_ESSENTIAL','WHOP_PLAN_PROFESSIONAL','WHOP_PLAN_INTENSIVE','WHOP_PLAN_EXTRA','BILLING_RETURN_URL'];
  const missing=required.filter(key=>!process.env[key]);
  if(missing.length){
    console.log(JSON.stringify({status:'NOT_RUN',reason:'Sandbox credentials and deployment configuration are not available.',missing,
      merchantApproval:'UNVERIFIED',bosniaHerzegovinaPayouts:'UNVERIFIED',taxDashboardSetup:'UNVERIFIED',production:'BLOCKED'},null,2));
    process.exitCode=2;return;
  }
  const config=configuration(process.env);
  if(config.environment!=='sandbox')throw new Error('This test tool only permits the Whop sandbox.');
  if(!process.argv.includes('--send-webhook-test')){
    console.log('Sandbox configuration parsed. No payment or remote webhook test was performed.');return;
  }
  const webhookId=process.env.WHOP_TEST_WEBHOOK_ID;
  if(!webhookId || !/^hook_[a-zA-Z0-9]+$/.test(webhookId))throw new Error('Configure WHOP_TEST_WEBHOOK_ID.');
  // Official testing facility. This sends synthetic events, not a real paid order.
  for(const event of ['payment.succeeded','payment.failed','refund.created','membership.deactivated']){
    const response=await fetch(`https://sandbox-api.whop.com/api/v1/webhooks/${webhookId}/test`,{
      method:'POST',redirect:'error',headers:{Authorization:`Bearer ${config.apiKey}`,'Api-Version-Date':'2026-09-29','Content-Type':'application/json'},
      body:JSON.stringify({event}),signal:AbortSignal.timeout(15_000)});
    // Do not print the provider body: test delivery records may contain PII or secrets.
    console.log(JSON.stringify({event,whopRequestStatus:response.status,fulfillmentVerified:false}));
    if(!response.ok)process.exitCode=1;
  }
}
main().catch(()=>{console.error('Sandbox check failed. Check server configuration without sharing secrets.');process.exitCode=1;});

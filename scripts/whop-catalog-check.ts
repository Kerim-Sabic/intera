import {offers,type Offer} from '../server/catalog';
import {CURRENT_VERSION,validateCatalogVariant} from '../server/whop';

async function main(){
  if(process.env.WHOP_ENVIRONMENT!=='sandbox')throw new Error('Sandbox only');
  const company=process.env.WHOP_COMPANY_ID, key=process.env.WHOP_API_KEY;
  if(!company || !/^biz_[a-zA-Z0-9]+$/.test(company) || !key)throw new Error('Missing sandbox configuration');
  for(const offer of Object.keys(offers) as Offer[]){
    const id=process.env[`WHOP_PLAN_${offer.toUpperCase()}`];
    if(!id || !/^plan_[a-zA-Z0-9]+$/.test(id))throw new Error('Missing plan');
    const response=await fetch(`https://sandbox-api.whop.com/api/v1/variants/${id}`,{
      headers:{Authorization:`Bearer ${key}`,'Api-Version-Date':CURRENT_VERSION},
      redirect:'error',signal:AbortSignal.timeout(10_000)});
    if(!response.ok){console.log(JSON.stringify({offer,id,status:'BLOCKED',http:response.status}));process.exitCode=1;continue;}
    const value=await response.json();
    try{validateCatalogVariant(value,offer,id,company);console.log(JSON.stringify({offer,id,status:'VERIFIED_CATALOG'}));}
    catch{console.log(JSON.stringify({offer,id,status:'BLOCKED',reason:'Catalog mismatch',
      adaptivePricingEnabled:value.adaptive_pricing_enabled===true,
      taxExclusive:value.collect_tax===true&&value.tax_type==='exclusive'}));process.exitCode=1;}
  }
}
void main().catch(()=>{console.error('Sandbox catalog check failed. No provider body or credential logged.');process.exitCode=1;});

export function providerFailure(type:string|undefined,code:number,personal:boolean){
 const owner=personal?'Open your Soniox Console':'Ask the Intera service operator';
 const messages:Record<string,string>={
  invalid_request:'Soniox rejected the session configuration. Review language settings and glossary size before starting again.',
  organization_balance_exhausted:`Soniox balance exhausted. ${owner} to review funding. No automatic retry or payment was made by Intera.`,
  organization_monthly_budget_exhausted:`Soniox organization budget reached. ${owner} to review its limit.`,
  project_monthly_budget_exhausted:`Soniox project budget reached. ${owner} to review its limit.`,
  unauthenticated:personal?'Soniox rejected your key. Check the connected key and project region in Setup guide.':'Managed provider credential was rejected. Stop and refresh account readiness.',
  permission_denied:personal?'Your Soniox key needs real-time Speech-to-Text permission in the matching project region.':'Managed provider permission is unavailable.',
 };
 return messages[type??'']??`Soniox request failed (${code}). Check key, regional access, quota or connection; resume explicitly.`;
}

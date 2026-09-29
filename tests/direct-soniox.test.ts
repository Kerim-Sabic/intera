import {it,expect} from 'vitest';
import {commandSchema} from '../src/shared/protocol';
import {providerLinks} from '../src/shared/provider-links';
import {providerFailure} from '../src/shared/provider-errors';
it('permits only fixed provider destinations without renderer-supplied URLs',()=>{
 expect(commandSchema.safeParse({type:'provider-page',page:'console',url:'https://untrusted.example'}).success).toBe(false);
 expect(commandSchema.safeParse({type:'provider-page',page:'https://untrusted.example'}).success).toBe(false);
 for(const page of Object.keys(providerLinks))expect(commandSchema.safeParse({type:'provider-page',page}).success).toBe(true);
});
it('validates personal credentials and region at the trusted boundary',()=>{
 expect(commandSchema.safeParse({type:'connect-personal',key:'',region:'us',persist:false}).success).toBe(false);
 expect(commandSchema.safeParse({type:'connect-personal',key:'fixture',region:'unknown',persist:false}).success).toBe(false);
 expect(commandSchema.parse({type:'connect-personal',key:' fixture ',region:'eu',persist:false})).toMatchObject({key:'fixture',region:'eu'});
});
it('explains funding and permission failures without echoing provider-supplied text',()=>{
 expect(providerFailure('organization_balance_exhausted',402,true)).toContain('No automatic retry or payment');
 expect(providerFailure('project_monthly_budget_exhausted',402,false)).toContain('Intera service operator');
 expect(providerFailure('permission_denied',403,true)).toContain('real-time Speech-to-Text');
 expect(providerFailure('private-provider-message',400,true)).not.toContain('private-provider-message');
});

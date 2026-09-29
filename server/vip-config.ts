import {z} from 'zod';
import {usd} from './vip-money';
export type VipConfig={inviteEnabled:boolean;inviteHash:string;generation:string;topupsEnabled:boolean;sessionsEnabled:boolean;
 autoTopupEnabled:boolean;publicEnabled:boolean;autopayExpected:boolean;operators:Set<string>;plans:Record<string,string>;
 reserveUsd:string;sessionSeconds:number;treasury:{kill:boolean;low:string;target:string;single:string;daily:string;monthly:string;cooldownSeconds:number}};
export function vipConfiguration(env:NodeJS.ProcessEnv):VipConfig {
 const plans:Record<string,string>={};
 for(const amount of ['11','22','55','110'])if(env[`WHOP_VIP_PLAN_${amount}`])plans[amount]=z.string().regex(/^plan_[a-zA-Z0-9]+$/).parse(env[`WHOP_VIP_PLAN_${amount}`]);
 if(new Set(Object.values(plans)).size!==Object.keys(plans).length)throw new Error('VIP plans must be distinct.');
 const money=(key:string,defaultValue:string)=>{const value=env[key]??defaultValue;usd(value);return value;};
 return {inviteEnabled:env.VIP_INVITATION_ENABLED==='true',inviteHash:env.VIP_INVITE_SHA256??'',generation:env.VIP_INVITE_GENERATION??'unset',
 topupsEnabled:env.VIP_TOPUPS_ENABLED==='true',sessionsEnabled:env.VIP_SESSIONS_ENABLED==='true',autoTopupEnabled:env.VIP_AUTO_TOPUP_ENABLED==='true',
 publicEnabled:env.VIP_PUBLIC_ENABLED==='true',autopayExpected:env.VIP_PROVIDER_AUTOPAY_EXPECTED==='true',
 operators:new Set((env.INTERA_OPERATOR_USER_IDS??'').split(',').filter(Boolean).map(x=>z.uuid().parse(x.trim()))),plans,
 reserveUsd:money('VIP_SESSION_RESERVE_USD','1.10'),sessionSeconds:z.coerce.number().int().min(1).max(1800).parse(env.VIP_SESSION_MAX_SECONDS??300),
 treasury:{kill:env.VIP_PROVIDER_FUNDING_KILL_SWITCH!=='false',low:money('VIP_PROVIDER_LOW_WATERMARK_USD','0'),target:money('VIP_PROVIDER_TARGET_USD','0'),single:money('VIP_PROVIDER_MAX_REFILL_USD','0'),daily:money('VIP_PROVIDER_DAILY_MAX_USD','0'),monthly:money('VIP_PROVIDER_MONTHLY_MAX_USD','0'),cooldownSeconds:z.coerce.number().int().min(300).max(86400).parse(env.VIP_PROVIDER_REFILL_COOLDOWN_SECONDS??3600)}};
}

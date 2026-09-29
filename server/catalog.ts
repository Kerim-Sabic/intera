import { z } from 'zod';

export const offers = {
  essential: { label: 'Essential', cents: 1900, milliseconds: 36_000_000, recurring: true },
  professional: { label: 'Professional', cents: 4900, milliseconds: 180_000_000, recurring: true },
  intensive: { label: 'Intensive', cents: 9900, milliseconds: 540_000_000, recurring: true },
  extra: { label: '10 extra hours', cents: 1500, milliseconds: 36_000_000, recurring: false },
} as const;
export const offerSchema = z.enum(['essential', 'professional', 'intensive', 'extra']);
export type Offer = z.infer<typeof offerSchema>;
export type BillingConfig = {
  environment: 'sandbox' | 'production'; companyId: string; apiKey: string; webhookSecret: string;
  plans: Record<Offer, string>; returnUrl: string; salesEnabled: boolean;
  taxArrangement: 'whop_collects_and_remits'; taxBehavior: 'exclusive';
};

export function configuration(env: NodeJS.ProcessEnv): BillingConfig {
  const environment = z.enum(['sandbox', 'production']).parse(env.WHOP_ENVIRONMENT ?? 'sandbox');
  const enabled = env.BILLING_SALES_ENABLED === 'true';
  // Attestations refer to evidence stored by the operator; they are not approvals granted by code.
  if (enabled && environment === 'production') {
    for (const gate of ['WHOP_MERCHANT_APPROVAL_REFERENCE', 'WHOP_BIH_PAYOUT_VERIFIED_REFERENCE',
      'WHOP_TAX_SETUP_VERIFIED_REFERENCE', 'WHOP_SANDBOX_REPORT_REFERENCE', 'MANAGED_METERING_RELEASE_REFERENCE']) {
      if (!env[gate]?.trim()) throw new Error(`Production sales blocked: ${gate} is missing.`);
    }
  }
  const plans = Object.fromEntries(Object.keys(offers).map(key => [key,
    z.string().regex(/^plan_[a-zA-Z0-9]+$/).parse(env[`WHOP_PLAN_${key.toUpperCase()}`])])) as Record<Offer, string>;
  if (new Set(Object.values(plans)).size !== 4) throw new Error('Each offer requires a different plan ID.');
  const returnUrl = z.url().parse(env.BILLING_RETURN_URL);
  if (new URL(returnUrl).protocol !== 'https:') throw new Error('Return URL must use HTTPS.');
  return {
    environment, plans, returnUrl, salesEnabled: enabled,
    companyId: z.string().regex(/^biz_[a-zA-Z0-9]+$/).parse(env.WHOP_COMPANY_ID),
    apiKey: z.string().min(10).parse(env.WHOP_API_KEY),
    webhookSecret: z.string().startsWith('ws_').min(20).parse(env.WHOP_WEBHOOK_SECRET),
    taxArrangement: z.literal('whop_collects_and_remits').parse(env.WHOP_TAX_ARRANGEMENT),
    taxBehavior: z.literal('exclusive').parse(env.WHOP_TAX_BEHAVIOR),
  };
}

// Convert provider decimals exactly. Reject sub-cent/negative/unsafe money instead of rounding.
export function cents(value: unknown): number {
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('Unsupported money precision.');
  const [whole, fraction = ''] = text.split('.');
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Money outside supported range.');
  return Number(amount);
}

export function hostedUrl(value: string, config: Pick<BillingConfig, 'environment'>): string {
  const url = new URL(value);
  const host = config.environment === 'sandbox' ? 'sandbox.whop.com' : 'whop.com';
  if (url.protocol !== 'https:' || url.hostname !== host || url.port || url.username || url.password)
    throw new Error('Untrusted billing destination.');
  return url.href;
}

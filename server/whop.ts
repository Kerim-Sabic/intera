import { z } from 'zod';
import { unwrapWebhook } from '@whop/sdk/helpers';
import { cents, hostedUrl, offers, type BillingConfig, type Offer } from './catalog';

// Current docs still expose manage_url and both period boundaries on this supported
// compatibility pin. Do not silently use an API key's newer, incompatible default.
export const COMPAT_VERSION = '2025-01-01';
export const CURRENT_VERSION = '2026-09-29';
const identifier = z.string().regex(/^[a-z]+_[a-zA-Z0-9]+$/);
const reference = z.object({ id: identifier });
const date = z.iso.datetime({ offset: true });
const money = z.union([z.number(), z.string()]).transform(cents);
const metadata = z.record(z.string(), z.unknown()).nullable();
export const paymentSchema = z.object({
  id: identifier, company: reference, plan: reference.nullable(), membership: reference.nullable(),
  user: reference.nullable(), metadata, checkout_configuration_id: identifier.nullable(),
  status: z.string().nullable(), substatus: z.string(), currency: z.string(),
  subtotal: money.nullable(), total: money.nullable(), tax_amount: money.nullable(),
  refunded_amount: money.nullable(), tax_refunded_amount: money.nullable(),
  paid_at: date.nullable(), created_at: date, billing_reason: z.string().nullable(),
  disputes: z.array(z.object({status:z.string()})),
});
export type Payment = z.infer<typeof paymentSchema>;
export const membershipSchema = z.object({
  id: identifier, company: reference, plan: reference, user: reference.nullable(), metadata,
  status: z.string(), cancel_at_period_end: z.boolean(), manage_url: z.url().nullable(),
  renewal_period_start: date.nullable(), renewal_period_end: date.nullable(),
});
export type Membership = z.infer<typeof membershipSchema>;
export interface Provider {
  checkout(offer: Offer, accountId: string, intentId: string): Promise<{ id: string; url: string }>;
  payment(id: string): Promise<Payment>;
  membership(id: string): Promise<Membership>;
  payments(membershipId?: string): AsyncIterable<string>;
  eventPayment(type: string, resourceId: string): Promise<string>;
  retireCheckout(id:string):Promise<void>;
}

export class WhopProvider implements Provider {
  private base: string;
  constructor(private config: BillingConfig, private request: typeof fetch = fetch) {
    this.base = config.environment === 'sandbox' ? 'https://sandbox-api.whop.com/api/v1' : 'https://api.whop.com/api/v1';
  }
  private async api(path: string, body?: unknown, version = COMPAT_VERSION): Promise<unknown> {
    const response = await this.request(this.base + path, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error',
      headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Api-Version-Date': version, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Whop request failed (${response.status}).`);
    return response.json(); // Never log the response: provider objects can include PII.
  }
  async checkout(offer: Offer, accountId: string, intentId: string) {
    const planId = this.config.plans[offer], product = offers[offer];
    const variant = z.object({id:identifier, account:reference, currency:z.literal('usd'),
      plan_type:z.enum(['renewal','one_time']), initial_price:money, renewal_price:money,
      billing_period:z.number().nullable(), trial_period_days:z.number().nullable(),
      collect_tax:z.boolean(), tax_type:z.string(), adaptive_pricing_enabled:z.boolean(),
      split_pay_required_payments:z.number().nullable(),
    }).parse(await this.api(`/variants/${planId}`, undefined, CURRENT_VERSION));
    if (variant.id !== planId || variant.account.id !== this.config.companyId ||
      variant.plan_type !== (product.recurring ? 'renewal' : 'one_time') ||
      variant.initial_price !== (product.recurring ? 0 : product.cents) ||
      variant.renewal_price !== (product.recurring ? product.cents : 0) ||
      (product.recurring && variant.billing_period !== 30) ||
      variant.trial_period_days || variant.split_pay_required_payments ||
      !variant.collect_tax || variant.tax_type !== 'exclusive' || variant.adaptive_pricing_enabled)
      throw new Error('Whop plan does not match the approved Intera catalog and tax settings.');
    const result = z.object({id:identifier, purchase_url:z.url()}).parse(await this.api('/checkout_configurations', {
      plan_id: planId, mode: 'payment', redirect_url: this.config.returnUrl,
      // Explicit allowlist. No email, transcript, diagnosis, context, or arbitrary client metadata.
      metadata: { intera_billing_account_id: accountId, intera_checkout_intent_id: intentId,
        intera_environment: this.config.environment, intera_catalog: '2026-09-v1' },
    }));
    return {id:result.id, url:hostedUrl(result.purchase_url, this.config)};
  }
  async payment(id: string) { return paymentSchema.parse(await this.api(`/payments/${identifier.parse(id)}`)); }
  async retireCheckout(id:string){
    const response=await this.request(`${this.base}/checkout_configurations/${identifier.parse(id)}`,{
      method:'DELETE',redirect:'error',headers:{Authorization:`Bearer ${this.config.apiKey}`,'Api-Version-Date':CURRENT_VERSION},
      signal:AbortSignal.timeout(10_000)});
    if(!response.ok && response.status!==404)throw new Error('Checkout retirement failed.');
  }
  async membership(id: string) { return membershipSchema.parse(await this.api(`/memberships/${identifier.parse(id)}`)); }
  async eventPayment(type: string, resourceId: string) {
    const resource = type.startsWith('refund.') ? 'refunds' : 'disputes';
    const result = z.object({payment:reference}).parse(await this.api(`/${resource}/${identifier.parse(resourceId)}`));
    return result.payment.id;
  }
  async *payments(membershipId?: string) {
    let after: string | undefined;
    do {
      const params = new URLSearchParams({account_id:this.config.companyId, first:'100'});
      if (membershipId) params.set('membership_id', identifier.parse(membershipId));
      if (after) params.set('after', after);
      const page = z.object({data:z.array(reference), page_info:z.object({has_next_page:z.boolean(), end_cursor:z.string().nullable()})})
        .parse(await this.api(`/payments?${params}`,undefined,CURRENT_VERSION));
      for (const payment of page.data) yield payment.id;
      const next = page.page_info.has_next_page ? page.page_info.end_cursor : null;
      if (page.page_info.has_next_page && (!next || next === after)) throw new Error('Invalid Whop pagination.');
      after = next ?? undefined;
    } while (after);
  }
}

export function verifyEvent(raw: string, headers: Record<string,string>, config: BillingConfig) {
  const parsed = unwrapWebhook(raw, {headers, key:config.webhookSecret});
  const event = z.object({type:z.string().max(100), api_version:z.literal('v1'),
    company_id:identifier, data:z.object({id:identifier})}).parse(parsed);
  if (event.company_id !== config.companyId) throw new Error('Wrong Whop company.');
  return event;
}

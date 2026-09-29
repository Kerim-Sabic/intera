import {z} from 'zod';
export const billingCommand=z.discriminatedUnion('type',[
  z.object({type:z.literal('status')}).strict(),
  z.object({type:z.literal('send-code'),email:z.email().max(254)}).strict(),
  z.object({type:z.literal('verify-code'),email:z.email().max(254),code:z.string().regex(/^\d{6,10}$/)}).strict(),
  z.object({type:z.literal('sign-out')}).strict(),
  z.object({type:z.literal('checkout'),offer:z.enum(['essential','professional','intensive','extra'])}).strict(),
  z.object({type:z.literal('portal'),membershipId:z.string().regex(/^mem_[a-zA-Z0-9]+$/)}).strict(),
]);
export type BillingCommand=z.infer<typeof billingCommand>;
export const billingSummary=z.object({
  environment:z.enum(['sandbox','production']),salesEnabled:z.boolean(),managedStreamingAvailable:z.boolean(),
  usage:z.object({availableMs:z.number(),reservedMs:z.number(),finalizing:z.boolean(),reviewRequired:z.boolean(),region:z.enum(['us','eu','jp','in'])}).optional(),
  remainingMs:z.number().nonnegative(),
  pendingCheckoutOffers:z.array(z.string()),
  memberships:z.array(z.object({id:z.string(),status:z.string(),blocked:z.boolean(),cancel_at_period_end:z.boolean(),period_end:z.string().nullable()})),
  catalog:z.array(z.object({id:z.enum(['essential','professional','intensive','extra']),label:z.string(),cents:z.number(),milliseconds:z.number(),recurring:z.boolean()})),
});
export type BillingView={configured:boolean;email?:string;summary?:z.infer<typeof billingSummary>};
export type BillingReply={ok:boolean;message?:string;view?:BillingView};

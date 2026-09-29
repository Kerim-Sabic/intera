# Funding and launch gates

Owner instruction, 2026-09-29: do not purchase anything; fund API use from customer revenue and retain the surplus. No automatic top-ups, payouts, charges or purchases were enabled by this build.

Whop and Soniox have separate balances. A successful customer payment does not itself credit Soniox. Sandbox payments create no spendable revenue. Payment confirmation can grant customer time, but admission must remain gated until actual provider funding and project readiness exist. Gross subscription receipts are not profit: API spend, payment fees, refunds, taxes and operating costs must be accounted for. No margin is guaranteed by the configured prices.

Observed staging state: Soniox balance $0, autopay off, project monthly cap $0 and concurrency 1. Scoped model-listing and usage-log reads work. No billable session or temporary key issuance was tested. The project dashboard warns of delayed limit enforcement; its spending cap is not represented as a strict per-credential dollar guarantee.

## Required before customer-funded public use

- Owner chooses how available business funds reach Soniox after payment settlement. No automatic Whop-to-Soniox transfer exists in this implementation.
- Maintain a working-capital reserve for payout delays, the 30-minute Intera trial, refunds and disputed payments. Do not sell unusable allowance while provider balance is zero.
- Owner reviews provider funding and a suitable spending limit, then explicitly authorizes paid live testing. Until then, preserve the zero cap and disabled managed admission.
- Verify real hosted email-code auth, canonical sandbox payments, signed webhooks and authoritative provider settlement. Complete native hardware tests and distribution requirements.
- Complete merchant review for the disclosed interpreter-assistance use case, Bosnia and Herzegovina payout onboarding and the merchant tax arrangement.
- Resolve the documented direct-stream enforcement exposure before public paid admission; do not silently introduce an audio relay.

The existing prices and allowance rules are unchanged. No automatic overage charge or quality difference between paid tiers was introduced.

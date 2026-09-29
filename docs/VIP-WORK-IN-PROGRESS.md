# VIP work preserved after owner priority change

Owner chose guided direct Soniox payment on 2026-09-30. This branch preserves unfinished VIP prepaid work separately from that delivery. It is not ready for release.

Implemented locally: exact 14-decimal USD arithmetic, 10% fee breakdown, separate credit grants/reservations/settlements, onboarding-only hashed invitation checks and retry limits, private schema migration, canonical payment hook, supervised treasury inputs, gated admission and operator entitlement routes. Thirteen new local tests passed. The existing baseline had 75 passing tests. Full combined regression and UI integration are not complete.

The VIP migration has NOT been applied to hosted staging. The owner invitation verifier has NOT been configured. No VIP products, purchases, saved-method charges or provider refills were created. No production switch is enabled. Do not merge this branch without finishing and reviewing its financial controls.

Observed production Intera company: biz_LwVKDimC5UMz8L. Whop Cards shows identity verification required and reports account review is needed before applying. No card issued. Soniox organization Intera still has AutoPay off; its payment setup displays a $10 threshold and $20 refill, with an immediate-charge warning. No Save and charge action was performed. Card acceptance and automatic funding are unverified.

The owner asked about direct customer payment and selected a guided Personal key experience: customers establish their own Soniox billing and connect their own key. Existing regular subscriptions remain intact.

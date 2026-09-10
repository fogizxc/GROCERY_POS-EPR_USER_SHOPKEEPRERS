# FreshCart production services

These modules contain business rules that must remain deterministic and independently testable:

- `orderPricing.ts` — delivery-fee and order-total rules.
- `orderLifecycle.ts` — allowed order-status transitions.
- `idempotency.ts` — order idempotency-key validation.

Keep these rules server-side. Client calculations are presentation only and must never be trusted for totals, inventory, payment state, or order transitions.

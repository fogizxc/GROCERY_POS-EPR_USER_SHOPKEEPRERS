# FreshCart production readiness

## Release gate

A release is production-ready only when all of these are true:

1. `npm test` passes.
2. `npm run build` passes.
3. Production Docker image builds.
4. CI is green on the exact release commit.
5. MongoDB is deployed as a replica set or sharded cluster because order creation/cancellation use multi-document transactions.
6. Production secrets are supplied through the hosting platform, never committed to Git.
7. Razorpay live credentials and webhook secret are configured and the webhook endpoint is reachable over HTTPS.
8. `/health` and `/ready` are monitored.
9. Database backups and rollback procedures are configured.
10. A real hosting target exists and has been smoke-tested end-to-end.

## Security

- Keep `JWT_SECRET`, `MONGODB_URI`, payment secrets, webhook secrets, and other credentials in the hosting secret store.
- Never commit real passwords or API keys.
- Partner passwords are generated server-side and returned only at creation/reset time.
- Keep admin and super-admin access least-privileged and review audit logs regularly.
- Partner phone numbers are the active-account uniqueness key; names and emails are not identity keys.

## MongoDB operations

- Enable automated backups and point-in-time recovery where supported.
- Periodically perform a restore drill into a non-production database.
- Monitor connection failures, slow queries, storage, and index health.
- Preserve the unique indexes required by the application schema.

## Orders, inventory, and payments

- Server-side validation must remain authoritative for product price, stock, delivery fee, discounts, and final total.
- Keep checkout idempotent so network retries cannot create duplicate orders.
- Test concurrent checkout and stock reservation behavior.
- Test the complete order state machine and valid cancellation paths.
- Verify pickup collection requires the correct shop and pickup code.
- Verify payment webhook signatures and make webhook processing idempotent.
- Test successful, failed, cancelled, duplicate, and delayed payment callbacks.

## Notifications and operations

- Test customer, shopkeeper, employee, payment, stock, and offer notifications.
- Avoid duplicate notifications when requests are retried.
- Monitor API 5xx rate, latency, authentication failures, MongoDB errors, order failures, payment failures, stock failures, delivery failures, and hosting runtime failures.

## Vercel

- Configure all production environment variables in the Vercel project.
- Confirm the deployment build completes successfully before declaring the release live.
- Use a production domain and configure the matching `CLIENT_ORIGIN`.
- Review serverless runtime logs after each release.

## Not a substitute for deployment

Publishing the container to GHCR proves the image can be built and published; it does not by itself deploy FreshCart to a public production URL. A hosting target must be configured separately.

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

## Not a substitute for deployment

Publishing the container to GHCR proves the image can be built and published; it does not by itself deploy FreshCart to a public production URL. A hosting target must be configured separately.

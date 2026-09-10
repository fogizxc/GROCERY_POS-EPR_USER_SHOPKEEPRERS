# FreshCart Production Runbook

## Required services

- Node.js 20 runtime
- MongoDB Atlas or another MongoDB deployment configured as a replica set or sharded cluster
- Razorpay live account and webhook endpoint
- HTTPS reverse proxy/load balancer
- Persistent secret storage for environment variables

FreshCart order creation and cancellation use MongoDB transactions. Do not deploy against a standalone MongoDB server.

## Required environment

Set these values in the deployment platform secret/environment configuration. Never commit real values:

- `NODE_ENV=production`
- `PORT=4000`
- `CLIENT_ORIGIN=https://your-production-domain`
- `MONGODB_URI=<replica-set-or-atlas-connection-string>`
- `MONGODB_DB=freshcart`
- `JWT_SECRET=<random-secret-at-least-32-characters>`
- `RAZORPAY_KEY_ID=<live-key-id>`
- `RAZORPAY_KEY_SECRET=<live-key-secret>`
- `RAZORPAY_WEBHOOK_SECRET=<webhook-secret>`
- `VITE_API_URL=` when the frontend and API share the same origin; otherwise set the public API origin at frontend build time.

## Startup checks

1. Start the application container.
2. Confirm `GET /health` returns HTTP 200.
3. Confirm `GET /ready` reports the expected production dependencies.
4. Confirm MongoDB indexes are created successfully.
5. Verify customer registration/login.
6. Verify a test catalog query.
7. Verify Razorpay webhook signature handling using a controlled test event before enabling live traffic.

## Payments

For online payments, create the FreshCart order first, then create the provider payment order and verify the returned payment server-side. Never trust a browser-reported captured/paid status.

Webhook deliveries must be signed and deduplicated. Monitor failed payment events and reconcile abandoned online orders so reserved stock and delivery slots are eventually released.

## MongoDB backup and recovery

Enable automated backups and point-in-time recovery on the managed MongoDB deployment. Test restoration before launch and periodically thereafter.

## Deployment

The repository publishes a production container to GHCR from `main`. A hosting platform must pull the published image and provide the production environment variables. Publishing the image does not by itself deploy a public service.

Recommended deployment sequence:

1. CI tests pass.
2. Production image builds successfully.
3. Image is published to GHCR.
4. Hosting platform deploys the immutable image digest.
5. Readiness probe succeeds.
6. Traffic is shifted to the new revision.
7. Smoke tests are executed against the public endpoint.

## Rollback

Keep the previous known-good container image digest available. If health checks, payment processing, order creation, or database connectivity regress after deployment, roll traffic back to the previous digest and investigate before retrying.

## Security checklist

- Use HTTPS only.
- Keep MongoDB and Razorpay credentials out of Git.
- Use a strong random JWT secret.
- Restrict `CLIENT_ORIGIN` to the real frontend origin.
- Keep Razorpay webhook secrets private.
- Review rate-limit and reverse-proxy settings before high traffic.
- Monitor authentication failures, payment failures, order errors, and database connectivity.

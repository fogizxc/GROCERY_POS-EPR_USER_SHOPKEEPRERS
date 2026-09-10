# FreshCart Grocery Platform

FreshCart is a responsive three-sided grocery ecosystem for customers, shopkeepers/employees, and owners/admins.

## Product surfaces

- **Customer:** discovery, search, categories, cart, checkout, delivery slots, orders, wishlist and reorder flows.
- **Shopkeeper / Employee:** incoming orders, picking/packing, substitutions, stock alerts, attendance and daily operations.
- **Admin / Owner ERP:** sales and order dashboards, inventory, catalog, shops, staff, customers, delivery and reporting.

## Stack

- React + TypeScript + Vite + Tailwind CSS
- Express API
- MongoDB persistence
- Razorpay online payments with signed checkout verification and webhooks
- Lucide icons
- Docker production image

## Run locally

```bash
npm install
npm run dev
```

API only:

```bash
npm run server
```

Full local development:

```bash
npm run dev:full
```

Copy `.env.example` to `.env`. For a persistent local environment, configure `MONGODB_URI`; the application can fall back to in-memory demo data during development.

## Production configuration

Production startup intentionally fails closed unless these values are present:

- `NODE_ENV=production`
- `PORT`
- `CLIENT_ORIGIN`
- `MONGODB_URI` and optional `MONGODB_DB`
- `JWT_SECRET` with at least 32 characters
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Use MongoDB Atlas or another MongoDB deployment that supports transactions/replica sets. Order placement reserves inventory and delivery capacity inside a MongoDB transaction.

Expose these endpoints to your load balancer/container platform:

- `GET /health` — process health
- `GET /ready` — readiness; returns `503` until MongoDB is connected
- `POST /api/payments/webhook` — Razorpay webhook endpoint; preserve the raw JSON request body for signature verification

Never commit `.env` or real payment/database credentials. Configure secrets in the hosting platform or CI/CD environment.

## Admin catalog management

Authenticated `admin` and `super_admin` users can manage the production catalog through:

- `POST /api/admin/catalog/products`
- `PATCH /api/admin/catalog/products/:id`
- `PATCH /api/admin/catalog/products/:id/active`
- `POST /api/admin/catalog/shops`
- `PATCH /api/admin/catalog/shops/:id`

Product writes validate required catalog fields, non-negative stock/pricing and the MRP/selling-price relationship; MongoDB unique indexes protect SKU/barcode conflicts.

## Docker

Build locally:

```bash
docker build -t freshcart:local .
```

Run with an environment file:

```bash
docker run --env-file .env -p 4000:4000 freshcart:local
```

The image serves the built frontend and Express API from the same process. The container health check uses `/health`.

## CI / release

GitHub Actions performs regression tests, the TypeScript/Vite build and production Docker build on pushes and pull requests to `main`. The release workflow publishes the production image to GHCR on `main` and records the immutable image digest in the workflow summary.

The release workflow pins its Docker publishing actions to immutable commit SHAs.

## Architecture direction

`Customer -> FreshCart Platform -> Nearby / Assigned Shop -> Shopkeeper / Employee -> Delivery`

The repository is intentionally independent from the legacy liquor ERP repository.

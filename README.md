# FreshCart Grocery Platform

FreshCart is a responsive three-sided grocery ecosystem for customers, shopkeepers/employees, and owners/admins.

## Product surfaces

- **Customer:** discovery, search, categories, cart, checkout, delivery slots, orders, wishlist and reorder flows.
- **Shopkeeper / Employee:** incoming orders, picking/packing, substitutions, stock alerts, attendance and daily operations.
- **Admin / Owner ERP:** sales and order dashboards, inventory, catalog, shops, staff, customers, delivery and reporting.

## Stack

- React + TypeScript + Vite + Tailwind CSS
- Express API
- MongoDB-ready persistence
- Lucide icons

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

Copy `.env.example` to `.env` and set `MONGODB_URI` when using MongoDB. Without it, the API still exposes health/config endpoints and returns demo responses for order creation.

## Architecture direction

`Customer -> FreshCart Platform -> Nearby / Assigned Shop -> Shopkeeper / Employee -> Delivery`

The repository is intentionally independent from the legacy liquor ERP repository.

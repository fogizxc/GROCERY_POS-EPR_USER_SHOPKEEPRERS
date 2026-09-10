# FreshCart API

The API layer currently provides a clean domain boundary for the three-sided grocery platform.

## Routes

- `GET /api/health`
- `GET /api/products?q=&category=&shopId=`
- `GET /api/shops`
- `GET /api/users/:id`
- `GET /api/orders?status=&shopId=`
- `POST /api/orders`
- `PATCH /api/orders/:id/status`
- `PATCH /api/products/:id/stock`

The current store is intentionally in-memory for the first vertical slice. The domain types are designed to move to MongoDB without changing the frontend contract. Authentication and authorization should be added before exposing mutations publicly.

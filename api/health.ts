export default function handler(_req: Request) {
  return Response.json({
    ok: true,
    service: 'freshcart-api',
    timestamp: new Date().toISOString(),
  });
}

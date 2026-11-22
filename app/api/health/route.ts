export const dynamic = 'force-dynamic';

/** Liveness check for load balancers and uptime monitors. Deliberately reveals nothing about configuration. */
export function GET() {
  return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}

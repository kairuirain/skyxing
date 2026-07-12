/**
 * CORS middleware for allowing cross-origin requests
 */
export async function cors(c, next) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };

  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  await next();

  // Add CORS headers to response
  Object.entries(headers).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
}

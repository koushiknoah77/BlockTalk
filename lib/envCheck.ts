// lib/envCheck.ts
// Small helpers to assert/check environment variables for server routes.
// Use checkEnvResponse in route handlers to return a friendly JSON response
// rather than throwing.

export function assertEnv(keys: string[]) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error('Missing required env vars: ' + missing.join(', '));
  }
}

/**
 * Helper for routes that want to return a Response instead of throwing.
 * Returns null when all ok, or a Response when missing env keys.
 */
export function checkEnvResponse(keys: string[]) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) {
    return new Response(
      JSON.stringify({ error: 'Missing required env vars: ' + missing.join(', ') }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return null;
}

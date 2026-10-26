const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  return new Response(JSON.stringify({
    error: "Website operations are temporarily disabled pending authorization and approval security repairs.",
    code: "WEBSITE_MAINTENANCE"
  }), { status: 503, headers });
});

// Disabled 2026-10-14: leave requests are now routed by the n8n "HR Requests" WhatsApp flow
// (GM + HR notified together; see public.request_approvals). Previous version backed up on the assistant server.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  return new Response(JSON.stringify({ ok: true, skipped: 'handled_by_n8n_whatsapp_flow' }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

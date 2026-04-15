// APEX Cloudflare Worker — apex-agent
// Handles: Anthropic AI proxy + HL exchange proxy + Yahoo Finance proxy

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const body = await request.json();

      // ── HL Exchange proxy ─────────────────────────────────────────────────
      // Forwards signed HL exchange requests.
      // Supports 'bodyStr' (pre-serialized string) to avoid double JSON
      // serialization corrupting r/s/v signature values.
      if (body.op === 'proxy') {
        const targetUrl = body.url;
        const method    = body.method || 'POST';

        let forwardBody;
        if (body.bodyStr && typeof body.bodyStr === 'string') {
          // Pre-serialized — forward verbatim, no re-parsing
          forwardBody = body.bodyStr;
        } else if (body.body) {
          // Object — serialize now (single serialization)
          forwardBody = JSON.stringify(body.body);
        } else {
          forwardBody = undefined;
        }

        const resp = await fetch(targetUrl, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: method !== 'GET' ? forwardBody : undefined,
        });

        const text = await resp.text();
        return new Response(text, {
          status: resp.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── Yahoo Finance proxy ───────────────────────────────────────────────
      if (body.proxyUrl) {
        const resp = await fetch(body.proxyUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; APEX/1.0)',
            'Accept': 'application/json',
          },
        });
        const text = await resp.text();
        return new Response(text, {
          status: resp.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── Anthropic AI proxy ────────────────────────────────────────────────
      const apiKey = env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'invalid x-api-key' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      const text = await resp.text();
      return new Response(text, {
        status: resp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

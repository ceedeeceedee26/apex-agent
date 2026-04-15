// APEX Cloudflare Worker — apex-agent
// Routes: Anthropic (Claude) + xAI (Grok) + HL exchange proxy + Yahoo Finance proxy

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
      // 'bodyStr' = pre-serialized JSON string — forward verbatim to avoid
      // double JSON serialization corrupting EIP-712 r/s/v signature values.
      if (body.op === 'proxy') {
        const targetUrl = body.url;
        const method    = body.method || 'POST';

        let forwardBody;
        if (typeof body.bodyStr === 'string') {
          forwardBody = body.bodyStr; // pre-serialized, forward as-is
        } else if (body.body !== undefined) {
          forwardBody = JSON.stringify(body.body); // single serialization
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

      // ── AI provider routing ───────────────────────────────────────────────
      const provider = request.headers.get('x-provider') || 'claude';

      if (provider === 'grok') {
        const apiKey = env.GROK_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'Grok API key not configured' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const resp = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });
        const text = await resp.text();
        return new Response(text, {
          status: resp.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Default: Claude / Anthropic
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
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
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

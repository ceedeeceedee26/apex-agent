export default {
  async fetch(request) {
    // ── ORIGIN RESTRICTION ──────────────────────────────────────
    // Only allow requests from your GitHub Pages domain
    const ALLOWED_ORIGINS = [
      'https://ceedeeceedee26.github.io',
    ];
    const origin = request.headers.get('Origin') || '';
    const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));

    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version, Authorization, x-provider',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Block requests from disallowed origins
    if (request.method !== 'OPTIONS' && !isAllowed) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const provider = request.headers.get('x-provider') || 'claude';
    const body = await request.text();

    let targetUrl, headers, outBody;

    if (provider === 'proxy') {
      // Generic GET proxy — used for Yahoo Finance ticker data
      const parsed = JSON.parse(body);
      const targetResp = await fetch(parsed.proxyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      const data = await targetResp.text();
      return new Response(data, {
        status: targetResp.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } else if (provider === 'grok') {
      // Route to xAI Grok API
      const authHeader = request.headers.get('Authorization');
      targetUrl = 'https://api.x.ai/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      };
      outBody = body;

    } else {
      // Default: route to Anthropic Claude API
      const apiKey = request.headers.get('x-api-key');
      targetUrl = 'https://api.anthropic.com/v1/messages';
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      };
      outBody = body;
    }

    const resp = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: outBody
    });

    const respData = await resp.text();
    return new Response(respData, {
      status: resp.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};

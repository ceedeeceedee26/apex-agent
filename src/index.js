export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version, Authorization, x-provider',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        }
      });
    }

    const bodyText = await request.text();
    const provider = request.headers.get('x-provider') || 'claude';

    // ── Generic proxy (HL exchange, Binance candles, Yahoo Finance) ──────────
    // Detected by: x-provider: proxy  OR  body contains op:'proxy' or proxyUrl
    let parsed = null;
    try { parsed = JSON.parse(bodyText); } catch(e) {}

    const isProxy = provider === 'proxy' || parsed?.op === 'proxy' || parsed?.proxyUrl;

    if (isProxy && parsed) {
      // Yahoo Finance: { proxyUrl: '...' }
      if (parsed.proxyUrl) {
        const resp = await fetch(parsed.proxyUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        });
        const text = await resp.text();
        return new Response(text, {
          status: resp.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // HL exchange / Binance: { op:'proxy', url, method, body }
      if (parsed.op === 'proxy') {
        const forwardBody = parsed.body
          ? JSON.stringify(parsed.body)
          : undefined;
        const resp = await fetch(parsed.url, {
          method: parsed.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: parsed.method === 'GET' ? undefined : forwardBody,
        });
        const text = await resp.text();
        return new Response(text, {
          status: resp.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // ── Grok / xAI ──────────────────────────────────────────────────────────
    if (provider === 'grok') {
      const authHeader = request.headers.get('Authorization');
      const resp = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: bodyText
      });
      const text = await resp.text();
      return new Response(text, {
        status: resp.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // ── Claude / Anthropic (default) ─────────────────────────────────────────
    const apiKey = request.headers.get('x-api-key');
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: bodyText
    });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
};

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version, Authorization, x-provider',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        }
      });
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
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

    const data = await resp.text();
    return new Response(data, {
      status: resp.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

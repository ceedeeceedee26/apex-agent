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

    let targetUrl, headers;

    if (provider === 'grok') {
      // Route to xAI Grok API
      const authHeader = request.headers.get('Authorization');
      targetUrl = 'https://api.x.ai/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      };
    } else {
      // Default: route to Anthropic Claude API
      const apiKey = request.headers.get('x-api-key');
      targetUrl = 'https://api.anthropic.com/v1/messages';
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      };
    }

    const resp = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body
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

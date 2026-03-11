export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version',
        'Access-Control-Allow-Methods': 'POST'
      }});
    }
    const body = await request.text();
    const apiKey = request.headers.get('x-api-key');
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body
    });
    const data = await resp.text();
    return new Response(data, { headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }});
  }
};

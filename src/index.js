// @ts-nocheck
/**
 * APEX Financial Intelligence — Cloudflare Worker
 * ─────────────────────────────────────────────────────────────────────────────
 * Now that keccak256, EIP-712, and secp256k1 all run in the browser,
 * this Worker only needs to handle:
 *
 *   op: 'proxy'   → forward requests to whitelisted URLs
 *                   (Hyperliquid /exchange, /info fallback, Binance, CoinGecko)
 *   body.model    → forward to Anthropic or Grok AI API (existing behaviour)
 *
 * Cloudflare Secrets (Workers → Settings → Variables → add as Encrypted):
 *   ANTHROPIC_API_KEY
 *   GROK_API_KEY  (optional — only needed if you use Grok)
 *
 * Deploy: dash.cloudflare.com → Workers & Pages → apex-agent → Edit Code
 * Select all → paste this file → Save and Deploy
 */

// ─────────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const jsonR = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s,
  headers: { ...CORS, 'Content-Type': 'application/json' },
});
const errR = (m, s = 400) => jsonR({ error: m }, s);

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN WHITELIST — only these hosts can be proxied
// ─────────────────────────────────────────────────────────────────────────────
const WHITELIST = [
  'api.hyperliquid.xyz',
  'api.hyperliquid-testnet.xyz',
  'api.coingecko.com',
  'api.binance.com',
  'fapi.binance.com',
  'query1.finance.yahoo.com',
  'api.alternative.me',
  'contract.mexc.com',
  'api.mexc.com',
];

const domainOk = url => {
  try {
    const h = new URL(url).hostname;
    return WHITELIST.some(d => h === d || h.endsWith('.' + d));
  } catch {
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errR('Invalid JSON');
    }

    const op = body.op;

    // ── op: proxy ─────────────────────────────────────────────────────────────
    // Forwards requests to whitelisted domains (Hyperliquid, Binance, etc.)
    // Signing now happens entirely in the browser — the Worker just proxies.
    if (op === 'proxy') {
      const { url, method = 'POST', headers: fwdHeaders = {}, body: fwdBody } = body;

      if (!url) return errR('proxy requires url');
      if (!domainOk(url)) return errR('Domain not whitelisted: ' + url, 403);

      const opts = {
        method,
        headers: { 'Content-Type': 'application/json', ...fwdHeaders },
      };
      if (fwdBody && method !== 'GET') {
        opts.body = JSON.stringify(fwdBody);
      }

      try {
        const r = await fetch(url, opts);
        const data = await r.json();
        return jsonR(data, r.status);
      } catch (e) {
        return errR('Proxy fetch failed: ' + e.message, 502);
      }
    }

    // ── AI proxy (Anthropic / Grok) ────────────────────────────────────────────
    // Detected by presence of `model` field — existing behaviour unchanged.
    if (body.model) {
      const isGrok  = body.model.startsWith('grok');
      const target  = isGrok
        ? 'https://api.x.ai/v1/chat/completions'
        : 'https://api.anthropic.com/v1/messages';
      const apiKey  = isGrok ? env.GROK_API_KEY : env.ANTHROPIC_API_KEY;

      const aiHeaders = { 'Content-Type': 'application/json' };

      if (isGrok) {
        aiHeaders['Authorization'] = `Bearer ${apiKey}`;
      } else {
        aiHeaders['x-api-key']        = apiKey;
        aiHeaders['anthropic-version'] = '2023-06-01';
        aiHeaders['anthropic-beta']    = 'interleaved-thinking-2025-05-14';
      }

      // Allow APEX to pass its own key when user enters it in the modal
      const incomingHeaders = Object.fromEntries(request.headers);
      if (incomingHeaders['x-api-key']) {
        aiHeaders['x-api-key'] = incomingHeaders['x-api-key'];
      }

      try {
        const r = await fetch(target, {
          method:  'POST',
          headers: aiHeaders,
          body:    JSON.stringify(body),
        });
        const data = await r.json();
        return jsonR(data, r.status);
      } catch (e) {
        return errR('AI proxy failed: ' + e.message, 502);
      }
    }

    return errR('Unknown request — provide op or model field', 400);
  },
};

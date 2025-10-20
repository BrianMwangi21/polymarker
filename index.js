require('dotenv').config();
const logger = require('./logger');
const WebSocket = require('ws');

const gammaEventsUrl = process.env.GAMMA_API;
const marketWsUrl = process.env.MARKET_WS;

// Startup validation: ensure required environment variables are defined
const requiredEnv = ['GAMMA_API', 'MARKET_WS'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    logger.log(`[INIT] Missing environment variable: ${key}`);
    process.exit(1);
  }
}

async function getAssetIdsFromGamma() {
  const MAX_RETRIES = 3;
  let attempt = 0;
  let res;
  while (true) {
    try {
      res = await fetch(gammaEventsUrl);
      if (!res.ok) throw new Error(`Gamma error: ${res.status} ${res.statusText}`);
      break;
    } catch (err) {
      attempt++;
      if (attempt > MAX_RETRIES) throw err;
      const backoff = Math.min(8000, 200 * Math.pow(2, attempt - 1));
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  const body = await res.json();
  const parsed = parseAssetIdsFromGammaEvent(body);
  const { assetIdsList, event, market } = parsed;
  logger.log('[Gamma] event:', event.title || event.slug);
  logger.log('[Gamma] market:', market.slug || market.question);
  logger.log('[Gamma] assets_ids:', assetIdsList);
  return assetIdsList;
}

function parseAssetIdsFromGammaEvent(body) {
  const events = Array.isArray(body) ? body : body.data;
  if (!events?.length) throw new Error('No events returned');
  const event = events[0];
  const mkt = event.markets?.[0];
  if (!mkt) throw new Error('Event has no markets');
  const assetIdsList = parseMarketTokens(mkt);
  return { assetIdsList, event, market: mkt };
}

function parseMarketTokens(market) {
  if (market?.clobTokenIds) {
    return JSON.parse(market.clobTokenIds).map(String);
  }
  if (market?.tokens?.length) {
    return market.tokens.map(t => String(t.token_id));
  }
  throw new Error('No token IDs on market');
}

function connectMarketWS(assetsIds) {
  let ws = null;
  let pingTimer = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 6;
  let shouldStop = false;

  const subscribe = (socket) => {
    const sub = { type: 'market', assets_ids: assetsIds };
    socket.send(JSON.stringify(sub));
    logger.log('[WS] subscribed:', sub);
  };

  const connectOnce = () => new Promise((resolve) => {
    ws = new WebSocket(marketWsUrl);
    ws.on('open', () => {
      reconnectAttempts = 0;
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('PING');
      }, 10000);
      subscribe(ws);
      logger.log('[WS] connected');
      resolve(ws);
    });
    ws.on('message', (buf) => {
      try {
        const msg = JSON.parse(buf.toString());
        logger.log('[WS]', msg.type || 'message', msg);
      } catch {
        logger.log('[WS] raw', buf.toString());
      }
    });
    ws.on('error', (e) => logger.log('[WS] error:', e.message));
    ws.on('close', (code, reason) => {
      if (pingTimer) clearInterval(pingTimer);
      logger.log('[WS] closed:', code, reason?.toString?.() ?? '');
      if (!shouldStop) {
        if (reconnectAttempts < MAX_RECONNECT) {
          reconnectAttempts++;
          const backoff = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts - 1));
          setTimeout(() => connectOnce().then(() => {}), backoff);
        } else {
          logger.log('[WS] max reconnect attempts reached');
        }
      }
    });
  });

  return connectOnce();
}

(async function main() {
  try {
    const assetsIds = await getAssetIdsFromGamma();
    await connectMarketWS(assetsIds);
  } catch (e) {
    logger.log('[MAIN] failed:', e.message);
    process.exit(1);
  }
})();

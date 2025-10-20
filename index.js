require('dotenv').config();
const logger = require('./logger');
const MarketWebSocket = require('./market-websocket');
const { fetchTargetAssetIds } = require('./gamma');

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

async function main() {
  try {
    const assetsIds = await fetchTargetAssetIds(gammaEventsUrl);
    const ws = new MarketWebSocket(marketWsUrl, assetsIds);
    ws.onMessage((msg) => {
      // Minimal observability: log normalized messages
      logger.log('[MarketWS] message', msg);
    });
    await ws.start();
    logger.log('[INIT] MarketWebSocket started for assets:', assetsIds);
  } catch (e) {
    logger.log('[MAIN] failed:', e.message);
    process.exit(1);
  }
}

main();

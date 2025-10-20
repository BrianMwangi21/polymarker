require('dotenv').config();
const logger = require('./logger');
const MarketFeedManager = require('./market-feed-manager');
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
    const marketFeedManager = new MarketFeedManager({ marketWsUrl });
    marketFeedManager.onMessage((payload) => {
      logger.log('[Feed] message', payload);
    });
    marketFeedManager.startAll(assetsIds);
    logger.log('[INIT] MarketFeedManager started for assets:', assetsIds);
  } catch (e) {
    logger.log('[MAIN] failed:', e.message);
    process.exit(1);
  }
}

main();

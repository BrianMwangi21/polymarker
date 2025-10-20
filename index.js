require('dotenv').config();
const logger = require('./logger');
const MarketFeedManager = require('./market-feed-manager');
const LabelService = require('./label-service');
const TickerFormat = require('./ticker-format');
const { fetchTargetAssetIds } = require('./gamma');

const gammaEventsUrl = `${process.env.GAMMA_BASE_API}/events?order=id&ascending=false&closed=false&limit=5`;
const marketWsUrl = process.env.MARKET_WS;

// Startup validation: ensure required environment variables are defined
const requiredEnv = ['GAMMA_BASE_API', 'MARKET_WS'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    logger.log(`[INIT] Missing environment variable: ${key}`);
    process.exit(1);
  }
}

async function main() {
  try {
    const { assetIdsList, market } = await fetchTargetAssetIds(gammaEventsUrl);
    const labelService = new LabelService();
    // Preload labels for the market (so assets have labels ASAP)
    if (market?.id) {
      await labelService.preloadLabels([market.id]);
    }

    const marketFeedManager = new MarketFeedManager({ marketWsUrl, labelService });
    const ticker = new TickerFormat();
    ticker.start();

    marketFeedManager.onMessage((payload) => {
      ticker.update(payload);
      // Also log for completeness
      logger.log('[Feed] message', payload);
    });

    marketFeedManager.startAll(assetIdsList);
    logger.log('[INIT] MarketFeedManager started for assets:', assetIdsList);
  } catch (e) {
    logger.log('[MAIN] failed:', e.message);
    process.exit(1);
  }
}

main();

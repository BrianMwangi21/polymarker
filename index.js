require('dotenv').config();
const logger = require('./logger');
const MarketFeedManager = require('./market-feed-manager');
const LabelService = require('./label-service');
const TickerFormat = require('./ticker-format');
const { fetchTargetAssetIds } = require('./gamma');

const gammaEventsUrl = `${process.env.GAMMA_BASE_API}/events?order=id&ascending=false&closed=false&limit=10`;
const marketWsUrl = process.env.MARKET_WS;


const requiredEnv = ['GAMMA_BASE_API', 'MARKET_WS'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    process.exit(1);
  }
}

async function main() {
  let heartbeatInterval = null;
  try {
    const { assetIdsList, marketMap } = await fetchTargetAssetIds(gammaEventsUrl);
    const labelService = new LabelService();
  
    const marketIds = Object.values(marketMap || {});
    if (marketIds.length) {
      await labelService.preloadLabels(marketIds);
    }

    // Initialize components
    const marketFeedManager = new MarketFeedManager({ marketWsUrl, labelService });
    const ticker = new TickerFormat();
    ticker.start();

    marketFeedManager.onMessage((payload) => {
      ticker.update(payload);
    });

    marketFeedManager.startAll(assetIdsList);


    const assetCount = assetIdsList.length;
    console.log(`[TICKER] started with ${assetCount} assets`);
    heartbeatInterval = setInterval(() => {
      console.log(`[TICKER] alive: ${assetCount} assets`);
    }, 30000);
  } catch (e) {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    process.exit(1);
  }
}

main();

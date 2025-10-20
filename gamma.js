const logger = require('./logger');

async function fetchTargetAssetIds(gammaApiUrl) {
  const MAX_RETRIES = 3;
  let attempt = 0;
  let res;
  while (true) {
    try {
      res = await fetch(gammaApiUrl);
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
  const { assetIdsList, event, market } = parseAssetIdsFromGammaEvent(body);
  logger.log('[Gamma] event:', event?.title || event?.slug);
  logger.log('[Gamma] market:', market?.slug || market?.question);
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

module.exports = { fetchTargetAssetIds };

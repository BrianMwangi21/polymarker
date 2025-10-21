// Use project logger for consistency
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
  const { assetIdsList, marketMap } = parseAssetIdsFromGammaEvent(body);
  return { assetIdsList, marketMap };
}

function parseAssetIdsFromGammaEvent(body) {
  const events = Array.isArray(body) ? body : body.data;
  if (!events?.length) throw new Error('No events returned');
  const limit = events.length;
  const assetSet = new Set();
  const marketMap = {}; // assetId -> marketId

  for (let i = 0; i < limit; i++) {
    const event = events[i];
    const markets = event.markets || [];
    for (const mkt of markets) {
      const marketId = mkt?.id ?? null;
      if (!marketId) continue;
      const tokenIds = extractTokenIdsFromMarket(mkt);
      for (const tid of tokenIds) {
        const sid = String(tid);
        assetSet.add(sid);
        marketMap[sid] = String(marketId);
      }
    }
  }

  // Fallback: if no assets found, throw
  if (assetSet.size === 0) throw new Error('No token IDs found in markets');

  const assetIdsList = Array.from(assetSet);
  return { assetIdsList, marketMap };
}

function extractTokenIdsFromMarket(market) {
  if (market?.clobTokenIds) {
    try { return JSON.parse(market.clobTokenIds).map(String); } catch { return []; }
  }
  if (market?.tokens?.length) {
    return market.tokens.map(t => String(t.token_id));
  }
  return [];
}

module.exports = { fetchTargetAssetIds };

class LabelService {
  constructor() {
    this.baseMarketUrl = 'https://gamma-api.polymarket.com/markets/';
    this.labelCache = new Map(); // assetId -> label
    this.assetToMarket = new Map(); // assetId -> marketId (traceability, optional)
  }

  // Preload labels for a set of marketIds
  async preloadLabels(marketIds) {
    if (!marketIds || marketIds.length === 0) return;
    const promises = marketIds.map(id => this._loadMarket(id));
    await Promise.all(promises);
  }

  // Internal: load a market and derive labels for its token IDs
  async _loadMarket(marketId) {
    try {
      const res = await fetch(this.baseMarketUrl + marketId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const market = await res.json();
      const slug = market.slug || market.question || '';

      // Determine token IDs associated with this market
      let tokenIds = [];
      if (market.clobTokenIds) {
        try {
          tokenIds = JSON.parse(market.clobTokenIds).map(String);
        } catch {
          tokenIds = [];
        }
      }
      if ((!tokenIds || tokenIds.length === 0) && Array.isArray(market.tokens)) {
        tokenIds = market.tokens.map(t => String(t.token_id));
      }
      // Outcomes may be a string-encoded JSON array in some responses
      let outcomes = [];
      if (Array.isArray(market.outcomes)) {
        outcomes = market.outcomes;
      } else if (typeof market.outcomes === 'string') {
        try {
          outcomes = JSON.parse(market.outcomes);
        } catch {
          outcomes = [];
        }
      }

      // Map each tokenId to a label derived from slug + corresponding outcome if available
      for (let i = 0; i < tokenIds.length; i++) {
        const tid = String(tokenIds[i]);
        const outcome = outcomes[i] ?? null;
        const label = outcome ? `${slug} ${outcome}` : slug;
        this.labelCache.set(tid, label);
        this.assetToMarket.set(tid, marketId);
      }
    } catch (err) {
      // swallow error to keep startup resilient; no logs
    }
  }

  // Public: get label for an asset (assetId). Fallback to assetId if unknown.
  getLabel(assetId) {
    return this.labelCache.get(String(assetId)) || String(assetId);
  }

  // Debug helper: dump all known labels
  dumpLabels() {
    return Array.from(this.labelCache.entries()).map(([assetId, label]) => ({ assetId, label }));
  }
}

module.exports = LabelService;

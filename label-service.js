class LabelService {
  constructor() {
    this.baseMarketUrl = `${process.env.GAMMA_BASE_API}/markets/`;
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
      const outcomes = Array.isArray(market.outcomes) ? market.outcomes : [];

      tokenIds.forEach((tid, idx) => {
        const outcome = outcomes[idx];
        const label = outcome ? `${slug} ${outcome}` : slug;
        this.labelCache.set(String(tid), label);
        this.assetToMarket.set(String(tid), marketId);
      });
    } catch (err) {
      // Swallow error to keep startup resilient; log via console for visibility
      console.warn('[LabelService] failed loading market', marketId, ':', err?.message || err);
    }
  }

  // Public: get label for an asset (assetId). Fallback to assetId if unknown.
  getLabel(assetId) {
    return this.labelCache.get(String(assetId)) || String(assetId);
  }
}

module.exports = LabelService;

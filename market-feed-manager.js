const MarketWebSocket = require('./market-websocket');

// MarketFeedManager: orchestrates per-asset feeds
class MarketFeedManager {
  constructor({ marketWsUrl, labelService }) {
    this.marketWsUrl = marketWsUrl;
    this.labelService = labelService;
    this.feeds = new Map(); // assetId -> MarketWebSocket
    this._messageCallback = null;
  }

  onMessage(cb) {
    this._messageCallback = cb;
  }

  _emit(assetId, msg) {
    const label = this.labelService?.getLabel ? this.labelService.getLabel(assetId) : undefined;
    if (this._messageCallback) {
      // Normalize message to include assetId, label, and the payload
      this._messageCallback({ assetId, label, ...msg });
    }
  }

  addAsset(assetId) {
    if (this.feeds.has(assetId)) return;
    const ws = new MarketWebSocket(this.marketWsUrl, [assetId]);
    ws.onMessage((m) => {
      // Forward with assetId context and label
      this._emit(assetId, m);
    });
    // Start but do not await to avoid blocking
    ws.start().catch((e) => {
      this._emit(assetId, { type: 'error', error: e.message });
    });
    this.feeds.set(assetId, ws);
  }

  removeAsset(assetId) {
    const ws = this.feeds.get(assetId);
    if (ws) {
      ws.stop();
      this.feeds.delete(assetId);
    }
  }

  startAll(assetIds = []) {
    for (const id of assetIds) {
      this.addAsset(id);
    }
  }

  stopAll() {
    for (const [id, ws] of this.feeds.entries()) {
      ws.stop();
    }
    this.feeds.clear();
  }
}

module.exports = MarketFeedManager;

const WebSocket = require('ws');

// Minimal per-asset WebSocket interface
// - start(): establish connection and subscribe to given asset IDs
// - stop(): close connection
// - onMessage(callback): register a consumer for normalized messages
class MarketWebSocket {
  constructor(marketWsUrl, assetIds = []) {
    this.marketWsUrl = marketWsUrl;
    this.assetIds = assetIds;
    this.ws = null;
    this.messageCallback = null;
    this.shouldStop = false;
  }

  onMessage(cb) {
    this.messageCallback = cb;
  }

  async start() {
    if (this.ws) return;
    this.shouldStop = false;
    // Add a startup timeout to prevent hanging if the WS cannot connect
    const TIMEOUT_MS = 5000;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('MarketWebSocket connection timeout'));
      }, TIMEOUT_MS);
      this._connectOnce().then(() => {
        clearTimeout(timer);
        resolve();
      }).catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
  }

  stop() {
    this.shouldStop = true;
    if (this.ws) {
      try { this.ws.close(); } catch (e) { /* ignore */ }
      this.ws = null;
    }
  }

  _emit(msg) {
    if (this.messageCallback) {
      this.messageCallback(msg);
    }
  }

  _subscribe() {
    const sub = { type: 'market', assets_ids: this.assetIds };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(sub));
    }
  }

  _connectOnce() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.marketWsUrl);
      this.ws.on('open', () => {
        this._subscribe();
        resolve();
      });
      this.ws.on('message', (buf) => {
        try {
          const msg = JSON.parse(buf.toString());
          this._emit({ ...msg, _normalized: true });
        } catch (e) {
          this._emit({ type: 'raw', payload: buf.toString() });
        }
      });
      this.ws.on('error', (e) => {
        this._emit({ type: 'error', error: e.message });
      });
      this.ws.on('close', (code, reason) => {
        if (this.shouldStop) return;
        const backoff = Math.min(15000, 1000 * 2);
        setTimeout(() => this._connectOnce().then(resolve).catch(reject), backoff);
      });
    });
  }
}

module.exports = MarketWebSocket;

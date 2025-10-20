// Simple terminal ticker formatter (no colors, pipe-separated columns)
class TickerFormat {
  constructor() {
    this.assets = new Map(); // assetId -> state
    this.interval = null;
  }

  start() {
    if (this.interval) return;
    // render every 250ms (~4x/second)
    this.interval = setInterval(() => this.render(), 250);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  update(message) {
    // message expected: { assetId, label, ...payload }
    if (!message || !message.assetId) return;
    const assetId = String(message.assetId);
    const label = (message.label) ? String(message.label) : assetId;

    const now = message.timestamp ? Number(message.timestamp) : Date.now();
    const existing = this.assets.get(assetId) || {
      assetId,
      label,
      lastMid: null,
      bid: null,
      ask: null,
      changePct: 0,
      timestamp: now
    };

    // If the message includes price_changes (price_change updates for multiple assets)
    if (Array.isArray(message.price_changes)) {
      const pc = message.price_changes.find(p => String(p.asset_id) === assetId);
      if (pc) {
        const price = pc.price != null ? parseFloat(pc.price) : NaN;
        const bid = pc.best_bid != null ? parseFloat(pc.best_bid) : NaN;
        const ask = pc.best_ask != null ? parseFloat(pc.best_ask) : NaN;
        const mid = (!Number.isNaN(bid) && !Number.isNaN(ask)) ? (bid + ask) / 2 : (!Number.isNaN(price) ? price : existing.lastMid);
        const last = Number.isFinite(mid) ? mid : existing.lastMid;
        const prev = existing.lastMid;
        let changePct = 0;
        if (Number.isFinite(prev) && Number.isFinite(last) && prev !== 0) {
          changePct = ((last - prev) / prev) * 100;
        }
        existing.lastMid = last;
        existing.bid = Number.isFinite(bid) ? bid : existing.bid;
        existing.ask = Number.isFinite(ask) ? ask : existing.ask;
        existing.changePct = Number.isFinite(changePct) ? changePct : existing.changePct;
        existing.timestamp = now;
        this.assets.set(assetId, { ...existing, label });
        return;
      }
    }

    // Fallback: use direct fields on message if present
    if (typeof message.bestBid !== 'undefined') existing.bid = Number(message.bestBid);
    if (typeof message.bestAsk !== 'undefined') existing.ask = Number(message.bestAsk);

    // Derive mid if possible
    const bid = existing.bid;
    const ask = existing.ask;
    let mid = null;
    if (typeof bid === 'number' && typeof ask === 'number' && !Number.isNaN(bid) && !Number.isNaN(ask)) {
      mid = (bid + ask) / 2;
    } else if (typeof message.price !== 'undefined') {
      mid = Number(message.price);
    }

    if (typeof mid === 'number' && !Number.isNaN(mid)) {
      const prev = existing.lastMid;
      const changePct = (typeof prev === 'number') ? ((mid - prev) / prev) * 100 : 0;
      existing.changePct = changePct;
      existing.lastMid = mid;
      existing.timestamp = now;
      this.assets.set(assetId, { ...existing, label });
    }
  }

  render() {
    const entries = Array.from(this.assets.values())
      .sort((a, b) => (a.label || a.assetId).localeCompare(b.label || b.assetId));

    // Build lines
    const lines = entries.map(s => {
      const last = (typeof s.lastMid === 'number' && Number.isFinite(s.lastMid)) ? s.lastMid.toFixed(2) : '—';
      const change = (typeof s.changePct === 'number' && Number.isFinite(s.changePct)) ? s.changePct.toFixed(2) + '%' : '—';
      const bid = (typeof s.bid === 'number' && Number.isFinite(s.bid)) ? s.bid.toFixed(2) : '—';
      const ask = (typeof s.ask === 'number' && Number.isFinite(s.ask)) ? s.ask.toFixed(2) : '—';
      const t = s.timestamp ? this._formatTimeFromEpoch(s.timestamp) : this._formatTime();
      const assetLabel = s.label ?? s.assetId;
      // Format: AssetId | AssetLabel | Last | Change | Bid | Ask | Time
      return `${s.assetId} | ${assetLabel} | ${last} | ${change} | ${bid} | ${ask} | ${t}`;
    });

    // Clear screen and draw all lines if there is something to render
    if (lines.length > 0) {
      process.stdout.write('\x1b[2J');
      process.stdout.write(lines.join('\n') + '\n');
    }
  }

  _formatTime() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  _formatTimeFromEpoch(ts) {
    const d = new Date(Number(ts));
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
}

module.exports = TickerFormat;

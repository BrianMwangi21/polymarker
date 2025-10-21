// Simple terminal ticker formatter (plain text, append-only lines)
class TickerFormat {
  constructor() {
    this.assets = new Map(); // assetId -> state
  }

  start() {
    // no periodic render needed for append-only output
  }

  stop() {
    // nothing to stop in this simple mode
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
      lastPrintedMid: null,
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
        // Prefer price as lastMid when available
        let last;
        if (Number.isFinite(price)) {
          last = price;
        } else if (Number.isFinite(bid) && Number.isFinite(ask)) {
          last = (bid + ask) / 2;
        } else {
          last = existing.lastMid;
        }
        const prev = existing.lastMid;
        let changePct = 0;
        if (Number.isFinite(prev) && Number.isFinite(last) && prev > 0) {
          changePct = ((last - prev) / prev) * 100;
        }
        existing.lastMid = last;
        existing.bid = Number.isFinite(bid) ? bid : existing.bid;
        existing.ask = Number.isFinite(ask) ? ask : existing.ask;
        existing.changePct = Number.isFinite(changePct) ? changePct : existing.changePct;
        existing.timestamp = now;
        this.assets.set(assetId, { ...existing, label });
        // Emit a single line representing this asset update, appended to output
        this._printLine({ assetId, label, lastMid: last, changePct, bid, ask, timestamp: now });
        return;
      }
      // If price_changes present but no matching asset, fall through to fallback (will render existing state)
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
      const changePct = (typeof prev === 'number' && prev > 0) ? ((mid - prev) / prev) * 100 : 0;
      existing.changePct = changePct;
      existing.lastMid = mid;
      existing.lastPrintedMid = mid;
      existing.timestamp = now;
      this.assets.set(assetId, { ...existing, label });
      this._printLine({ assetId, label, lastMid: mid, changePct, bid: existing.bid, ask: existing.ask, timestamp: now });
    }
  }

  _printLine(lineObj) {
    const assetId = String(lineObj.assetId);
    const label = lineObj.label || assetId;
    const last = (typeof lineObj.lastMid === 'number' && Number.isFinite(lineObj.lastMid)) ? lineObj.lastMid.toFixed(2) : '—';
    const change = (typeof lineObj.changePct === 'number' && Number.isFinite(lineObj.changePct)) ? lineObj.changePct.toFixed(2) + '%' : '—';
    const bid = (typeof lineObj.bid === 'number' && Number.isFinite(lineObj.bid)) ? lineObj.bid.toFixed(2) : '—';
    const ask = (typeof lineObj.ask === 'number' && Number.isFinite(lineObj.ask)) ? lineObj.ask.toFixed(2) : '—';
    const t = lineObj.timestamp ? this._formatTimeFromEpoch(lineObj.timestamp) : this._formatTime();
    // Format: AssetId | AssetLabel | Last | Change | Bid | Ask | Time
    const line = `${assetId} | ${label} | ${last} | ${change} | ${bid} | ${ask} | ${t}`;
    console.log(line);
  }

  render() {
    // Deprecated in this mode
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

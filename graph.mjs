import { VENUES } from "./venues.mjs";

const FEE = Object.fromEntries(VENUES.map((v) => [v.id, v.feeBps / 10_000]));
/** USDT y USDC no son el mismo billete. 2 bps de castigo si el canje cruza el estable. */
const PEG_BPS = 2;
const TIGHT_BOOK = 0.003;
const MAX_EDGE = 0.02;
const MAJORITY = 3;

export function sharedUniverse(books) {
  const seen = new Map();
  for (const book of books) {
    if (!book.ok) continue;
    const keys = new Set();
    for (const q of book.quotes) keys.add(`${q.base}:${q.quote}`);
    for (const key of keys) seen.set(key, (seen.get(key) || 0) + 1);
  }
  const keep = new Set();
  for (const [key, n] of seen) if (n >= MAJORITY) keep.add(key);
  return keep;
}

function tight(q) {
  return (q.ask - q.bid) / q.bid <= TIGHT_BOOK;
}

/**
 * Canje inmediato: comprar el ask en un venue y vender el bid en otro.
 * Beneficio nominal sobre `notional` USDT, neto de taker y del castigo de estable.
 */
export function edgesFor(quotes, notional, opts = {}) {
  const transfer = opts.transferCostUsd ?? 0;
  const minBps = opts.minProfitBps ?? 0;
  const minUsd = opts.minOperableUsd ?? 0;
  const byKey = new Map();
  for (const q of quotes) {
    if (!tight(q)) continue;
    const key = `${q.base}:${q.quote}:${q.venue}`;
    byKey.set(key, q);
  }
  const groups = new Map();
  for (const q of byKey.values()) {
    const g = groups.get(q.base) || [];
    g.push(q);
    groups.set(q.base, g);
  }
  const edges = [];
  for (const [base, legs] of groups) {
    for (const buy of legs) {
      for (const sell of legs) {
        if (buy.venue === sell.venue && buy.quote === sell.quote) continue;
        const peg = buy.quote === sell.quote ? 1 : 1 - PEG_BPS / 10_000;
        const unit = (sell.bid * (1 - FEE[sell.venue]) * peg) / (buy.ask * (1 + FEE[buy.venue])) - 1;
        if (!(unit > 0) || unit > MAX_EDGE) continue;
        const askUsd = buy.askQty > 0 ? buy.ask * buy.askQty : 0;
        const bidUsd = sell.bidQty > 0 ? sell.bid * sell.bidQty : 0;
        if (!(askUsd > 0) || !(bidUsd > 0)) continue;
        const operable = Math.min(notional, askUsd, bidUsd);
        if (operable < minUsd) continue;
        const gross = unit * operable;
        const net = gross - transfer;
        const bps = (net / operable) * 10_000;
        if (!(net > 0) || bps < minBps) continue;
        edges.push({
          base,
          buyVenue: buy.venue,
          sellVenue: sell.venue,
          buyQuote: buy.quote,
          sellQuote: sell.quote,
          ask: buy.ask,
          bid: sell.bid,
          notionalUsd: Math.round(operable * 1000) / 1000,
          grossUsd: Math.round(gross * 1000) / 1000,
          netUsd: Math.round(net * 1000) / 1000,
          netBps: Math.round(bps),
          topAskUsd: Math.round(askUsd * 100) / 100,
          topBidUsd: Math.round(bidUsd * 100) / 100,
        });
      }
    }
  }
  edges.sort((a, b) => b.netUsd - a.netUsd);
  return edges;
}

export function bestPerBase(edges) {
  const out = [];
  const seen = new Set();
  for (const edge of edges) {
    if (seen.has(edge.base)) continue;
    seen.add(edge.base);
    out.push(edge);
  }
  return out;
}

export function edgeKey(edge) {
  return [edge.base, edge.buyVenue, edge.buyQuote, edge.sellVenue, edge.sellQuote].join("|");
}

/** Neto actual de una posición ya abierta, en USD del nocional, antes del costo de transferencia. */
export function liveNetUsd(quotes, pos, notional) {
  const buy = quotes.find((q) => q.venue === pos.buyVenue && q.base === pos.base && q.quote === pos.buyQuote);
  const sell = quotes.find((q) => q.venue === pos.sellVenue && q.base === pos.base && q.quote === pos.sellQuote);
  if (!buy || !sell || !(buy.ask > 0) || !(sell.bid > 0)) return null;
  const peg = buy.quote === sell.quote ? 1 : 1 - PEG_BPS / 10_000;
  const unit = (sell.bid * (1 - FEE[sell.venue]) * peg) / (buy.ask * (1 + FEE[buy.venue])) - 1;
  return Math.round(unit * notional * 1000) / 1000;
}

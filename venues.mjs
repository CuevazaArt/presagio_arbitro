/**
 * Cotizaciones spot públicas. Sin claves. Solo cripto contra USDT o USDC.
 * Comisión: taker público por defecto, un lado, en bps.
 */
export const VENUES = [
  { id: "binance", feeBps: 10 },
  { id: "gate", feeBps: 20 },
  { id: "okx", feeBps: 10 },
  { id: "bybit", feeBps: 10 },
  { id: "kucoin", feeBps: 10 },
];

const QUOTES = ["USDT", "USDC"];
const STABLES = new Set([
  "USDT", "USDC", "FDUSD", "TUSD", "USDP", "DAI", "BUSD", "USD1", "USDE",
  "USD", "PYUSD", "USDD", "GUSD", "FRAX", "LUSD", "CRVUSD", "USDS", "EUR",
  "USTC", "UST", "EURI", "AEUR",
]);

export function splitPair(symbol) {
  const raw = String(symbol).toUpperCase().replace(/[-_/]/g, "");
  for (const quote of QUOTES) {
    if (raw.endsWith(quote) && raw.length > quote.length) {
      return { base: raw.slice(0, -quote.length), quote };
    }
  }
  return null;
}

export function tradableBase(base) {
  if (!base || STABLES.has(base)) return false;
  if (/(\d+(L|S)|UP|DOWN|BULL|BEAR)$/.test(base)) return false;
  if (!/^[A-Z0-9]{2,15}$/.test(base)) return false;
  return true;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function quoteRow(venue, symbol, bid, ask, bidQty, askQty) {
  const pair = splitPair(symbol);
  const b = num(bid);
  const a = num(ask);
  if (!pair || !tradableBase(pair.base) || !(b > 0) || !(a >= b)) return null;
  return {
    venue,
    base: pair.base,
    quote: pair.quote,
    bid: b,
    ask: a,
    bidQty: num(bidQty),
    askQty: num(askQty),
  };
}

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.json();
}

async function binance() {
  const rows = await getJson("https://api.binance.com/api/v3/ticker/bookTicker");
  return rows.map((r) => quoteRow("binance", r.symbol, r.bidPrice, r.askPrice, r.bidQty, r.askQty)).filter(Boolean);
}

async function gate() {
  const rows = await getJson("https://api.gateio.ws/api/v4/spot/tickers");
  return rows.map((r) => quoteRow("gate", r.currency_pair, r.highest_bid, r.lowest_ask)).filter(Boolean);
}

async function okx() {
  const body = await getJson("https://www.okx.com/api/v5/market/tickers?instType=SPOT");
  return (body.data || []).map((r) => quoteRow("okx", r.instId, r.bidPx, r.askPx, r.bidSz, r.askSz)).filter(Boolean);
}

async function bybit() {
  const body = await getJson("https://api.bybit.com/v5/market/tickers?category=spot");
  const list = body.result?.list || [];
  return list.map((r) => quoteRow("bybit", r.symbol, r.bid1Price, r.ask1Price, r.bid1Size, r.ask1Size)).filter(Boolean);
}

async function kucoin() {
  const body = await getJson("https://api.kucoin.com/api/v1/market/allTickers");
  const list = body.data?.ticker || [];
  return list.map((r) => quoteRow("kucoin", r.symbol, r.buy, r.sell)).filter(Boolean);
}

const FETCHERS = { binance, gate, okx, bybit, kucoin };

export async function fetchVenue(id) {
  const started = Date.now();
  try {
    const quotes = await FETCHERS[id]();
    return { id, ok: true, ms: Date.now() - started, quotes };
  } catch (err) {
    return { id, ok: false, ms: Date.now() - started, quotes: [], error: String(err.message || err) };
  }
}

export async function fetchAll() {
  return Promise.all(VENUES.map((v) => fetchVenue(v.id)));
}

function pairOf(venue, base, quote) {
  if (venue === "gate") return `${base}_${quote}`;
  if (venue === "okx" || venue === "kucoin") return `${base}-${quote}`;
  return `${base}${quote}`;
}

/** Primer nivel del libro. Si no hay tamaño, la señal no se confirma. */
export async function fetchTop(venue, base, quote) {
  const symbol = pairOf(venue, base, quote);
  let bid = 0;
  let ask = 0;
  let bidQty = 0;
  let askQty = 0;
  if (venue === "binance") {
    const d = await getJson(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=5`);
    bid = num(d.bids?.[0]?.[0]); bidQty = num(d.bids?.[0]?.[1]);
    ask = num(d.asks?.[0]?.[0]); askQty = num(d.asks?.[0]?.[1]);
  } else if (venue === "gate") {
    const d = await getJson(`https://api.gateio.ws/api/v4/spot/order_book?currency_pair=${symbol}&limit=1`);
    bid = num(d.bids?.[0]?.[0]); bidQty = num(d.bids?.[0]?.[1]);
    ask = num(d.asks?.[0]?.[0]); askQty = num(d.asks?.[0]?.[1]);
  } else if (venue === "okx") {
    const d = await getJson(`https://www.okx.com/api/v5/market/books?instId=${symbol}&sz=1`);
    const book = d.data?.[0] || {};
    bid = num(book.bids?.[0]?.[0]); bidQty = num(book.bids?.[0]?.[1]);
    ask = num(book.asks?.[0]?.[0]); askQty = num(book.asks?.[0]?.[1]);
  } else if (venue === "bybit") {
    const d = await getJson(`https://api.bybit.com/v5/market/orderbook?category=spot&symbol=${symbol}&limit=1`);
    bid = num(d.result?.b?.[0]?.[0]); bidQty = num(d.result?.b?.[0]?.[1]);
    ask = num(d.result?.a?.[0]?.[0]); askQty = num(d.result?.a?.[0]?.[1]);
  } else if (venue === "kucoin") {
    const d = await getJson(`https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${symbol}`);
    bid = num(d.data?.bestBid); bidQty = num(d.data?.bestBidSize);
    ask = num(d.data?.bestAsk); askQty = num(d.data?.bestAskSize);
  }
  return {
    bid,
    ask,
    bidUsd: bid * bidQty,
    askUsd: ask * askQty,
  };
}

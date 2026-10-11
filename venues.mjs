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

export function quoteRow(venue, symbol, bid, ask) {
  const pair = splitPair(symbol);
  const b = num(bid);
  const a = num(ask);
  if (!pair || !tradableBase(pair.base) || !(b > 0) || !(a >= b)) return null;
  return { venue, base: pair.base, quote: pair.quote, bid: b, ask: a };
}

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.json();
}

async function binance() {
  const rows = await getJson("https://api.binance.com/api/v3/ticker/bookTicker");
  return rows.map((r) => quoteRow("binance", r.symbol, r.bidPrice, r.askPrice)).filter(Boolean);
}

async function gate() {
  const rows = await getJson("https://api.gateio.ws/api/v4/spot/tickers");
  return rows.map((r) => quoteRow("gate", r.currency_pair, r.highest_bid, r.lowest_ask)).filter(Boolean);
}

async function okx() {
  const body = await getJson("https://www.okx.com/api/v5/market/tickers?instType=SPOT");
  return (body.data || []).map((r) => quoteRow("okx", r.instId, r.bidPx, r.askPx)).filter(Boolean);
}

async function bybit() {
  const body = await getJson("https://api.bybit.com/v5/market/tickers?category=spot");
  const list = body.result?.list || [];
  return list.map((r) => quoteRow("bybit", r.symbol, r.bid1Price, r.ask1Price)).filter(Boolean);
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

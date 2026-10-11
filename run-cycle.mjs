import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAll, fetchTop } from "./venues.mjs";
import { bestPerBase, edgeKey, edgesFor, liveNetUsd, sharedUniverse } from "./graph.mjs";
import { markDoors, openConfirmed, stepPosition } from "./doors.mjs";
import { writeCanvas } from "./write-canvas.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const expDir = join(root, "data", "exp2");
const ajuste = JSON.parse(readFileSync(join(root, "ajuste.json"), "utf8"));

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function saldoOk(edge) {
  if (!ajuste.requireBalanceOnBothVenues) return true;
  const quote = ajuste.balancesQuote?.[edge.buyVenue] ?? 0;
  const baseKey = `${edge.sellVenue}:${edge.base}`;
  const base = ajuste.balancesBase?.[baseKey] ?? 0;
  const qty = ajuste.notionalUsd / edge.ask;
  return quote >= ajuste.notionalUsd && base >= qty;
}

const books = await fetchAll();
const keep = sharedUniverse(books);
const quotes = books.flatMap((b) => b.quotes.filter((q) => keep.has(`${q.base}:${q.quote}`)));
const ranked = bestPerBase(edgesFor(quotes, ajuste.notionalUsd));
const now = new Date().toISOString();
const transfer = ajuste.transferCostUsd;

const vistaPath = join(expDir, "vista-previa.json");
const statePath = join(expDir, "estado.json");
const prevVista = new Set(loadJson(vistaPath, []));
const curr = new Map();
for (const edge of ranked) {
  const neto = Math.round((edge.netUsd - transfer) * 1000) / 1000;
  if (neto <= 0) continue;
  curr.set(edgeKey(edge), { ...edge, netUsd: neto });
}
const segundas = [...curr.entries()].filter(([key]) => prevVista.has(key)).map(([, edge]) => edge);

const estado = loadJson(statePath, { open: [], closed: [] });
const open = [];
const salidas = [];
for (const pos of estado.open) {
  const live = liveNetUsd(quotes, pos, ajuste.notionalUsd);
  const neto = live == null ? null : Math.round((live - transfer) * 1000) / 1000;
  const stepped = stepPosition(pos, neto, ajuste);
  if (stepped.event) {
    salidas.push(stepped.pos);
    estado.closed.push(stepped.pos);
  } else {
    open.push(stepped.pos);
  }
}

const held = new Set(open.map((p) => p.base));
const confirmadas = [];
const bloqueadas = [];
let checks = 0;
for (const edge of segundas) {
  if (checks >= ajuste.maxConfirmsPerCycle) break;
  if (held.has(edge.base) || open.length >= ajuste.maxPositions) break;
  checks += 1;
  let top;
  try {
    const [buyTop, sellTop] = await Promise.all([
      fetchTop(edge.buyVenue, edge.base, edge.buyQuote),
      fetchTop(edge.sellVenue, edge.base, edge.sellQuote),
    ]);
    top = { buyTop, sellTop };
  } catch (err) {
    bloqueadas.push({ ...edge, razon: "sin_libro " + String(err.message || err).slice(0, 80) });
    continue;
  }
  const askUsd = top.buyTop.askUsd;
  const bidUsd = top.sellTop.bidUsd;
  if (!(askUsd >= ajuste.minTopNotionalUsd) || !(bidUsd >= ajuste.minTopNotionalUsd)) {
    bloqueadas.push({ ...edge, razon: "tamano", topAskUsd: askUsd, topBidUsd: bidUsd });
    continue;
  }
  if (!saldoOk(edge)) {
    bloqueadas.push({ ...edge, razon: "sin_saldo", topAskUsd: askUsd, topBidUsd: bidUsd });
    continue;
  }
  const confirmed = { ...edge, topAskUsd: askUsd, topBidUsd: bidUsd };
  confirmadas.push(confirmed);
  open.push(openConfirmed(confirmed, now, ajuste));
  held.add(edge.base);
}

const positions = open.map((pos) => ({ ...pos, ...markDoors(pos, ajuste) }));
estado.open = positions;
mkdirSync(expDir, { recursive: true });
writeFileSync(statePath, JSON.stringify(estado, null, 2));
writeFileSync(vistaPath, JSON.stringify([...curr.keys()]));

const registroPath = join(expDir, "registro.jsonl");
for (const edge of confirmadas) {
  appendFileSync(registroPath, JSON.stringify({
    tipo: "entrada",
    at: now,
    base: edge.base,
    buyVenue: edge.buyVenue,
    buyQuote: edge.buyQuote,
    sellVenue: edge.sellVenue,
    sellQuote: edge.sellQuote,
    ask: edge.ask,
    bid: edge.bid,
    notionalUsd: ajuste.notionalUsd,
    edgeConfirmadoUsd: edge.netUsd,
    transferCostUsd: transfer,
    topAskUsd: edge.topAskUsd,
    topBidUsd: edge.topBidUsd,
    consolidado: false,
  }) + "\n");
}
for (const pos of salidas) {
  appendFileSync(registroPath, JSON.stringify({
    tipo: "salida",
    at: now,
    id: pos.id,
    base: pos.base,
    door: pos.door,
    openedAt: pos.openedAt,
    edgeAlEntrarUsd: pos.edgeAlEntrarUsd,
    valorSiCierraAhoraUsd: pos.valorSiCierraAhoraUsd,
    realizadoUsd: pos.realizedUsd,
    consolidado: true,
  }) + "\n");
}

appendFileSync(join(expDir, "libro.jsonl"), JSON.stringify({ at: now, open: positions }) + "\n");

const record = {
  at: now,
  ajuste: {
    notionalUsd: ajuste.notionalUsd,
    transferCostUsd: transfer,
    minTopNotionalUsd: ajuste.minTopNotionalUsd,
    requireBalanceOnBothVenues: ajuste.requireBalanceOnBothVenues,
  },
  venues: books.map((b) => ({ id: b.id, ok: b.ok, ms: b.ms, n: b.quotes.length, error: b.error || null })),
  shared: keep.size,
  vistas: curr.size,
  segundas: segundas.length,
  confirmadas: confirmadas.length,
  bloqueadas: bloqueadas.length,
  bloqueadasPor: bloqueadas.reduce((m, b) => {
    m[b.razon] = (m[b.razon] || 0) + 1;
    return m;
  }, {}),
  edgeCount: ranked.length,
  top: ranked.slice(0, 8),
  events: salidas,
  positions,
};
const stamp = now.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
writeFileSync(join(expDir, `cycle-${stamp}.json`), JSON.stringify(record, null, 2));
writeFileSync(join(expDir, "latest.json"), JSON.stringify(record, null, 2));

const withCanvas = !process.argv.includes("--no-canvas");
const canvas = withCanvas ? writeCanvas({
  at: now,
  venueLine: books.map((b) => `${b.id} ${b.ok ? b.quotes.length : "caído"}`).join(" · "),
  shared: keep.size,
  edgeCount: ranked.length,
  edges: ranked.slice(0, 8),
  positions,
  vistas: curr.size,
  segundas: segundas.length,
  bloqueadas: bloqueadas.length,
}) : null;

console.log(JSON.stringify({
  at: now,
  shared: keep.size,
  vistas: curr.size,
  segundas: segundas.length,
  bloqueadas: bloqueadas.length,
  entradas: confirmadas.length,
  salidas: salidas.length,
  abiertas: positions.length,
  canvas,
}, null, 2));

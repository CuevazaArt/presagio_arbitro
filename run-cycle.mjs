import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAll } from "./venues.mjs";
import { bestPerBase, edgesFor, sharedUniverse } from "./graph.mjs";
import {
  MAX_POSITIONS,
  markDoors,
  openFromEdge,
  stepPosition,
} from "./doors.mjs";
import { writeCanvas } from "./write-canvas.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const dataDir = join(root, "data");
const positionsPath = join(dataDir, "positions.json");

function loadPositions() {
  if (!existsSync(positionsPath)) return { open: [], closed: [] };
  return JSON.parse(readFileSync(positionsPath, "utf8"));
}

const books = await fetchAll();
const keep = sharedUniverse(books);
const quotes = books.flatMap((b) => b.quotes.filter((q) => keep.has(`${q.base}:${q.quote}`)));
const edges = edgesFor(quotes, 100);
const ranked = bestPerBase(edges);
const now = new Date().toISOString();

const book = loadPositions();
const open = [];
const events = [];
for (const pos of book.open) {
  const stepped = stepPosition(pos, quotes);
  if (stepped.event) {
    events.push({ ...stepped.pos });
    book.closed.push(stepped.pos);
  } else {
    open.push(stepped.pos);
  }
}

const held = new Set(open.map((p) => p.base));
for (const edge of ranked) {
  if (open.length >= MAX_POSITIONS) break;
  if (held.has(edge.base)) continue;
  if (!(edge.netUsd > 0)) continue;
  open.push(openFromEdge(edge, now));
  held.add(edge.base);
}

const positions = open.map((pos) => ({ ...pos, ...markDoors(pos) }));
book.open = positions;
mkdirSync(dataDir, { recursive: true });
writeFileSync(positionsPath, JSON.stringify(book, null, 2));

const stamp = now.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const record = {
  at: now,
  venues: books.map((b) => ({ id: b.id, ok: b.ok, ms: b.ms, n: b.quotes.length, error: b.error || null })),
  shared: keep.size,
  quotes: quotes.length,
  edgeCount: edges.length,
  top: ranked.slice(0, 12),
  events,
  positions: positions.map((p) => ({
    base: p.base,
    buyVenue: p.buyVenue,
    sellVenue: p.sellVenue,
    floating: p.floating,
    status: p.status,
    preference: p.preference,
    toBe: p.toBe,
    toTrail: p.toTrail,
    toLiq: p.toLiq,
  })),
};
writeFileSync(join(dataDir, `cycle-${stamp}.json`), JSON.stringify(record, null, 2));
writeFileSync(join(dataDir, "latest.json"), JSON.stringify(record, null, 2));

const venueLine = books
  .map((b) => `${b.id} ${b.ok ? b.quotes.length : "caído"}`)
  .join(" · ");
appendFileSync(join(dataDir, "libro.jsonl"), JSON.stringify({
  at: now,
  open: book.open,
  closedThisCycle: events,
}) + "\n");

const withCanvas = !process.argv.includes("--no-canvas");
const canvas = withCanvas ? writeCanvas({
  at: now,
  venueLine,
  shared: keep.size,
  edgeCount: edges.length,
  edges: ranked.slice(0, 8),
  positions,
}) : null;

console.log(JSON.stringify({
  at: now,
  shared: keep.size,
  edgeCount: edges.length,
  opened: positions.length,
  closedNow: events.length,
  floatingUsd: Math.round(positions.reduce((s, p) => s + (p.floating || 0), 0) * 1000) / 1000,
  realizedUsd: Math.round(book.closed.reduce((s, p) => s + (p.realizedUsd || 0), 0) * 1000) / 1000,
  top: ranked[0] || null,
  canvas,
}, null, 2));

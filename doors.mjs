/**
 * Posición de papel. No hay orden en ningún venue.
 * Mientras el nominal no vuelve a USDT, el flotante vive entre tres puertas.
 */
export const NOTIONAL_USD = 100;
export const LIQ_USD = 1;
export const ARM_USD = 0.15;
export const GIVE_USD = 0.05;
export const BE_USD = 0;
export const MAX_POSITIONS = 5;

import { VENUES } from "./venues.mjs";

const FEE = Object.fromEntries(VENUES.map((v) => [v.id, v.feeBps / 10_000]));

export function floatingOf(pos, quotes) {
  const bids = quotes.filter(
    (q) => q.base === pos.base && q.venue !== pos.buyVenue && q.bid > 0,
  );
  if (!bids.length) return null;
  let best = null;
  for (const q of bids) {
    const peg = q.quote === pos.buyQuote ? 1 : 1 - 2 / 10_000;
    const proceeds = q.bid * pos.qty * (1 - FEE[q.venue]) * peg;
    if (!best || proceeds > best.proceeds) {
      best = { proceeds, venue: q.venue, quote: q.quote, bid: q.bid };
    }
  }
  return {
    floating: Math.round((best.proceeds - pos.cost) * 1000) / 1000,
    sellVenue: best.venue,
    sellQuote: best.quote,
    bid: best.bid,
  };
}

export function openFromEdge(edge, now) {
  const qty = NOTIONAL_USD / edge.ask;
  const cost = edge.ask * qty * (1 + FEE[edge.buyVenue]);
  return {
    id: `${edge.base}-${now}`,
    base: edge.base,
    buyVenue: edge.buyVenue,
    buyQuote: edge.buyQuote,
    sellVenue: edge.sellVenue,
    sellQuote: edge.sellQuote,
    entryAsk: edge.ask,
    entryBid: edge.bid,
    entryEdgeUsd: edge.netUsd,
    notionalUsd: NOTIONAL_USD,
    qty,
    cost,
    openedAt: now,
    cycles: 0,
    mfeUsd: edge.netUsd,
    floating: edge.netUsd,
    status: edge.netUsd >= ARM_USD ? "trail_armed" : "abierta",
    door: null,
    realizedUsd: null,
  };
}

export function markDoors(pos) {
  const toBe = Math.max(0, pos.floating - BE_USD);
  const toTrail = Math.max(0, ARM_USD - pos.floating);
  const toLiq = pos.floating + LIQ_USD;
  let preference = "be";
  if (pos.floating >= ARM_USD) preference = "trail";
  else if (toLiq < toBe && toLiq < toTrail) preference = "liq";
  else if (toTrail < toBe && pos.floating > BE_USD) preference = "trail";
  return {
    toBe: Math.round(toBe * 1000) / 1000,
    toTrail: Math.round(toTrail * 1000) / 1000,
    toLiq: Math.round(toLiq * 1000) / 1000,
    preference,
  };
}

/** Cruza una puerta solo a partir del segundo ciclo, para poder mostrar la entrada. */
export function stepPosition(pos, quotes) {
  const live = floatingOf(pos, quotes);
  const next = { ...pos, cycles: pos.cycles + 1 };
  if (!live) {
    next.status = "sin_libro";
    return { pos: next, event: null };
  }
  next.floating = live.floating;
  next.sellVenue = live.sellVenue;
  next.sellQuote = live.sellQuote;
  next.mfeUsd = Math.max(pos.mfeUsd, live.floating);
  if (pos.cycles < 1) {
    next.status = next.mfeUsd >= ARM_USD ? "trail_armed" : "abierta";
    return { pos: next, event: null };
  }
  if (next.floating <= -LIQ_USD) {
    next.status = "liquidada";
    next.door = "liq";
    next.realizedUsd = next.floating;
    return { pos: next, event: "liq" };
  }
  if (next.mfeUsd >= ARM_USD && next.floating <= next.mfeUsd - GIVE_USD) {
    next.status = "trail";
    next.door = "trail";
    next.realizedUsd = next.floating;
    return { pos: next, event: "trail" };
  }
  if (next.floating <= BE_USD) {
    next.status = "break_even";
    next.door = "be";
    next.realizedUsd = next.floating;
    return { pos: next, event: "be" };
  }
  next.status = next.mfeUsd >= ARM_USD ? "trail_armed" : "abierta";
  next.door = null;
  return { pos: next, event: null };
}

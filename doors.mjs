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

export function openConfirmed(edge, now, ajuste) {
  const notional = edge.notionalUsd || ajuste.notionalUsd;
  const qty = notional / edge.ask;
  const cost = edge.ask * qty * (1 + FEE[edge.buyVenue]) + ajuste.transferCostUsd;
  return {
    id: `${edge.base}-${now}`,
    base: edge.base,
    buyVenue: edge.buyVenue,
    buyQuote: edge.buyQuote,
    sellVenue: edge.sellVenue,
    sellQuote: edge.sellQuote,
    entryAsk: edge.ask,
    entryBid: edge.bid,
    edgeAlEntrarUsd: edge.netUsd,
    notionalUsd: notional,
    qty,
    cost,
    openedAt: now,
    cycles: 0,
    mfeDesdeEntradaUsd: 0,
    pnlDesdeEntradaUsd: 0,
    valorSiCierraAhoraUsd: edge.netUsd,
    floating: 0,
    status: "abierta",
    door: null,
    realizedUsd: null,
    topAskUsd: edge.topAskUsd,
    topBidUsd: edge.topBidUsd,
    transferCostUsd: ajuste.transferCostUsd,
  };
}

export function markDoors(pos, ajuste = {}) {
  const arm = ajuste.armUsd ?? ARM_USD;
  const liq = ajuste.liqUsd ?? LIQ_USD;
  const valor = pos.valorSiCierraAhoraUsd ?? 0;
  const desde = pos.pnlDesdeEntradaUsd ?? pos.floating ?? 0;
  const toBe = Math.max(0, valor - BE_USD);
  const toTrail = Math.max(0, arm - desde);
  const toLiq = valor + liq;
  let preference = "be";
  if (desde >= arm) preference = "trail";
  else if (toLiq < toBe && toLiq < toTrail) preference = "liq";
  return {
    toBe: Math.round(toBe * 1000) / 1000,
    toTrail: Math.round(toTrail * 1000) / 1000,
    toLiq: Math.round(toLiq * 1000) / 1000,
    preference,
  };
}

/**
 * El flotante de las puertas es el cambio desde la entrada, y nace en 0.
 * Realizar solo ocurre al cruzar una puerta, por el valor de cerrar en ese momento.
 */
export function stepPosition(pos, liveNetUsd, ajuste = {}) {
  const arm = ajuste.armUsd ?? ARM_USD;
  const give = ajuste.giveUsd ?? GIVE_USD;
  const liq = ajuste.liqUsd ?? LIQ_USD;
  const next = { ...pos, cycles: pos.cycles + 1 };
  if (liveNetUsd == null) {
    next.status = "sin_libro";
    next.pnlDesdeEntradaUsd = -pos.edgeAlEntrarUsd;
    next.floating = next.pnlDesdeEntradaUsd;
    if (pos.cycles < 1) return { pos: next, event: null };
    next.status = "break_even";
    next.door = "be";
    next.realizedUsd = 0;
    next.valorSiCierraAhoraUsd = 0;
    return { pos: next, event: "be" };
  }
  next.valorSiCierraAhoraUsd = liveNetUsd;
  next.pnlDesdeEntradaUsd = Math.round((liveNetUsd - pos.edgeAlEntrarUsd) * 1000) / 1000;
  next.floating = next.pnlDesdeEntradaUsd;
  next.mfeDesdeEntradaUsd = Math.max(pos.mfeDesdeEntradaUsd || 0, next.pnlDesdeEntradaUsd);
  if (pos.cycles < 1) {
    next.status = next.mfeDesdeEntradaUsd >= arm ? "trail_armed" : "abierta";
    return { pos: next, event: null };
  }
  if (liveNetUsd <= -liq) {
    next.status = "liquidada";
    next.door = "liq";
    next.realizedUsd = liveNetUsd;
    return { pos: next, event: "liq" };
  }
  if (next.mfeDesdeEntradaUsd >= arm && next.pnlDesdeEntradaUsd <= next.mfeDesdeEntradaUsd - give) {
    next.status = "trail";
    next.door = "trail";
    next.realizedUsd = liveNetUsd;
    return { pos: next, event: "trail" };
  }
  if (liveNetUsd <= BE_USD) {
    next.status = "break_even";
    next.door = "be";
    next.realizedUsd = liveNetUsd;
    return { pos: next, event: "be" };
  }
  next.status = next.mfeDesdeEntradaUsd >= arm ? "trail_armed" : "abierta";
  next.door = null;
  return { pos: next, event: null };
}

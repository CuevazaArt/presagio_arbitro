/**
 * Experimento de 4 horas. Descarta o sostiene el patrón visto en 29.6 s.
 * La bitácora vive aquí, aparte del libro (data/libro.jsonl) y del canvas.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const repo = root;
const bitacora = join(root, "BITACORA.md");
const HOURS = 4;
const INTERVAL_MS = 60_000;
const CANVAS_EVERY_MS = 15 * 60_000;
const started = new Date();
const ends = new Date(started.getTime() + HOURS * 60 * 60 * 1000);

function stamp(d) {
  return d.toISOString().replace("T", " ").replace(".000Z", "Z");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

writeFileSync(bitacora, `# Bitácora Presagio

Experimento local para descartar el patrón de beneficio visto en una ventana de 29.6 segundos (11 oct 2026, 21:42:14 a 21:42:43 UTC).

- Inicio: ${stamp(started)}
- Fin previsto: ${stamp(ends)}
- Ciclo: cada 60 segundos
- Artefacto (canvas): cada 15 minutos
- Libro detallado: \`data/libro.jsonl\` (una línea por ciclo, posiciones completas)
- Ciclos: \`data/cycle-*.json\`
- Esta bitácora no es el libro ni el gráfico. Los registra.

Criterio de descarte, al cerrar las 4 horas:

- Si el flotante del libro es negativo en más de la mitad de los ciclos, se descarta “el libro se mantiene en positivo”.
- Si el primer nombre del ranking cambia en más de la mitad de los ciclos respecto al anterior, se descarta “el ranking de arriba persiste”.
- Si el realizado por puertas es negativo y mayor en valor absoluto que el flotante medio, se descarta “el beneficio se consolida a favor”.

`);

let n = 0;
let lastCanvas = 0;
let prevTop = null;
let positive = 0;
let rankSame = 0;
let compared = 0;

while (Date.now() < ends.getTime()) {
  const tick = Date.now();
  n += 1;
  const withCanvas = n === 1 || tick - lastCanvas >= CANVAS_EVERY_MS;
  const args = [join(root, "run-cycle.mjs")];
  if (!withCanvas) args.push("--no-canvas");
  const res = spawnSync(process.execPath, args, { cwd: repo, encoding: "utf8" });
  let latest = null;
  try {
    latest = JSON.parse(readFileSync(join(root, "data", "latest.json"), "utf8"));
  } catch {
    latest = null;
  }
  const at = latest?.at || new Date().toISOString();
  const topEdge = Array.isArray(latest?.top) ? latest.top[0] : latest?.top;
  const top = topEdge?.base || "ninguno";
  const floatingSum = (latest?.positions || []).reduce((s, p) => s + (Number(p.floating) || 0), 0);
  const floating = latest?.positions ? Math.round(floatingSum * 1000) / 1000 : "sin dato";
  const edges = latest?.edgeCount ?? "sin dato";
  const open = latest?.positions?.length ?? "sin dato";
  if (typeof floating === "number" && floating > 0) positive += 1;
  if (prevTop) {
    compared += 1;
    if (prevTop === top) rankSame += 1;
  }
  prevTop = top;
  const cycleFile = `presagio/data/cycle-${at.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}.json`;
  const doors = (latest?.positions || [])
    .map((p) => `${p.base} ${p.floating} ${p.preference}`)
    .join("; ");
  appendFileSync(bitacora, `## Ciclo ${n} · ${at}

- Registro: \`${cycleFile.replace("presagio/", "")}\`
- Libro: \`data/libro.jsonl\` (última línea)
- Artefacto: ${withCanvas ? "`artefacto/presagio-ciclo.canvas.tsx` actualizado" : "sin tocar en este ciclo"}
- Venues: ${(latest?.venues || []).map((v) => `${v.id} ${v.ok ? v.n : "caído"}`).join(" · ") || "sin lectura"}
- Pares compartidos: ${latest?.shared ?? "sin dato"}. Aristas: ${edges}. Abiertas: ${open}. Cierres de este ciclo: ${Array.isArray(latest?.events) ? latest.events.length : "ver libro"}
- Flotante del libro: ${floating}. Realizado acumulado: ${latest?.realizedUsd ?? "ver libro"}. Tope: ${top} ${topEdge?.netUsd ?? ""}
- Libro abierto: ${doors || "vacío"}
- Proceso: ${res.status === 0 ? "ok" : "error " + res.status + " " + String(res.stderr || "").slice(-180)}

`);
  if (withCanvas) lastCanvas = tick;
  const left = ends.getTime() - Date.now();
  if (left <= 0) break;
  const wait = INTERVAL_MS - (Date.now() - tick);
  await sleep(Math.min(Math.max(0, wait), left));
}

appendFileSync(bitacora, `## Cierre · ${stamp(new Date())}

- Ciclos: ${n}
- Flotante positivo: ${positive} de ${n}
- Tope igual al ciclo previo: ${rankSame} de ${compared}
- Libro: \`data/libro.jsonl\`
- Último artefacto: \`artefacto/presagio-ciclo.canvas.tsx\`

`);

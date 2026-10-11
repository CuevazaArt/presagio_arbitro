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
const bitacora = join(root, "BITACORA-EXP2.md");
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

writeFileSync(bitacora, `# Bitácora Presagio — experimento 2

Se descarta el experimento 1: una arista de cotización nacía como posición en beneficio y el trail la anotaba como realizada. Aquí una entrada al registro existe solo si la misma arista sigue en una segunda lectura, el primer nivel cubre el nocional, el costo de transferencia deja el neto en positivo, y hay saldo en los dos venues. Con los saldos de \`ajuste.json\` en cero, el canje no se abre.

Experimento local de 4 horas. La bitácora no es el libro ni el registro ni el gráfico.

- Inicio: ${stamp(started)}
- Fin previsto: ${stamp(ends)}
- Ajuste: \`presagio/ajuste.json\`
- Registro de entradas y salidas: \`presagio/data/exp2/registro.jsonl\`
- Libro de posiciones confirmadas: \`presagio/data/exp2/libro.jsonl\`
- Ciclos: \`presagio/data/exp2/cycle-*.json\`

Criterio de descarte:

- Si no hay ninguna entrada confirmada, se descarta que el hueco de cotización sea una operación.
- Si hay entradas y el realizado de las salidas es negativo y mayor en valor absoluto que el flotante medio, se descarta que el beneficio se consolide a favor.
- Si el primer nombre de las aristas vistas cambia en más de la mitad de los ciclos, se descarta que el ranking de la señal persista.

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
    latest = JSON.parse(readFileSync(join(root, "data", "exp2", "latest.json"), "utf8"));
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
  if (typeof latest?.floatingUsd === "number") {
    if (latest.floatingUsd > 0) positive += 1;
  }
  if (prevTop) {
    compared += 1;
    if (prevTop === top) rankSame += 1;
  }
  prevTop = top;
  const cycleFile = `presagio/data/exp2/cycle-${at.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}.json`;
  const doors = (latest?.positions || [])
    .map((p) => `${p.base} ${p.floating} ${p.preference}`)
    .join("; ");
  appendFileSync(bitacora, `## Ciclo ${n} · ${at}

- Ciclo: \`${cycleFile}\`
- Registro objetivo: \`presagio/data/exp2/registro.jsonl\`
- Libro: \`presagio/data/exp2/libro.jsonl\`
- Artefacto: ${withCanvas ? "`canvases/presagio-ciclo.canvas.tsx` actualizado" : "sin tocar en este ciclo"}
- Vistas netas tras transferencia: ${latest?.vistas ?? "sin dato"}. Segundas lecturas: ${latest?.segundas ?? "sin dato"}. Bloqueadas: ${latest?.bloqueadas ?? "sin dato"} ${latest?.bloqueadasPor ? JSON.stringify(latest.bloqueadasPor) : ""}. Entradas: ${latest?.confirmadas ?? "sin dato"}. Salidas: ${Array.isArray(latest?.events) ? latest.events.length : "sin dato"}
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
- Libro: \`presagio/data/libro.jsonl\`
- Último artefacto: \`canvases/presagio-ciclo.canvas.tsx\`

`);

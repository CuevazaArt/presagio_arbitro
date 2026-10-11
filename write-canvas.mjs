import { writeFileSync } from "node:fs";

const CANVAS = "C:/Users/lexar/.cursor/projects/c-Users-lexar-Desktop-xrpl-trading-bot/canvases/presagio-ciclo.canvas.tsx";

export function writeCanvas(state) {
  const body = `import {
  BarChart,
  H1,
  H2,
  H3,
  PieChart,
  Row,
  Stack,
  Text,
  useEffect,
  useHostTheme,
  useState,
} from "cursor/canvas";

const STATE = ${JSON.stringify(state)};
const LIQ = -1;
const BE = 0;
const ARM = 0.15;

function Doors() {
  const theme = useHostTheme();
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    let frame = 0;
    const started = performance.now();
    const loop = (now: number) => {
      setSeconds((now - started) / 1000);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const rows = STATE.positions;
  const width = 920;
  const rowH = 78;
  const top = 36;
  const left = 280;
  const right = 16;
  const plotW = width - left - right;
  const height = Math.max(120, top + rows.length * rowH + 16);
  const xMin = -1.4;
  const peak = rows.reduce((m, p) => Math.max(m, p.floating), ARM);
  const xMax = Math.max(0.8, peak + 0.35);
  const xOf = (usd: number) => left + ((usd - xMin) / (xMax - xMin)) * plotW;
  const liqX = xOf(LIQ);
  const beX = xOf(BE);
  const armX = xOf(ARM);
  const liqColor = theme.chart.palette.darkAmber;
  const beColor = theme.chart.palette.blue;
  const trailColor = theme.chart.palette.green;

  if (!rows.length) {
    return (
      <Text>
        No hay posición confirmada en este ciclo. Una arista de cotización no es una entrada.
      </Text>
    );
  }

  return (
    <svg viewBox={"0 0 " + width + " " + height} width="100%" role="img" aria-label="Posiciones de Presagio entre liquidación, break-even y trail">
      <line x1={liqX} y1={14} x2={liqX} y2={height - 8} stroke={liqColor} strokeWidth={1} />
      <line x1={beX} y1={14} x2={beX} y2={height - 8} stroke={beColor} strokeWidth={1} />
      <line x1={armX} y1={14} x2={armX} y2={height - 8} stroke={trailColor} strokeWidth={1} />
      <text x={liqX} y={12} textAnchor="middle" fill={liqColor} fontSize={11}>liq −$1</text>
      <text x={beX} y={12} textAnchor="middle" fill={beColor} fontSize={11}>BE $0</text>
      <text x={armX} y={12} textAnchor="middle" fill={trailColor} fontSize={11}>trail $0.15</text>
      {rows.map((pos, i) => {
        const y = top + i * rowH + 16;
        const x = xOf(Math.max(xMin, Math.min(xMax, pos.floating)));
        const phase = (seconds * 0.25) % 1;
        const bePulse = beX + (x - beX) * (1 - phase);
        const liqPulse = x + (liqX - x) * phase;
        return (
          <g key={pos.id}>
            <line x1={liqX} y1={y} x2={x} y2={y} stroke={liqColor} strokeWidth={1.4} />
            <line x1={x} y1={y} x2={beX} y2={y} stroke={beColor} strokeWidth={pos.preference === "be" ? 3 : 1.4} />
            <line x1={beX} y1={y} x2={armX} y2={y} stroke={trailColor} strokeWidth={pos.preference === "trail" ? 3 : 1.4} />
            {x > armX ? <line x1={armX} y1={y} x2={x} y2={y} stroke={trailColor} strokeWidth={3} /> : null}
            <circle cx={liqPulse} cy={y} r={3} fill={liqColor} />
            <circle cx={pos.preference === "trail" ? armX + (x - armX) * phase : bePulse} cy={y} r={pos.preference === "be" ? 5.5 : pos.preference === "trail" ? 5.5 : 3} fill={pos.preference === "trail" ? trailColor : beColor} />
            <circle cx={x} cy={y} r={6} fill={theme.text.primary} />
            <text x={left - 10} y={y - 6} textAnchor="end" fill={theme.chart.palette.green} fontSize={12}>
              {"Compra " + pos.base + " · paga " + pos.buyQuote + " · " + pos.buyVenue}
            </text>
            <text x={left - 10} y={y + 12} textAnchor="end" fill={theme.chart.palette.goldenYellow} fontSize={12}>
              {"Vende " + pos.base + " · recibe " + pos.sellQuote + " · " + pos.sellVenue}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function tally(key) {
  const map = new Map();
  for (const pos of STATE.positions) {
    const label = String(pos[key]);
    map.set(label, (map.get(label) || 0) + pos.notionalUsd);
  }
  return Array.from(map.entries()).map(([label, value]) => ({ label: label + " $" + value, value }));
}

export default function PresagioCiclo() {
  const tops = STATE.edges.slice(0, 8);
  return (
    <Stack gap={16}>
      <Stack gap={6}>
        <H1>Presagio, ciclo de las tres puertas</H1>
        <Text tone="secondary">
          {"Universo compartido por al menos 3 de 5 venues spot. Ciclo " + STATE.at + ". Posiciones de papel de $100. Ninguna orden salió a un exchange."}
        </Text>
      </Stack>
      <Doors />
      <Text size="small" tone="secondary">
        El nodo es el flotante en USDT. El pulso grande va hacia el break-even si el beneficio todavía no se consolidó. Cruzar una puerta realiza ese flotante. Fuentes públicas: Binance, Gate, OKX, Bybit, KuCoin.
      </Text>
      {STATE.positions.length ? (
        <Stack gap={8}>
          <H2>Composición del libro confirmado</H2>
          <Row gap={24} align="start">
            <Stack gap={6}>
              <H3>Fondos con los que se paga</H3>
              <PieChart donut size={180} data={tally("buyQuote")} />
            </Stack>
            <Stack gap={6}>
              <H3>Activos comprados</H3>
              <PieChart donut size={180} data={tally("base")} />
            </Stack>
            <Stack gap={6}>
              <H3>Venue donde se compra</H3>
              <PieChart donut size={180} data={tally("buyVenue")} />
            </Stack>
          </Row>
        </Stack>
      ) : (
        <Text>No hay posiciones confirmadas. El grafo sigue en señal hasta la segunda lectura, el tamaño y el saldo.</Text>
      )}
      <H2>Mejores canjes de este ciclo</H2>
      <BarChart
        horizontal
        height={280}
        categories={tops.map((e) => "Compra " + e.base + "/" + e.buyQuote + " " + e.buyVenue + " · vende " + e.sellQuote + " " + e.sellVenue)}
        series={[{ name: "Beneficio neto en $100", data: tops.map((e) => e.netUsd), tone: "success" }]}
        valuePrefix="$"
      />
      <Text size="small" tone="secondary">
        {STATE.venueLine + " Pares compartidos: " + STATE.shared + ". Aristas con beneficio: " + STATE.edgeCount + "."}
      </Text>
    </Stack>
  );
}
`;
  writeFileSync(CANVAS, body);
  return CANVAS;
}

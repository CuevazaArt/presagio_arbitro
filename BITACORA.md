# Bitácora Presagio

Copia de origen tomada al crear este repo. La corrida de cuatro horas que empezó a las 22:26:13 UTC del 11 oct 2026 sigue escribiendo la bitácora viva en `xrpl-trading-bot/presagio/BITACORA.md` hasta las 02:26:13 UTC del 12 oct. A partir de la siguiente corrida, la bitácora de este repositorio es la de aquí.



Experimento local para descartar el patrón de beneficio visto en una ventana de 29.6 segundos (11 oct 2026, 21:42:14 a 21:42:43 UTC).

- Inicio: 2026-10-11 22:26:13.139Z
- Fin previsto: 2026-10-12 02:26:13.139Z
- Ciclo: cada 60 segundos
- Artefacto (canvas): cada 15 minutos
- Libro detallado: `presagio/data/libro.jsonl` (una línea por ciclo, posiciones completas)
- Ciclos: `presagio/data/cycle-*.json`
- Esta bitácora no es el libro ni el gráfico. Los registra.

Criterio de descarte, al cerrar las 4 horas:

- Si el flotante del libro es negativo en más de la mitad de los ciclos, se descarta “el libro se mantiene en positivo”.
- Si el primer nombre del ranking cambia en más de la mitad de los ciclos respecto al anterior, se descarta “el ranking de arriba persiste”.
- Si el realizado por puertas es negativo y mayor en valor absoluto que el flotante medio, se descarta “el beneficio se consolida a favor”.

## Ciclo 1 · 2026-10-11T22:26:14.520Z

- Registro: `presagio/data/cycle-20261011T222614Z.json`
- Libro: `presagio/data/libro.jsonl` (última línea)
- Artefacto: `canvases/presagio-ciclo.canvas.tsx` actualizado
- Venues: binance 727 · gate 1657 · okx 692 · bybit 455 · kucoin 840
- Pares compartidos: 550. Aristas: 39. Abiertas: 5. Cierres de este ciclo: 1
- Flotante del libro: 5.717. Realizado acumulado: ver libro. Tope: AI 1.997
- Libro abierto: LUNC 2.018 trail; GMT 0.982 trail; VOOI 0.423 trail; VERONA 0.297 trail; AI 1.997 trail
- Proceso: ok

## Ciclo 2 · 2026-10-11T22:27:14.599Z

- Registro: `presagio/data/cycle-20261011T222714Z.json`
- Libro: `presagio/data/libro.jsonl` (última línea)
- Artefacto: sin tocar en este ciclo
- Venues: binance 727 · gate 1657 · okx 692 · bybit 455 · kucoin 840
- Pares compartidos: 550. Aristas: 42. Abiertas: 5. Cierres de este ciclo: 2
- Flotante del libro: 5.599. Realizado acumulado: ver libro. Tope: AI 1.997
- Libro abierto: VOOI 0.423 trail; VERONA 0.297 trail; AI 1.999 trail; LUNC 1.817 trail; EGLD 1.063 trail
- Proceso: ok

## Ciclo 3 · 2026-10-11T22:28:14.660Z

- Registro: `presagio/data/cycle-20261011T222814Z.json`
- Libro: `presagio/data/libro.jsonl` (última línea)
- Artefacto: sin tocar en este ciclo
- Venues: binance 727 · gate 1657 · okx 692 · bybit 455 · kucoin 840
- Pares compartidos: 550. Aristas: 42. Abiertas: 5. Cierres de este ciclo: 0
- Flotante del libro: 5.577. Realizado acumulado: ver libro. Tope: AI 1.997
- Libro abierto: VOOI 0.448 trail; VERONA 0.297 trail; AI 1.999 trail; LUNC 1.819 trail; EGLD 1.014 trail
- Proceso: ok

## Ciclo 4 · 2026-10-11T22:29:14.659Z

- Registro: `presagio/data/cycle-20261011T222914Z.json`
- Libro: `presagio/data/libro.jsonl` (última línea)
- Artefacto: sin tocar en este ciclo
- Venues: binance 727 · gate 1657 · okx 692 · bybit 455 · kucoin 840
- Pares compartidos: 550. Aristas: 40. Abiertas: 5. Cierres de este ciclo: 0
- Flotante del libro: 5.552. Realizado acumulado: ver libro. Tope: AI 1.997
- Libro abierto: VOOI 0.423 trail; VERONA 0.297 trail; AI 1.999 trail; LUNC 1.819 trail; EGLD 1.014 trail
- Proceso: ok


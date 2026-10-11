# Presagio

Arbitraje de cripto spot por grafo. Compara cotizaciones públicas de hasta cinco venues, busca un canje con beneficio nominal y, si lo hay, deja una posición de papel entre tres puertas de salida. No envía órdenes.

El nombre junta dos palabras. Un **presagio** es un anuncio. El **agio** es el diferencial que se cobra al cambiar un activo por otro.

Repositorio: [CuevazaArt/presagio_arbitro](https://github.com/CuevazaArt/presagio_arbitro).

## De dónde sale

Sale de la operación del sleeve Tokyo Fixed, en el repo `xrpl-trading-bot`, el 11 de octubre de 2026.

Ese sleeve (`emma-flip-lev-shanghai`, pid 2498471 desde el 2 oct 2026 22:56Z) opera perpetuos de Binance a nocional de $10, con un libro heredado de unos $51. Para estudiar esas piernas se dibujó un grafo: cada posición es un nodo y las aristas son la distancia en dólares hasta tres puertas (break-even cerca de $0, trail desde +$2.50, liquidación cerca del margen aislado). La preferencia es la arista más corta. Ese dibujo está en el canvas `tokyo-legacy51-grafo-animado` de esa sesión.

De ahí se tomó la idea, no el proceso. La primera medición propia de Presagio fue un ciclo de cotizaciones spot, de **21:42:14 a 21:42:43 UTC** del 11 oct 2026: cinco canjes de papel de $100, flotante de +$3.579 a +$3.725, realizado $0. Un experimento de cuatro horas, iniciado a las **22:26:13 UTC** y previsto hasta las **02:26:13 UTC** del 12 oct, sigue escribiendo su bitácora en la carpeta `presagio/` de `xrpl-trading-bot` hasta que esa corrida termine. Esta copia del repo no depende de esa carpeta.

## Qué es común y qué no se comparte

Común, solo como idea:

- Una posición elegida no se consolida sola. Se queda con un valor flotante hasta cruzar una puerta.
- Las tres puertas son trail, break-even y liquidación. Cruzar una realiza el flotante.
- Antes de esa espera, el grafo ofrece la primera oportunidad: canjear y volver el nominal a USDT.
- El informe de un periodo es un gráfico animado. El pulso grande va por la arista más corta.

No se comparte nada de la operación de Tokyo:

- No importa `emmaFlipLevLiveRunner` ni ningún módulo de ese repo.
- No abre `live.db`, no lee `.env`, no usa las claves de Binance, Gate, OKX, Bybit ni KuCoin.
- No entra en el `ecosystem` ni en pm2. El pid 2498471 no es de este proyecto.
- El universo de 177 perpetuos, el nocional de $10 y el arm de $2.50–$6 no rigen aquí.
- Las cotizaciones salen de endpoints públicos de spot. El nocional de papel es $100.
- El canvas y el HTML de este repo se escriben en `artefacto/`, no en el directorio de canvases del otro proyecto.

## Qué hace un ciclo

`npm run cycle` descarga el libro spot de Binance, Gate, OKX, Bybit y KuCoin. Se queda con pares cripto contra USDT o USDC que estén en al menos tres venues. Arma aristas de compra y venta. Eso es una señal, no una posición.

Una entrada al registro (`data/exp2/registro.jsonl`) existe solo si pasan las cuatro pruebas de `ajuste.json`: la misma arista sigue en la lectura siguiente, el primer nivel de los dos libros cubre el nocional, el costo de transferencia deja el neto por encima de cero, y hay saldo del quote en el venue de compra y del activo en el venue de venta. Si el saldo está en cero, el canje no se abre. El flotante de una posición confirmada nace en cero: el hueco visto al entrar no se anota como beneficio. El realizado se escribe solo en la salida, cuando se cruza trail, break-even o liquidación.

Los números de `ajuste.json` (nocional, lecturas, tamaño mínimo, costo de transferencia, saldos, arm, give, liquidación) son el artefacto ajustable. No están escondidos en el código.

Todo el ciclo queda en `data/` (no se versiona): `cycle-*.json`, `latest.json` y `libro.jsonl`. La bitácora de un experimento largo es `BITACORA.md`, aparte del libro y del gráfico, y los menciona.

`npm run experiment` repite el ciclo cada 60 segundos durante 4 horas y reescribe el artefacto cada 15 minutos.

La página para ver el último dibujo a mano es `presagio-ciclo.html`. El ciclo nuevo escribe `artefacto/presagio-ciclo.canvas.tsx`.

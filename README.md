# CryptoAI Predictor — JavaScript Edition

A full-stack cryptocurrency research dashboard built with **JavaScript end to end**:

- React + Vite + Recharts frontend
- Node.js + Express backend
- CCXT for Binance public market data (no API key required for public candles/tickers)
- Custom JavaScript technical-indicator calculations
- A small, explainable gradient-boosted regression-stump model implemented in JavaScript
- Per-asset model persistence as JSON

> This edition replaces the earlier Python/FastAPI/XGBoost backend. The prediction model is **not XGBoost**: it is a JavaScript gradient-boosted decision-stump regressor. It avoids a Python runtime and native ML bindings while keeping the training and inference pipeline in JavaScript. Do not describe it as XGBoost.

## Requirements

- Node.js 20 LTS or newer
- npm 10 or newer
- Internet connection for Binance public market data and npm installation

## Setup (Windows PowerShell)

1. Extract the ZIP.
2. Open a terminal in the extracted `cryptoai-js` folder.
3. Install all workspace dependencies:

```powershell
npm install
```

4. Start both frontend and backend:

```powershell
npm run dev
```

5. Open the app:

- Website: http://localhost:5173
- API health: http://localhost:8000/health
- API market list: http://localhost:8000/api/markets

## Run services separately

Backend:

```powershell
npm run dev --workspace server
```

Frontend (in a second terminal):

```powershell
npm run dev --workspace client
```

## How to use

1. Open the website and select a market such as BTC/USDT.
2. The app loads hourly candles and technical indicators from Binance.
3. Select **Train model & predict**. Training uses historical hourly candles, creates technical features, and predicts the 24-hour forward return.
4. The model is saved to `server/models/` as JSON. A saved model can be used for later predictions without retraining.
5. The performance endpoint is available at `http://localhost:8000/api/performance`.

## API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Server health |
| GET | `/api/markets` | Supported USDT markets and current tickers |
| GET | `/api/market/:symbol` | Ticker, hourly candles, and indicators |
| POST | `/api/train/:symbol` | Train and validate the selected asset model |
| GET | `/api/predict/:symbol` | Return the saved model's latest 24-hour forecast |
| GET | `/api/performance` | List locally trained models and holdout metrics |

For symbol routes, use `BTC-USDT` in a browser URL or `BTC/USDT` in the frontend. The server accepts both route forms.

## Model details

- Features: recent returns, RSI, EMA gaps, MACD, Bollinger position, realized volatility, volume ratio, ATR, candle body/range, and time-of-day encoding.
- Target: return from the current close to the close 24 hourly candles later.
- Validation: chronological 80/20 split with a 24-row purge before the holdout segment.
- Model: additive gradient boosting using shallow one-split regression trees (stumps).
- Metrics: return MAE, return RMSE, and directional accuracy.
- Price band: empirical 5th–95th percentile holdout residuals; it is not a calibrated probability interval.

This is a learning/research implementation, not a proven trading system. Historical validation does not guarantee future performance. Exchange data can be delayed, unavailable, or rate-limited. No trades are placed and no exchange credentials are requested.

## Troubleshooting

- **Market data unavailable:** check your internet connection and whether Binance is reachable from your network. Binance access can vary by jurisdiction/network.
- **npm install errors:** use Node.js 20 LTS or newer, delete `node_modules` and `package-lock.json`, then rerun `npm install`.
- **Not enough training samples:** training requires sufficient hourly history and a holdout set. Try another liquid market or retry later.
- **Port in use:** set `PORT=8001` in `server/.env` and update the Vite proxy in `client/vite.config.js` accordingly.

# 📈 StockOracle — Hybrid NGX Stock Predictor

A hybrid **technical + fundamental** stock-prediction system for the **Nigerian Exchange (NGX)**.
Pick a listed company and StockOracle produces a **BUY / SELL / HOLD** recommendation with
confidence and a full breakdown — combining LSTM-style technical indicators with LLM-scored
news sentiment, fused into a single signal.

This implements the methodology from *"Prediction of Stock Market Using Machine Learning
Techniques (Nigeria Case Study)"* as a working **React + Vite** frontend and **Node.js + Express**
backend.

---

## How it maps to the project methodology

| Methodology component (Ch. 3)            | Implementation |
| ---------------------------------------- | -------------- |
| `DataCollector`                          | [`services/DataCollector.js`](server/src/services/DataCollector.js) + scraper providers |
| `Preprocessor` (cleaning, alignment)     | [`services/Preprocessor.js`](server/src/services/Preprocessor.js) |
| `TechnicalIndicatorEngine`               | [`services/TechnicalIndicatorEngine.js`](server/src/services/TechnicalIndicatorEngine.js) — returns, SMA, EMA, RSI, ROC, σ, Bollinger, ATR, MACD |
| `LSTMModelTrainer` (technical predictor) | [`services/TechnicalModel.js`](server/src/services/TechnicalModel.js) — adaptive indicator-scoring model (see *Note on the LSTM* below) |
| `LLMFundamentalAnalyzer`                 | [`services/LLMFundamentalAnalyzer.js`](server/src/services/LLMFundamentalAnalyzer.js) — Claude @ temp 0, strict JSON, heuristic fallback |
| `FusionModel` (decision-level fusion)    | [`services/FusionModel.js`](server/src/services/FusionModel.js) — `P_final = α·P_tech + (1−α)·P_fund` |
| `Evaluator` (MSE/RMSE, Acc/Prec/Rec/F1)  | [`services/Evaluator.js`](server/src/services/Evaluator.js) — walk-forward backtest |
| `PredictionService`                      | [`services/PredictionService.js`](server/src/services/PredictionService.js) — orchestrates the §3.8 workflow |
| Weekend & holiday alignment (§3.4.2)     | `alignNewsToTradingDays()` in `Preprocessor.js` |
| User Interface / Output module           | React app in [`client/`](client/) |

---

## Architecture

```
                 ┌─────────────────────────── React + Vite (client) ───────────────────────────┐
                 │  StockPicker → PredictionCard · PriceChart · Technical/Fundamental panels    │
                 │               · NewsList · EvaluationPanel                                    │
                 └───────────────────────────────────┬──────────────────────────────────────────┘
                                                      │  /api  (vite proxy → :4000)
                 ┌────────────────────────────────────▼─────────────────────────────────────────┐
                 │                          Express API (server)                                  │
                 │                                                                                │
   AFX (NGX) ◀── DataCollector ──▶ Preprocessor ──▶ TechnicalIndicatorEngine ──▶ TechnicalModel ─┐│
                      │                                                                          ▼│
 Google News RSS ◀────┘                          LLMFundamentalAnalyzer (Claude / heuristic) ─▶ FusionModel
                                                                                                 ││
                                                              Evaluator (backtest) ◀─────────────┘│
                                                                                                  ▼
                                                                      PredictionService → JSON result
```

### Data sources (all live)
- **Market / price data** → [AFX (kwayisi)](https://afx.kwayisi.org/ngx/): the full NGX equities
  list + per-ticker daily Close/Volume history. Each fetch is merged into a local JSON
  **history store** (`server/data/history.json`) so the time series **deepens automatically over
  time** — this directly improves indicator quality, model confidence, and backtest depth.
- **News / fundamentals** → **Google News RSS**, queried per company (dated, sourced headlines).
- **LLM** → **Anthropic Claude** at temperature 0 for deterministic JSON extraction
  (sentiment ∈ [−1,1], significance ∈ [0,1], Macro/Earnings/Regulatory flags, risk flags).

---

## Quick start

### 1. Install
```bash
npm run install:all      # installs root, server, and client deps
```

### 2. Configure (optional but recommended)
```bash
cp server/.env.example server/.env
# edit server/.env and set ANTHROPIC_API_KEY=sk-ant-...
```
Without a key the app **still works** — it falls back to a deterministic finance-lexicon
sentiment analyzer (the header shows "Heuristic mode" vs "LLM analysis").

### 3. Run
```bash
npm run dev              # starts API (:4000) + client (:5173) together
```
Open **http://localhost:5173**.

> Requires **Node 18+**. (The app uses Node's built-in `fetch` and avoids dependencies that
> need Node 20, so it runs on 18.x.)

---

## API

| Method | Endpoint                       | Description |
| ------ | ------------------------------ | ----------- |
| GET    | `/api/health`                  | status + whether LLM or heuristic mode is active |
| GET    | `/api/stocks?q=`               | full NGX equities list (filterable) |
| GET    | `/api/stocks/:ticker`          | quote + price history + computed indicators |
| GET    | `/api/stocks/:ticker/news`     | recent company news headlines |
| POST   | `/api/predict` `{ ticker }`    | **full hybrid prediction** (recommendation, technical, fundamental, fusion, evaluation, explanation) |
| GET    | `/api/predict/:ticker`         | convenience GET form |

---

## Note on the "LSTM" (important & honest)

The methodology specifies a Python LSTM. This build is a **single Node.js stack** (per the chosen
architecture), and — more importantly — **free, deep historical NGX daily data is not reliably
available**: AFX exposes ~10 recent days per stock, and other sources (Stooq, etc.) are now gated
behind anti-bot challenges. Training an LSTM on ~10 close-only points would overfit and mislead.

So the technical predictor is a **transparent, adaptive indicator-scoring model**: it scales its
indicator windows to the available history and outputs `P_tech` (probability of an up move) plus a
confidence that **honestly reflects data depth** — low history ⇒ low confidence. It exposes the
exact same `probUp`/`confidence` interface an LSTM would, so it can be swapped for a TensorFlow.js
LSTM later (without touching the fusion layer) once the history store has accumulated enough bars.

---

## Disclaimer
StockOracle is an **educational decision-support tool, not financial advice**. Predictions are
probabilistic and derived from public NGX price data and news sentiment. Always do your own
research before trading.

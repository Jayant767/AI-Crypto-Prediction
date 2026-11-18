const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const emaSeries = (values, period) => {
  const out = Array(values.length).fill(null);
  if (values.length < period) return out;
  let prev = mean(values.slice(0, period)); out[period - 1] = prev;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) { prev = values[i] * k + prev * (1 - k); out[i] = prev; }
  return out;
};
const rsiSeries = (values, period = 14) => {
  const out = Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) { const d = values[i] - values[i - 1]; gains += Math.max(d, 0); losses += Math.max(-d, 0); }
  let avgGain = gains / period, avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1]; avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period; avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
};

export function makeFeatures(candles) {
  const close = candles.map(c => c.close), volume = candles.map(c => c.volume), high = candles.map(c => c.high), low = candles.map(c => c.low);
  const ema20 = emaSeries(close, 20), ema50 = emaSeries(close, 50), ema12 = emaSeries(close, 12), ema26 = emaSeries(close, 26);
  const macdLine = close.map((_, i) => ema12[i] == null || ema26[i] == null ? null : ema12[i] - ema26[i]);
  const macdSignal = emaSeries(macdLine.map(v => v ?? 0), 9);
  const rsi = rsiSeries(close, 14);
  const rows = [];
  for (let i = 50; i < candles.length; i++) {
    const slice = close.slice(i - 19, i + 1), avg = mean(slice), variance = mean(slice.map(v => (v - avg) ** 2)), sd = Math.sqrt(variance);
    const returns = (n) => (close[i] / close[i - n] - 1) * 100;
    const avgVol = mean(volume.slice(i - 19, i + 1));
    const tr = i === 0 ? high[i] - low[i] : Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]));
    const atrSlice = [];
    for (let j = i - 13; j <= i; j++) atrSlice.push(Math.max(high[j] - low[j], Math.abs(high[j] - close[j - 1]), Math.abs(low[j] - close[j - 1])));
    const f = {
      return_1h: returns(1), return_6h: returns(6), return_24h: returns(24), return_48h: returns(48),
      rsi_14: rsi[i], ema20_gap: (close[i] / ema20[i] - 1) * 100, ema50_gap: (close[i] / ema50[i] - 1) * 100,
      macd_pct: (macdLine[i] / close[i]) * 100, macd_hist_pct: ((macdLine[i] - macdSignal[i]) / close[i]) * 100,
      bb_position: sd === 0 ? 0 : (close[i] - (avg - 2 * sd)) / (4 * sd),
      volatility_20h: Math.sqrt(mean(close.slice(i - 19, i + 1).slice(1).map((v, k) => ((v / close[i - 19 + k]) - 1) ** 2))) * 100,
      volume_ratio: avgVol === 0 ? 1 : volume[i] / avgVol,
      atr_pct: (mean(atrSlice) / close[i]) * 100,
      candle_body_pct: ((close[i] - candles[i].open) / candles[i].open) * 100,
      range_pct: ((high[i] - low[i]) / close[i]) * 100,
      hour_sin: Math.sin(2 * Math.PI * new Date(candles[i].time).getUTCHours() / 24),
      hour_cos: Math.cos(2 * Math.PI * new Date(candles[i].time).getUTCHours() / 24),
    };
    if (Object.values(f).every(Number.isFinite)) rows.push({ index: i, time: candles[i].time, close: close[i], features: f, target: i + 24 < close.length ? close[i + 24] / close[i] - 1 : null });
  }
  return rows;
}

export function latestIndicators(candles) {
  const rows = makeFeatures(candles);
  if (!rows.length) return {};
  const f = rows.at(-1).features;
  return { rsi: f.rsi_14, macd: f.macd_pct, ema20: candles.at(-1).close / (1 + f.ema20_gap / 100), ema50: candles.at(-1).close / (1 + f.ema50_gap / 100), atr_pct: f.atr_pct, bollinger_position: f.bb_position };
}

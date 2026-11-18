import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeFeatures } from './indicators.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../models');
const FEATURES = ['return_1h','return_6h','return_24h','return_48h','rsi_14','ema20_gap','ema50_gap','macd_pct','macd_hist_pct','bb_position','volatility_20h','volume_ratio','atr_pct','candle_body_pct','range_pct','hour_sin','hour_cos'];
const avg = a => a.reduce((s,v)=>s+v,0)/a.length;
const predictOne = (model, x) => model.base + model.trees.reduce((sum,t)=>sum + model.learningRate * (x[t.feature] <= t.threshold ? t.left : t.right), 0);
function fitBoostedStumps(rows, rounds = 120, learningRate = 0.04) {
  const base = avg(rows.map(r=>r.target));
  const residuals = rows.map(r=>r.target-base), trees=[];
  for (let round=0; round<rounds; round++) {
    let best=null, bestLoss=Infinity;
    for (const feature of FEATURES) {
      const sorted = rows.map(r=>r.features[feature]).sort((a,b)=>a-b);
      const thresholds = [0.2,0.35,0.5,0.65,0.8].map(q=>sorted[Math.floor((sorted.length-1)*q)]);
      for (const threshold of thresholds) {
        const left=[], right=[];
        rows.forEach((r,i)=>(r.features[feature] <= threshold ? left : right).push(residuals[i]));
        if (left.length < 12 || right.length < 12) continue;
        const lv=avg(left), rv=avg(right);
        const loss=left.reduce((s,v)=>s+(v-lv)**2,0)+right.reduce((s,v)=>s+(v-rv)**2,0);
        if (loss < bestLoss) { bestLoss=loss; best={feature,threshold,left:lv,right:rv}; }
      }
    }
    if (!best) break;
    trees.push(best);
    rows.forEach((r,i)=>{ residuals[i] -= learningRate * (r.features[best.feature] <= best.threshold ? best.left : best.right); });
  }
  return { base, trees, learningRate, features: FEATURES, trainedAt: new Date().toISOString() };
}
function metrics(actual, predicted) {
  const errors=actual.map((v,i)=>v-predicted[i]);
  return { mae_return: avg(errors.map(Math.abs)), rmse_return: Math.sqrt(avg(errors.map(v=>v*v))), directional_accuracy: actual.filter((v,i)=>Math.sign(v)===Math.sign(predicted[i])).length/actual.length, test_samples: actual.length };
}
const fileFor = symbol => path.join(ROOT, `${symbol.replace('/','_')}.json`);
export async function trainModel(candles, symbol) {
  const rows=makeFeatures(candles).filter(r=>r.target!=null);
  if(rows.length<300) throw new Error(`Need at least 300 usable hourly samples; found ${rows.length}. Fetch more candles or try again later.`);
  const split=Math.floor(rows.length*0.8), train=rows.slice(0,Math.max(1,split-24)), test=rows.slice(split);
  if(test.length<30) throw new Error('Not enough holdout samples for validation.');
  const model=fitBoostedStumps(train);
  const actual=test.map(r=>r.target), predicted=test.map(r=>predictOne(model,r.features));
  const validation=metrics(actual,predicted);
  const residuals=actual.map((v,i)=>v-predicted[i]).sort((a,b)=>a-b);
  const q=(p)=>residuals[Math.min(residuals.length-1,Math.floor((residuals.length-1)*p))];
  model.metrics=validation; model.residualBand={low:q(0.05),high:q(0.95)}; model.trainingRows=train.length;
  await fs.mkdir(ROOT,{recursive:true}); await fs.writeFile(fileFor(symbol),JSON.stringify(model,null,2));
  return validation;
}
export async function predict(candles,symbol) {
  let model; try { model=JSON.parse(await fs.readFile(fileFor(symbol),'utf8')); } catch { throw new Error(`No trained model for ${symbol}. Select Train model & predict first.`); }
  const row=makeFeatures(candles).at(-1); if(!row) throw new Error('Insufficient recent candles to calculate indicators.');
  const predictedReturn=predictOne(model,row.features), current=row.close;
  const low=current*(1+predictedReturn+model.residualBand.low), high=current*(1+predictedReturn+model.residualBand.high);
  return {symbol,as_of:new Date(row.time).toISOString(),current_price:current,predicted_return_pct:predictedReturn*100,predicted_price:current*(1+predictedReturn),range_low:Math.min(low,high),range_high:Math.max(low,high),direction:predictedReturn>0.002?'bullish':predictedReturn< -0.002?'bearish':'neutral',holdout_metrics:model.metrics,model_name:'JavaScript Gradient-Boosted Stumps',interval_note:'Empirical 5th–95th percentile holdout residual band. This is not a probability guarantee.',trained_at:model.trainedAt};
}
export async function getPerformance() {
  await fs.mkdir(ROOT,{recursive:true}); const files=(await fs.readdir(ROOT)).filter(f=>f.endsWith('.json'));
  const models=[]; for(const f of files){try{const m=JSON.parse(await fs.readFile(path.join(ROOT,f),'utf8'));models.push({symbol:f.replace('.json','').replace('_','/'),trained_at:m.trainedAt,metrics:m.metrics,training_rows:m.trainingRows});}catch{}}
  return {models};
}

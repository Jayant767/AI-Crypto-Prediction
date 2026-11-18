import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fetchMarkets, fetchTicker, fetchCandles, isValidSymbol } from './market.js';
import { trainModel, predict, getPerformance } from './model.js';
import { latestIndicators } from './indicators.js';

const app=express();
const PORT=Number(process.env.PORT||8000);
app.use(cors({origin:process.env.CLIENT_ORIGIN?.split(',')||true}));
app.use(express.json());
app.get('/health',(_req,res)=>res.json({status:'ok',service:'CryptoAI Predictor JavaScript API',time:new Date().toISOString()}));
app.get('/api/markets',async(_req,res)=>{try{res.json({markets:await fetchMarkets()});}catch(e){res.status(502).json({detail:`Market data unavailable: ${e.message}`});}});
app.get('/api/market/:symbol',async(req,res)=>{const symbol=req.params.symbol.replace('-', '/').toUpperCase();if(!isValidSymbol(symbol))return res.status(400).json({detail:'Invalid symbol. Use a pair such as BTC/USDT.'});try{const [ticker,candles]=await Promise.all([fetchTicker(symbol),fetchCandles(symbol)]);res.json({ticker,candles,indicators:latestIndicators(candles)});}catch(e){res.status(502).json({detail:e.message});}});
app.post('/api/train/:symbol',async(req,res)=>{const symbol=req.params.symbol.replace('-', '/').toUpperCase();if(!isValidSymbol(symbol))return res.status(400).json({detail:'Invalid symbol.'});try{const candles=await fetchCandles(symbol,1000);const metrics=await trainModel(candles,symbol);res.json({symbol,metrics,message:'Model trained and validated successfully.'});}catch(e){res.status(400).json({detail:e.message});}});
app.get('/api/predict/:symbol',async(req,res)=>{const symbol=req.params.symbol.replace('-', '/').toUpperCase();if(!isValidSymbol(symbol))return res.status(400).json({detail:'Invalid symbol.'});try{const candles=await fetchCandles(symbol,1000);res.json(await predict(candles,symbol));}catch(e){res.status(404).json({detail:e.message});}});
app.get('/api/performance',async(_req,res)=>{try{res.json(await getPerformance());}catch(e){res.status(500).json({detail:e.message});}});
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({detail:'Unexpected server error.'});});
app.listen(PORT,()=>console.log(`CryptoAI API listening at http://localhost:${PORT}`));

import ccxt from 'ccxt';
const exchange = new ccxt.binance({ enableRateLimit: true, timeout: 20000 });
const DEFAULTS = ['BTC/USDT','ETH/USDT','BNB/USDT','SOL/USDT','XRP/USDT','ADA/USDT','DOGE/USDT','AVAX/USDT','LINK/USDT','TRX/USDT','DOT/USDT','LTC/USDT','BCH/USDT','NEAR/USDT','APT/USDT','ATOM/USDT','ETC/USDT','FIL/USDT','ARB/USDT','OP/USDT'];
const names = {BTC:'Bitcoin',ETH:'Ethereum',BNB:'BNB',SOL:'Solana',XRP:'XRP',ADA:'Cardano',DOGE:'Dogecoin',AVAX:'Avalanche',LINK:'Chainlink',TRX:'TRON',DOT:'Polkadot',LTC:'Litecoin',BCH:'Bitcoin Cash',NEAR:'NEAR Protocol',APT:'Aptos',ATOM:'Cosmos',ETC:'Ethereum Classic',FIL:'Filecoin',ARB:'Arbitrum',OP:'Optimism'};
export async function fetchMarkets() {
  await exchange.loadMarkets();
  const available=DEFAULTS.filter(s=>exchange.markets[s]?.active!==false && exchange.markets[s]);
  let tickers={}; try { tickers=await exchange.fetchTickers(available); } catch { /* individual quote fallback below */ }
  return available.map(symbol=>{const t=tickers[symbol]||{};const ticker=symbol.split('/')[0];return {symbol,name:names[ticker]||ticker,ticker,last:t.last??null,change_pct:t.percentage??null,quote_volume:t.quoteVolume??null};});
}
export async function fetchTicker(symbol) {
  const t=await exchange.fetchTicker(symbol);
  return {symbol,last:t.last??null,change_pct:t.percentage??null,high:t.high??null,low:t.low??null,base_volume:t.baseVolume??null,quote_volume:t.quoteVolume??null};
}
export async function fetchCandles(symbol,limit=1000) {
  const safeLimit=Math.min(Math.max(Number(limit)||1000,100),1000);
  const rows=await exchange.fetchOHLCV(symbol,'1h',undefined,safeLimit);
  if(!rows?.length) throw new Error(`No hourly market data returned for ${symbol}.`);
  return rows.map(([time,open,high,low,close,volume])=>({time:Math.floor(time/1000),open,high,low,close,volume}));
}
export function isValidSymbol(symbol) { return /^[A-Z0-9]{2,20}\/USDT$/.test(symbol); }

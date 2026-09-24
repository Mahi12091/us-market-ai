const required = ['NEON_DATABASE_URL'];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is not configured.`);

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL);
const symbols = ["AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","AVGO","JPM","V","MA","LLY","WMT","XOM","COST","NFLX","AMD","ORCL","CRM","ADBE","CSCO","IBM","QCOM","INTC","UBER","PYPL","SHOP","PLTR","COIN","BRK.B","JNJ","PG","HD","UNH","BAC","KO","PEP","DIS","T","VZ","GOOG","GEV","ANET","SCCO","SNDK","VRT","HWM","CEG","WMB","PWR","MRSH","EPD","RSG","ET","TDG","LHX","NSC","TRV","APO","COR","APD","BKR","SRE","LNG","MPLX","CIEN","OKE","PCAR","AON","HLT","ROST","CI","FCX","NEM","WDC","DLR","SPG","RCL","KMI","EOG","ECL","CTAS","MNST","VLO","PSX","GM","CL","WBD","CVNA","DASH","HOOD","MSI","PH","GLW","MCK","WELL","MAR","HCA","MDLZ","SHW","DELL","CDNS","SNPS","FTNT","SNOW","NET","CRWD","PANW","NOW","INTU","ARM","SMCI","HPE","HPQ","MRVL","NXPI","ON","MCHP","ZS","DDOG","TEAM","WDAY","ADSK","FIS","FI","LIN","ETN","EMR","ITW","UPS","FDX","COP","CVX","SLB","OXY","MPC","NEE","DUK","SO","D","AEP","EQIX","AMT","PLD","O","TMO","DHR","ABT","MDT","SYK","BSX","GILD","VRTX","REGN","DXCM","HIMS","ZTS","HUM","CNC","RBLX","EA","TTWO","SPOT","CHTR","TMUS","PARA","NWSA","MCD","SBUX","NKE","LOW","TGT","TJX","LULU","ORLY","AZO","F","FSLR","BKNG","ABNB","YUM","TSM","ASML","NVO","MELI","UAL","DAL","VEEV","ROKU","DOCU","RIVN","LCID","CRSP","ZM","OKTA","MDB","GDDY","PINS","TROW","TFC"];
const marketProxies = [
  { symbol: 'SPY', company_name: 'SPDR S&P 500 ETF Trust' },
  { symbol: 'QQQ', company_name: 'Invesco QQQ Trust' },
  { symbol: 'DIA', company_name: 'SPDR Dow Jones Industrial Average ETF Trust' },
  { symbol: 'IWM', company_name: 'iShares Russell 2000 ETF' },
];
const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const rows = [
  ...symbols.map((symbol) => ({ symbol, slug: slugify(symbol), company_name: symbol, is_active: true, is_indexable: true, country: 'US', currency: 'USD', asset_type: 'stock' })),
  ...marketProxies.map(({ symbol, company_name }) => ({ symbol, slug: slugify(symbol), company_name, is_active: true, is_indexable: false, country: 'US', currency: 'USD', asset_type: 'etf' })),
];

for (const row of rows) {
  await sql.query(
    `INSERT INTO stocks (symbol, slug, company_name, is_active, is_indexable, country, currency, asset_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT DO NOTHING`,
    [row.symbol, row.slug, row.company_name, row.is_active, row.is_indexable, row.country, row.currency, row.asset_type],
  );
}

console.log(`US stock universe seeded into Neon: ${symbols.length} stocks + ${marketProxies.length} market proxies.`);
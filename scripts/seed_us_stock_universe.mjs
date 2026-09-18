const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is not configured.`);

const symbols = ["AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","AVGO","JPM","V","MA","LLY","WMT","XOM","COST","NFLX","AMD","ORCL","CRM","ADBE","CSCO","IBM","QCOM","INTC","UBER","PYPL","SHOP","PLTR","COIN","BRK.B","JNJ","PG","HD","UNH","BAC","KO","PEP","DIS","T","VZ","GOOG","GEV","ANET","SCCO","SNDK","VRT","HWM","CEG","WMB","PWR","MRSH","EPD","RSG","ET","TDG","LHX","NSC","TRV","APO","COR","APD","BKR","SRE","LNG","MPLX","CIEN","OKE","PCAR","AON","HLT","ROST","CI","FCX","NEM","WDC","DLR","SPG","RCL","KMI","EOG","ECL","CTAS","MNST","VLO","PSX","GM","CL","WBD","CVNA","DASH","HOOD","MSI","PH","GLW","MCK","WELL","MAR","HCA","MDLZ","SHW","DELL","CDNS","SNPS","FTNT","SNOW","NET","CRWD","PANW","NOW","INTU","ARM","SMCI","HPE","HPQ","MRVL","NXPI","ON","MCHP","ZS","DDOG","TEAM","WDAY","ADSK","FIS","FI","LIN","ETN","EMR","ITW","UPS","FDX","COP","CVX","SLB","OXY","MPC","NEE","DUK","SO","D","AEP","EQIX","AMT","PLD","O","TMO","DHR","ABT","MDT","SYK","BSX","GILD","VRTX","REGN","DXCM","HIMS","ZTS","HUM","CNC","RBLX","EA","TTWO","SPOT","CHTR","TMUS","PARA","NWSA","MCD","SBUX","NKE","LOW","TGT","TJX","LULU","ORLY","AZO","F","FSLR","BKNG","ABNB","YUM","TSM","ASML","NVO","MELI","UAL","DAL","VEEV","ROKU","DOCU","RIVN","LCID","CRSP","ZM","OKTA","MDB","GDDY","PINS","TROW","TFC"];
const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const url = `${process.env.SUPABASE_URL}/rest/v1/stocks`;
const body = symbols.map((symbol) => ({ symbol, slug: slugify(symbol), company_name: symbol, is_active: true, is_indexable: true, country: 'US', currency: 'USD', asset_type: 'stock' }));

// Market benchmark ETFs used by the homepage and Market Overview.
// These are separate from the 200-stock universe and are not indexable stock pages.
const marketProxies = [
  { symbol: 'SPY', company_name: 'SPDR S&P 500 ETF Trust' },
  { symbol: 'QQQ', company_name: 'Invesco QQQ Trust' },
  { symbol: 'DIA', company_name: 'SPDR Dow Jones Industrial Average ETF Trust' },
  { symbol: 'IWM', company_name: 'iShares Russell 2000 ETF' },
].map(({ symbol, company_name }) => ({
  symbol,
  slug: slugify(symbol),
  company_name,
  is_active: true,
  is_indexable: false,
  country: 'US',
  currency: 'USD',
  asset_type: 'etf',
}));

const rows = [...body, ...marketProxies];

const response = await fetch(`${url}?on_conflict=symbol`, {
  method: 'POST',
  headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
  body: JSON.stringify(rows),
});
if (!response.ok) throw new Error(`Seed failed: ${response.status} ${await response.text()}`);
console.log(`US stock universe seeded: ${symbols.length} stocks + ${marketProxies.length} market proxies.`);
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://us-market-ai.vercel.app'),
  title: { default: 'US Market AI', template: '%s | US Market AI' },
  description: 'US stocks and crypto market intelligence, technical analysis and quantitative predictions.',
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-US"><body><header style={{borderBottom:'1px solid #1d3048',background:'rgba(7,17,31,.9)',position:'sticky',top:0,zIndex:10}}><div className="container" style={{height:64,display:'flex',alignItems:'center',justifyContent:'space-between'}}><a href="/" style={{fontWeight:800,fontSize:20}}>US Market <span style={{color:'#5eead4'}}>AI</span></a><nav style={{display:'flex',gap:20,fontSize:14}}><a href="/stocks">Stocks</a><a href="/crypto">Crypto</a><a href="/about">About</a></nav></div></header><main>{children}</main><footer className="container" style={{padding:'48px 0',fontSize:13}}><div className="muted">© {new Date().getFullYear()} US Market AI · Estimates only, not financial advice.</div></footer></body></html>;
}

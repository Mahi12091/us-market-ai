# US Market AI

A scalable US stocks + crypto market intelligence platform built with Next.js, TypeScript, Supabase and Vercel.

## Current foundation

- Database-driven `/stocks/[slug]` pages
- Supabase schema for quotes, history, technicals, fundamentals, earnings, news, predictions, results and AI articles
- SEO metadata, dynamic sitemap and robots
- Responsive financial dashboard UI
- Initial US stock seed data in Supabase
- Environment-variable based secrets

## Environment

Copy `.env.example` to `.env.local` for local development. Never commit real secrets.

## Run

```bash
npm install
npm run dev
npm run build
```

## Roadmap

1. Real US market-data provider adapter
2. Historical data ingestion and technical calculations
3. Quantitative prediction engine + evaluation pipeline
4. News/sentiment ingestion
5. AI article queue and cached analysis
6. Crypto-specific prediction pipeline
7. Admin/data-health dashboard
8. Scale from 50 → 500 → 2,000+ assets

Predictions are estimates and are not financial advice.

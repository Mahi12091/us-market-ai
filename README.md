# US Market AI

A scalable US stocks + crypto market intelligence platform built with **Next.js, TypeScript, Neon PostgreSQL and Vercel**.

## Current foundation

- Database-driven `/stocks/[slug]` research pages
- Neon PostgreSQL as the application database
- Neon-backed query adapter in `lib/neon.ts`
- Quotes, price history, technicals, fundamentals, earnings, news, predictions, prediction results and AI research tables
- SEO metadata, dynamic sitemap and robots
- Responsive financial dashboard UI
- Scalable US stock universe targeting 2,000+ assets
- Environment-variable based secrets
- GitHub Actions data-ingestion workflows using `NEON_DATABASE_URL`

## Database architecture

The project has been migrated from Supabase/PostgREST to **Neon PostgreSQL**. The application runtime connects directly to Neon through `@neondatabase/serverless`; there is no Supabase SDK dependency in `package.json`.

The historical `supabase/migrations` directory is retained as the project's SQL migration history so existing schema work is preserved. `scripts/migrate_neon.mjs` applies those migrations to Neon.

## Environment

Copy `.env.example` to `.env.local` for local development. Never commit real secrets.

Required database variable:

```env
NEON_DATABASE_URL=
```

## Run

```bash
npm install
npm run dev
npm run build
```

Before deployment, verify the production build with `npm run build` and confirm the Vercel environment contains `NEON_DATABASE_URL`.

## Data pipeline roadmap

1. Real US market-data provider adapter
2. Historical data ingestion and technical calculations
3. Quantitative prediction engine + evaluation pipeline
4. News/sentiment ingestion
5. AI article queue and cached analysis
6. Crypto-specific prediction pipeline
7. Admin/data-health dashboard
8. Scale from 50 → 500 → 2,000+ assets

Predictions are estimates and are not financial advice.

# US Market AI

A scalable US stocks + crypto market intelligence platform built with **Next.js, TypeScript, Neon PostgreSQL and Vercel**.

## Current foundation

- Database-driven `/stocks/[slug]` research pages
- **Neon PostgreSQL is the only application database**
- Direct Neon query adapter in `lib/neon.ts`
- Neon REST API bridge for batch data-provider scripts that need HTTP-style table operations
- Quotes, price history, technicals, fundamentals, earnings, news, predictions, prediction results and AI research tables
- SEO metadata, dynamic sitemap and robots
- Responsive financial dashboard UI
- Scalable US stock universe targeting 2,000+ assets
- Environment-variable based secrets
- GitHub Actions data-ingestion workflows using `NEON_DATABASE_URL`

## Database architecture

The project is fully migrated from Supabase to **Neon PostgreSQL**. Application pages use the direct Neon query adapter and data workflows use `NEON_DATABASE_URL` plus the local Neon REST API bridge where required. There is no Supabase SDK or Supabase runtime dependency.

Schema migrations now live under `neon/migrations/` and are applied by `scripts/migrate_neon.mjs`. The migration runner strips legacy RLS/policy statements so the database remains independent of Supabase roles.

## Environment

Copy `.env.example` to `.env.local` for local development. Never commit real secrets.

Required database variable:

```env
NEON_DATABASE_URL=
```

Batch workflow variables:

```env
NEON_REST_URL=http://127.0.0.1:8787
NEON_API_KEY=local
```

## Run

```bash
npm install
npm run dev
npm run build
```

Before deployment, verify the production build with `npm run build` and confirm the Vercel environment contains `NEON_DATABASE_URL`.

## Data pipeline

1. Neon schema and 2,000+ stock universe
2. Market-data ingestion and technical calculations
3. Quantitative prediction engine + evaluation pipeline
4. News/sentiment ingestion
5. Fundamental and statement ingestion from provider fallbacks
6. AI article and recurring research generation
7. Crypto-specific research pipeline

Predictions are estimates and are not financial advice.

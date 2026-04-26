# QuantDashboard — Architecture

> Last updated: 2026-04-22. Reflects the Next.js 16 App Router consolidation.

The original project was a MERN split (Vite + React client, separate Express server). It has been ported to a single Next.js 16 App Router codebase. This document describes the current architecture.

---

## High-level layout

```
┌──────────────────────────────────────────────────────────────────────┐
│                    QuantDashboard (Next.js 16)                       │
│                    single codebase, App Router                       │
└───────────────────────────────────┬──────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
  ┌──────────────────┐   ┌────────────────────┐  ┌──────────────────┐
  │   app/ (pages)   │   │   app/api/ (REST)  │  │   proxy.js       │
  │                  │   │                    │  │   (Edge layer)   │
  │  Server + Client │   │  Route Handlers    │  │                  │
  │  Components      │   │  (POST/GET/etc.)   │  │  • sec headers   │
  │                  │   │                    │  │  • CSRF check    │
  └────────┬─────────┘   └─────────┬──────────┘  └──────────────────┘
           │                       │
           │                       ▼
           │             ┌────────────────────────┐
           │             │  lib/ + services/      │
           │             │                        │
           │             │  • lib/mongodb.js      │
           │             │  • lib/auth.js         │
           │             │  • lib/metrics/*       │
           │             │  • services/snapTrade* │
           │             │  • services/massive*   │
           │             └───────────┬────────────┘
           │                         │
           └─────────┬───────────────┘
                     ▼
         ┌─────────────────────────┐
         │   models/ (Mongoose)    │
         │   connected via         │
         │   connectDB() singleton │
         └────────────┬────────────┘
                      ▼
         ┌─────────────────────────┐
         │   MongoDB Atlas          │
         └─────────────────────────┘
```

---

## Request lifecycle

Every request hits the Edge `proxy.js` first. `proxy.js` adds security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy) to all responses and enforces a CSRF check: any state-changing request (POST/PUT/PATCH/DELETE) to `/api/*` outside `/api/auth/*` must include an `X-Requested-With` header. Cross-origin form submissions cannot forge this header because browsers block cross-origin custom headers without a CORS preflight.

Request flow:

```
client fetch
  │  (apiClient.js adds X-Requested-With)
  ▼
proxy.js (Edge)
  │  security headers + CSRF 403 on fail
  ▼
app/api/<route>/route.js
  │  awaits connectDB(), then requireAuth() where needed
  ▼
lib/, services/, models/
  ▼
MongoDB
```

---

## API surface (REST route handlers)

All routes live under `app/api/`. Each handler exports an async `GET`/`POST`/`PATCH`/`DELETE` function.

```
Auth            /api/auth/register          POST
                /api/auth/login             POST
                /api/auth/logout            POST
                /api/auth/refresh           POST

User            /api/user/me                GET | PATCH
                /api/user/change-password   PATCH

Accounts        /api/accounts               GET
                /api/accounts/holdings      GET
                /api/accounts/sync          POST
                /api/accounts/dividends/by-month   GET

Connections     /api/connections            GET
                /api/connections/brokerages GET
                /api/connections/portal     POST
                /api/connections/exchange   POST
                /api/connections/refresh    POST
                /api/connections/[id]       DELETE

Metrics         /api/metrics/portfolio-value     GET
                /api/metrics/performance         GET
                /api/metrics/risk                GET
                /api/metrics/kpis                GET
                /api/metrics/timeseries          GET
                /api/metrics/calculate           POST
                /api/metrics/factor-exposures    GET (501 — planned)

Reference       /api/ticker-overview/[ticker]    GET
```

Auth is handled by `lib/auth.js`: JWT access tokens (15 min) + refresh tokens (7 days), both in httpOnly cookies. `requireAuth()` is called at the top of every protected route handler.

---

## Library code

```
lib/
  mongodb.js          singleton Mongoose connection (module-scoped cache)
  auth.js             JWT sign / verify, requireAuth() helper
  metrics/
    runMetricsPipeline.js   orchestrates the 5-step metrics build
    updateTable/            per-step modules (prices, valuation, returns, metrics, validate)
    helpers/                pure math: risk, risk-adjusted, returns, portfolio, diversification
    dateRanges.js           canonical period-to-range mapping
  prices/               flat-file ingest helpers (Massive S3)
  instrument-reference/ symbol metadata resolver (Massive overview)
```

```
services/
  snapTradeClient.js    SnapTrade SDK wrapper
  massiveClient.js      Massive flat-file + REST client
  userClient.js         user-facing SnapTrade orchestration
```

```
utils/
  fullSyncForUser.js    one entry point: sync SnapTrade data + run metrics pipeline
  syncAllUserData.js    SnapTrade data ingestion (accounts, holdings, activities, ...)
  apiClient.js          fetch wrapper: credentials, X-Requested-With, 401 → auto-refresh
```

---

## Metrics pipeline

`lib/metrics/runMetricsPipeline.js` runs five steps in order. Each step is idempotent and safe to re-run.

```
Step 1  updatePriceData        fetch / top-up PriceHistory for every holding symbol
Step 2  updateEquitiesWeights  walk activities chronologically, build daily position rows
Step 3  updatePortfolioTimeseries   weights × prices = daily valuation + simpleReturns + TWR
Step 4  calculateMetrics       read PortfolioTimeseries, compute Sharpe / Sortino / VaR / beta / etc.
Step 5  validateMetrics        sanity-check output (no NaN/Inf, values in reasonable ranges)
```

The risk-free rate flows through `FamaFrenchFactors` (populated by `services/famaFrenchService` from the Kenneth French Data Library). The benchmark is configurable via `BENCHMARK_SYMBOL` (default `SPY`) and sourced from `PriceHistory`.

---

## External data sources

```
┌──────────────────┐   brokerage connections, accounts, holdings,
│    SnapTrade     │   balances, positions, orders, activities, options
│    (partner API) │
└──────────────────┘

┌──────────────────┐   historical prices (daily OHLCV) via S3 flat-file feed,
│     Massive      │   plus REST top-ups for recent days and ticker overview metadata
└──────────────────┘

┌──────────────────┐   daily Fama-French factors (Mkt-RF, SMB, HML, RF).
│  Kenneth French  │   Canonical risk-free rate source for all risk-adjusted metrics.
│  Data Library    │
└──────────────────┘
```

---

## MongoDB collections

See `MODEL-SCHEMAS.md` for per-model field lists. At a glance:

```
Users                      auth + SnapTrade userSecret (AES-256-GCM encrypted)
Connection                 SnapTrade brokerage connections
AccountsList               accounts per user
AccountDetail              account metadata
AccountHoldings            current position snapshots
AccountPositions           position rows
AccountBalances            cash / equity / total balances
AccountOrders              order history
AccountActivities          trades, dividends, fees (source of truth for weight building)
Options                    option contract positions
PriceHistory               daily OHLCV per symbol
InstrumentReference        symbol metadata from Massive
TickerOverview             per-ticker overview cache
EquitiesWeightTimeseries   daily position weights (derived from activities)
PortfolioTimeseries        daily valuation + TWR + simpleReturns per account
Metrics                    per-period risk / return metrics (Sharpe, VaR, beta, ...)
FamaFrenchFactors          daily factor data (RF, Mkt-RF, SMB, HML)
```

---

## Frontend

```
app/
  layout.js               Server Component — wraps <Providers />
  providers.js            Client — UserContext, theme
  page.js                 Landing / marketing
  (auth)/login/           login form
  (auth)/register/        registration form
  dashboard/              KPIs + charts (Client — Chart.js needs DOM)
  portfolio/              holdings table
  portfolio/[id]/         per-account detail
  asset-allocation/
  dividends/
  stock-info/
  settings/
  connections/
```

Server Components are the default. `"use client"` is only added where the component needs React state, hooks, event handlers, or browser APIs (charts, forms, tabs, context consumers). Shared UI lives under `components/`.

---

## What's explicitly _not_ in the Next.js port

- **Separate backend process.** There is no Express server; API routes live alongside pages.
- **External cron scheduler.** No `job.js` / node-cron. The metrics pipeline runs on demand via `/api/metrics/calculate` (which the dashboard's Refresh button calls) and as part of `fullSyncForUser` after brokerage sync. A nightly `jobs/dailyPriceIngest` process is planned post-submission.
- **Yahoo Finance and Alpha Vantage dependencies.** Both removed. Prices come from Massive (flat-file S3 + REST top-up). Benchmark prices live in `PriceHistory` like any other symbol.
- **Unauthenticated proxy routes.** The old `/api/alphavantage` and `/api/massive` passthroughs are gone.

---

## Planned (post-submission)

- `jobs/dailyPriceIngest` — nightly ingest of the full Massive feed so user refresh becomes pure Mongo read + math.
- `/api/metrics/factor-exposures` — currently 501. Implementation plan: Fama-French 3-factor regression of portfolio returns vs stored `FamaFrenchFactors`. Matches capstone stretch goal 2.13.
- Correlation matrix and return attribution.
- Async refresh UX (job model + polling endpoint) so the Refresh button reflects progress rather than blocking.

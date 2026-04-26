# QuantDashboard — Data Flows & Workflows

> Last updated: 2026-04-22. Ported to Next.js 16 App Router.
>
> The business-logic flows below are unchanged from the MERN version. The differences you'll notice in this port:
> - Routes are Next.js App Router route handlers under `app/api/*`, not Express routes. Sign-up is `POST /api/auth/register` (not `/api/auth/signup`).
> - Price data comes from **Massive** (S3 flat-file feed + REST top-up), not Yahoo Finance or Alpha Vantage.
> - There is no standalone `job.js` cron — the metrics pipeline runs on demand (Refresh button → `/api/metrics/calculate`) and after brokerage sync. A nightly `jobs/dailyPriceIngest` is planned post-submission.
> - The architectural violations called out at the end of §6 (live-API calls from GETs, unauth'd proxy routes) were **not ported**. The 501 factor-exposures endpoint is still a planned item.
> - All state-changing `/api/*` requests (except `/api/auth/*`) must include `X-Requested-With` or are rejected 403 by `proxy.js` (Edge middleware). `utils/apiClient.js` handles this automatically.


## 1. New User Registration

```
┌──────────┐     POST /api/auth/register    ┌──────────────────────┐
│  Client  │ ──────────────────────────────▶ │ app/api/auth/register │
│          │                                 │   /route.js           │
│          │ ◀────────────────────────────── │                       │
│          │     sets jwt + refreshToken     │  • bcrypt hash        │
│          │     httpOnly cookies            │  • create User        │
│          │     returns { user }            │  • issue JWT pair     │
└──────────┘                                 └──────────┬────────────┘
                                                        │
                                                        ▼
                                             ┌──────────────┐
                                             │   MongoDB     │
                                             │               │
                                             │  Users        │
                                             └──────────────┘

  Dashboard is empty — no brokerage data, no metrics.
  Next step: connect a brokerage via SnapTrade.
```


## 2. Brokerage Connection (First-Time Setup)

```
┌──────────┐  POST /api/connections/portal         ┌────────────────────────┐
│  Client  │ ────────────────────────────────────▶  │ app/api/connections/   │
│          │  ◀────────────────────────────────────  │   portal/route.js      │
│          │  { redirectUrl }                        │  calls SnapTrade SDK   │
│          │                                         │  → OAuth portal URL    │
│          │                                         └────────────────────────┘
│          │
│          │  ── user authorizes in SnapTrade portal ──
│          │
│          │  POST /api/connections/exchange         ┌────────────────────────┐
│          │ ────────────────────────────────────────▶│ app/api/connections/   │
│          │                                          │   exchange/route.js    │
│          │                                          │                        │
│          │                                          │  exchange auth code    │
│          │                                          │  persist Connection    │
│          │                                          └──────────┬─────────────┘
│          │                                                     │
│          │                                                     │ triggers
│          │                                                     ▼
│          │                                          ┌──────────────────────┐
│          │                                          │ fullSyncForUser()    │
│          │                                          │   fullSync = TRUE    │
│          │                                          │   (full history)     │
│          │                                          └──────────┬───────────┘
│          │                                                     │
│          │                                          (see Flow 5 below)
└──────────┘
```


## 3. Scheduled / background sync

Not ported in the current submission. The MERN version ran `job.js` on a 2x daily cron (10:00 / 16:00) that iterated every user with a SnapTrade `userSecret` and called `fullSyncForUser(user, fullSync=false)`. In the Next.js port, syncs are triggered on demand (Flow 4) and right after brokerage connection (Flow 2).

Planned post-submission: `jobs/dailyPriceIngest` to pull the full Massive flat-file nightly so the user's Refresh button becomes pure Mongo read + math, plus an external scheduler (Vercel Cron / Render background worker) for per-user incremental syncs.


## 4. Manual Sync (Refresh Button)

```
┌──────────┐  POST /api/connections/refresh    ┌──────────────────────┐
│  Client  │ ─────────────────────────────────▶ │ app/api/connections/ │
│          │    (brokerage sync)                │   refresh/route.js   │
│          │                                    └──────────┬───────────┘
│          │                                               │
│          │                                               ▼
│          │                                    ┌──────────────────┐
│          │                                    │ syncAllUserData()│
│          │                                    │ (SnapTrade pull) │
│          │                                    └──────────────────┘
│          │
│          │  POST /api/metrics/calculate       ┌──────────────────────┐
│          │ ─────────────────────────────────▶ │ app/api/metrics/     │
│          │    (metrics rebuild)               │   calculate/route.js │
│          │                                    └──────────┬───────────┘
│          │                                               │ calls
│          │                                               ▼
│          │                                    ┌──────────────────┐
│          │                                    │ fullSyncForUser()│
│          │                                    │  fullSync = FALSE│
│          │                                    │  (incremental)   │
│          │                                    └────────┬─────────┘
│          │                                             │
└──────────┘                                    (see Flow 5 below)
```

Note: `RefreshButton.jsx` issues both requests; a future pass will parallelize them and add job-style progress reporting.


## 5. fullSyncForUser() — The Master Pipeline

```
fullSyncForUser(user, fullSync)
│
│   fullSync=true  → date range: account creation ──▶ today
│   fullSync=false → date range: last DB entry ──▶ today
│
├── PHASE 1: Source Data Sync ─────────────────────────────────────
│
│   syncAllUserData()
│   │
│   ├── updateAccountsForUser()
│   │     │
│   │     │  SnapTrade SDK                          MongoDB
│   │     │  ─────────────                          ──────────────
│   │     ├─ listAccounts() ──────────────────────▶ AccountsList
│   │     └─ getAccountDetail() ──────────────────▶ AccountDetail
│   │
│   └── updateAccountHoldingsForUser()  (per account)
│         │
│         │  SnapTrade SDK                          MongoDB
│         │  ─────────────                          ──────────────
│         ├─ listPositions() ─────────────────────▶ AccountHoldings
│         │                  ─────────────────────▶ AccountPositions
│         ├─ listBalances() ──────────────────────▶ AccountBalances
│         ├─ listOrders() ────────────────────────▶ AccountOrders
│         ├─ listActivities() ────────────────────▶ AccountActivities
│         └─ listOptionPositions() ───────────────▶ Options
│
│         All writes use upsertWithDuplicateCheck()
│
│
├── PHASE 2: Metrics Pipeline ─────────────────────────────────────
│
│   runMetricsPipeline()
│   │
│   │  STEP 1                           STEP 2
│   │  ┌─────────────────────┐          ┌───────────────────────────┐
│   ├─▶│ updateActivities    │────────▶ │ updateEquitiesWeightTable │
│   │  │ Table                │          │                           │
│   │  │                     │          │ walks activities chrono-   │
│   │  │ fetch activities    │          │ logically, builds daily    │
│   │  │ from SnapTrade      │          │ position weights           │
│   │  └─────────────────────┘          └─────────────┬─────────────┘
│   │                                                  │
│   │  STEP 3                                          │
│   │  ┌─────────────────────┐                         │
│   ├─▶│ updatePriceData     │◀────────────────────────┘
│   │  │                     │
│   │  │ Massive flat-file   │  fetch historical prices
│   │  │ (S3) + REST top-up  │  for every ticker in holdings
│   │  │                     │
│   │  └─────────┬───────────┘
│   │            │
│   │  STEP 4   │
│   │  ┌────────▼────────────┐
│   ├─▶│ updatePortfolio-    │
│   │  │ Timeseries          │
│   │  │                     │       ┌──────────────────────────┐
│   │  │ weights × prices    │──────▶│ PortfolioTimeseries      │
│   │  │ = daily valuation,  │       │ { date, totalValue,      │
│   │  │   totalValue,       │       │   simpleReturns,         │
│   │  │   simpleReturns     │       │   cumulativeReturns }    │
│   │  └─────────────────────┘       └──────────────────────────┘
│   │
│   │  STEP 5
│   │  ┌─────────────────────┐
│   ├─▶│ calculateMetrics    │
│   │  │                     │
│   │  │ reads Portfolio-    │       ┌──────────────────────────┐
│   │  │ Timeseries returns  │──────▶│ Metrics                  │
│   │  │                     │       │ { date, period, sharpe,  │
│   │  │ calls helpers/:     │       │   sortino, vol, VaR,     │
│   │  │  riskMetrics        │       │   CVaR, maxDrawdown,     │
│   │  │  riskAdjustedMetrics│       │   beta, alpha* }         │
│   │  │  returnsMetrics     │       └──────────────────────────┘
│   │  │  portfolioSnapshot  │
│   │  │                     │       * alpha currently null
│   │  │ + fetchBenchmark-   │
│   │  │   Returns()         │◀── PriceHistory (BENCHMARK_SYMBOL row)
│   │  │ + famaFrenchService │◀── Kenneth French (risk-free rate)
│   │  └─────────────────────┘
│   │
│   │  STEP 6
│   │  ┌─────────────────────┐
│   └─▶│ validateMetrics     │
│      │                     │
│      │ sanity-check:       │
│      │  NaN? Inf? nulls?   │
│      │  reasonable ranges? │
│      └─────────────────────┘
│
└── DONE
```


## 6. Dashboard Reads (GET Endpoints)

```
┌──────────┐                                    ┌──────────────────────────┐
│  Client  │                                    │      MongoDB             │
│          │                                    │                          │
│          │  GET /metrics/performance          │                          │
│          │ ──────────────────────────────────▶│  Metrics                 │
│          │  ◀── sharpe, sortino, returns ──── │  findOne({$lte, period}) │
│          │                                    │                          │
│          │  GET /metrics/risk                 │                          │
│          │ ──────────────────────────────────▶│  Metrics                 │
│          │  ◀── vol, VaR, CVaR, drawdown ─── │  findOne({$lte, period}) │
│          │                                    │                          │
│          │  GET /metrics/kpis                 │                          │
│          │ ──────────────────────────────────▶│  Metrics                 │
│          │  ◀── combined KPI snapshot ─────── │  (or fallback via        │
│          │                                    │   canonical helpers)     │
│          │                                    │                          │
│          │  GET /metrics/portfolio-value      │                          │
│          │ ──────────────────────────────────▶│  PortfolioTimeseries     │
│          │  ◀── timeseries + TWR ──────────── │  .find().sort({date: 1}) │
│          │                                    │                          │
│          │  GET /metrics/timeseries           │                          │
│          │ ──────────────────────────────────▶│  PortfolioTimeseries     │
│          │  ◀── returns, vol over time ────── │  .find().sort({date: 1}) │
│          │                                    │                          │
│          │  GET /accounts/holdings            │                          │
│          │ ──────────────────────────────────▶│  AccountHoldings         │
│          │  ◀── current positions ──────────  │                          │
│          │                                    │                          │
│          │  GET /accounts/activities          │                          │
│          │ ──────────────────────────────────▶│  AccountActivities       │
│          │  ◀── buys, sells, dividends ─────  │                          │
│          │                                    │                          │
│          │  GET /api/metrics/factor-exposures │                          │
│          │ ──────────────────────────────────▶│  → immediate 501         │
│          │  ◀── not implemented ──────────── │  (planned, stretch 2.13) │
└──────────┘                                    └──────────────────────────┘

  Notes on the Next.js port:
  • `GET /accounts/balances` (live SnapTrade call) was NOT ported.
    Balance info comes off cached `PortfolioTimeseries` rows instead.
  • The old `/api/alphavantage` and `/api/massive` passthrough routes
    were NOT ported. Market data access goes through server-side
    `services/massiveClient.js` (no client-exposed proxy).
  • `GET /api/metrics/factor-exposures` remains the only 501. Everything
    else under `/api/metrics/*` is implemented.
```


## 7. Collection Ownership Summary (Next.js port)

```
COLLECTION              WRITTEN BY                  READ BY
─────────────────────── ─────────────────────────── ──────────────────────────────
Users                   POST /api/auth/register      requireAuth() in every
                        PATCH /api/user/me           protected route

FamaFrenchFactors       famaFrenchService            calculateMetrics (RF)
                        (Kenneth French download)

AccountsList            syncAllUserData (SnapTrade)  GET /api/accounts
AccountDetail           syncAllUserData (SnapTrade)  (no client endpoint)
AccountHoldings         syncAllUserData (SnapTrade)  GET /api/accounts/holdings
AccountPositions        syncAllUserData (SnapTrade)  (read via metrics pipeline)
AccountBalances         syncAllUserData (SnapTrade)  (read via metrics pipeline)
AccountOrders           syncAllUserData (SnapTrade)  (no client endpoint)
AccountActivities       syncAllUserData (SnapTrade)  GET /api/accounts/dividends/by-month
                                                     (metrics pipeline, weight step)
Options                 syncAllUserData (SnapTrade)  (no client endpoint)

InstrumentReference     lib/instrument-reference/    lib/metrics/updatePriceData
                        (Massive overview resolver)  (symbol → Massive ticker lookup)

TickerOverview          lib/instrument-reference/    GET /api/ticker-overview/[ticker]

PriceHistory            lib/prices/ (Massive feed)   calculateMetrics
                                                     updatePortfolioTimeseries

EquitiesWeightTimeseries  updateEquitiesWeightTable  updatePortfolioTimeseries

PortfolioTimeseries     updatePortfolioTimeseries    GET /api/metrics/portfolio-value
                        (pipeline step 3)            GET /api/metrics/timeseries
                                                     GET /api/metrics/performance
                                                     GET /api/metrics/risk
                                                     GET /api/metrics/kpis

Metrics                 calculateMetrics             GET /api/metrics/performance
                        (pipeline step 4)            GET /api/metrics/risk
                                                     GET /api/metrics/kpis

Connection              syncAllUserData              GET /api/connections
                        exchange route               DELETE /api/connections/[id]
```


## 8. External API Dependency Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        SnapTrade API                            │
│                                                                 │
│  Used by:                                                       │
│  ├─ syncAllUserData()        → accounts, holdings, balances,    │
│  │                             positions, orders, activities,   │
│  │                             options                          │
│  ├─ updateActivitiesTable()  → activities (pipeline step 1)     │
│  ├─ GET /accounts/balances   → live balance call (⚠ violation)  │
│  └─ connections controller   → OAuth portal, exchange, refresh  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                           Massive                               │
│                                                                 │
│  Used by:                                                       │
│  ├─ lib/prices/            → daily OHLCV flat files (S3)        │
│  │                           + REST top-ups for recent bars     │
│  ├─ updatePriceData()      → fills PriceHistory per symbol      │
│  │                           (pipeline step 1)                  │
│  └─ lib/instrument-        → symbol metadata + overview         │
│     reference/               (populates InstrumentReference     │
│                              and TickerOverview)                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                Kenneth French Data Library                       │
│                                                                 │
│  Used by:                                                       │
│  └─ famaFrenchService        → daily factor data (Mkt-RF, SMB, │
│                                 HML, RF). Canonical risk-free   │
│                                 rate source for all Sharpe/     │
│                                 Sortino calculations.           │
└─────────────────────────────────────────────────────────────────┘

(Yahoo Finance and Alpha Vantage dependencies were removed in the Next.js
port. Benchmark returns now come from PriceHistory rows for BENCHMARK_SYMBOL.)
```

---

*Document generated from codebase exploration. Update this file when flows or entry points change.*

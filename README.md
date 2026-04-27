# QuantDashboard

A portfolio analytics dashboard built with Next.js 16 App Router. Track performance, analyze risk, and understand your investments with real brokerage data.

**Live demo:** https://quantdashboard-sigma.vercel.app

**Demo credentials:** _will be added with the live URL. A throwaway account with sample brokerage data will be available so graders don't need to register._

## Features

- **Portfolio Overview** — View all holdings, positions, and account balances synced from your brokerage
- **Performance Analytics** — CAGR, Sharpe Ratio, Sortino Ratio, Max Drawdown, Omega, Calmar
- **Risk Metrics** — Annualized volatility, Beta (vs configurable benchmark), Value at Risk (95%), Conditional VaR, diversification (HHI)
- **Asset Allocation** — Visualize portfolio composition with interactive charts
- **Dividends Tracking** — Monitor dividend income across holdings
- **Stock Info** — Per-ticker overview sourced from Massive reference data
- **Brokerage Sync** — Connect via SnapTrade (read-only) to pull live account data
- **Dark Theme** — Styled with CSS custom properties for a clean analytics UI

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: MongoDB (Mongoose ODM)
- **Auth**: JWT with httpOnly cookies (access + refresh tokens)
- **Brokerage API**: SnapTrade TypeScript SDK
- **Charts**: Chart.js + react-chartjs-2
- **Testing**: Jest + React Testing Library

## Prerequisites

- Node.js 18+
- MongoDB Atlas cluster (or local MongoDB instance)
- SnapTrade API credentials (for brokerage connections)

## Setup

1. Clone the repository and navigate to the project:

   ```bash
   cd quantDashBoard-nextjs
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.local.example` to `.env.local` and fill in the values:

   ```bash
   cp .env.local.example .env.local
   ```

   Minimum keys you need to set before the app will boot:

   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret                       # openssl rand -hex 32
   REFRESH_TOKEN_SECRET=your_refresh_secret         # openssl rand -hex 32
   USER_SECRET_ENCRYPTION_KEY=your_aes_key          # openssl rand -hex 32 (required in production)
   SNAPTRADE_CLIENT_ID=your_snaptrade_client_id
   SNAPTRADE_CONSUMER_KEY=your_snaptrade_consumer_key
   MASSIVE_API_KEY=your_massive_api_key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Running Tests

```bash
npm test
```

Tests cover auth helpers, API route handlers, middleware logic, UI components, and the price history pipeline coverage check.

### Price data smoke test

```bash
# REST API smoke test (requires MASSIVE_API_KEY)
npm run test:massive:script
```

## Price History Pipeline

The pipeline is coverage-driven: after brokerage sync, it checks what price data already exists in MongoDB, then fills gaps via the Massive REST API.

**How it works:**

1. **Coverage check** — For each symbol, queries `min(date)` and `max(date)` from PriceHistory.
2. **REST top-up** — Fetches only the missing dates via the Massive REST API.
3. **Merge** — All writes use `bulkWrite` with upserts on `(symbol, date)` for idempotency.

**`forceRefresh: true`** — Re-fetches the full date range via REST. Use when data is suspected stale or corrupt.

## Architecture

The app is a single Next.js 16 project — no separate Express server. The frontend and backend live together:

- **Pages** (`app/`) are React Server or Client Components depending on whether they need interactivity
- **API routes** (`app/api/`) replace the old Express server. Each route is a `route.js` file that handles HTTP methods directly
- **Edge middleware** (`proxy.js` at the project root) sets security headers and enforces a CSRF check: any state-changing `/api/*` request outside `/api/auth/*` must include an `X-Requested-With` header or gets a 403. Next.js 16 renamed `middleware.js` → `proxy.js`; behavior is the same.
- **Data flow**: Client component → `utils/apiClient.js` (adds `X-Requested-With`, auto-retries on 401 after refresh) → Next.js API route → MongoDB via Mongoose or SnapTrade / Massive SDKs
- **Auth**: JWTs are stored in httpOnly cookies (not localStorage), so JavaScript can't access them. The access token expires in 15 minutes; the refresh token lasts 7 days and is used to silently renew sessions.

See `docs/ARCHITECTURE.md` for the full diagram and `docs/FLOWS.md` for step-by-step data flows.

## Design Decisions

- **httpOnly cookies for auth**: Storing JWTs in localStorage makes them vulnerable to XSS. httpOnly cookies are inaccessible to JavaScript and are the right approach for a production app.
- **SnapTrade instead of direct brokerage APIs**: Each brokerage has a different OAuth flow, rate limits, and data format. SnapTrade normalizes all of this behind a single SDK, which meant I could focus on the analytics rather than brokerage integrations.
- **App Router over Pages Router**: App Router allows mixing Server and Client Components. Pages that don't need interactivity (like layouts) can stay on the server and avoid sending unnecessary JavaScript to the browser.

## Deployment

To deploy to Vercel:

1. Push the repository to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repository
3. Set the root directory to `quantDashBoard-nextjs`
4. Add all environment variables from `.env.local` in the Vercel project settings
5. Deploy — Vercel auto-detects Next.js and configures the build

**SnapTrade note:** Use SnapTrade sandbox credentials during development. Switch to production credentials before going live.

## Project Structure

```
app/
  (auth)/             # Login/register route group
  api/                # API route handlers (auth, accounts, metrics, etc.)
  dashboard/          # Main analytics dashboard
  portfolio/          # Holdings table with detail view
  asset-allocation/   # Allocation charts
  dividends/          # Dividend income
  stock-info/         # Company lookup
  settings/           # Account, connections, preferences
components/           # Reusable UI components (charts, navbar, forms)
lib/                  # Auth helpers, MongoDB connection
  metrics/            # Metrics pipeline (price data, valuation, calculations)
  prices/             # Price history pipeline (coverage check)
models/               # Mongoose schemas
services/             # SnapTrade + Massive REST client wrappers
hooks/                # Custom React hooks (useAuth)
context/              # UserContext provider
utils/                # API client with auto-refresh, Massive REST client
proxy.js              # Edge middleware: security headers + CSRF check
docs/                 # Technical specs + capstone deliverables
  ARCHITECTURE.md
  FLOWS.md
  MODEL-SCHEMAS.md
  FRONTEND-LAYOUT.pdf
  DATABASE-MODEL.pdf
  API-LAYOUT.pdf
__tests__/            # Unit, API, component, and integration tests
```

## Roadmap / Planned features

Items that are scoped but not shipped in the capstone submission. Numbers in brackets map to the capstone project rubric.

- **Factor exposures** — `GET /api/metrics/factor-exposures` currently returns 501. Planned implementation: Fama-French 3-factor regression of portfolio excess returns against the `FamaFrenchFactors` collection (which is already populated daily from the Kenneth French Data Library). Matches stretch goal 2.13.
- **Dividend forecasting** — the current Dividends page tracks *historical* dividend income by month. The original proposal also called for forward-looking yield forecasts, a payout calendar, expected future income, and dividend growth ratings. These were scoped out of the capstone submission to keep the analytics depth focused on returns/risk.
- **Fundamental data** — the Stock Info page currently shows the per-ticker reference overview (name, market cap, sector) from the Massive API. The proposal also called for financial ratios and balance sheet data. Adding this would mean a second data source (e.g., Financial Modeling Prep) and a new `Fundamentals` collection.
- **Correlation matrix** — pairwise correlation across holdings and against the benchmark.
- **Return attribution** — contribution of each holding (and each factor) to total portfolio return.
- **Async refresh UX** — dedicated `RefreshJob` model with progress polling so the Refresh button reflects pipeline state instead of just spinning.

## Screenshots

*Coming soon*

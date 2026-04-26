# QuantDashboard — Model Schemas

> All Mongoose models live in `quantDashBoard-nextjs/models/`. Last updated: 2026-04-22.
>
> Ported from the MERN version. The schemas are unchanged; two new models were added for symbol metadata (`InstrumentReference`, `TickerOverview`) sourced from the Massive flat-file feed.

---

## User

**File:** `models/Users.js`
**Collection:** `users`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | String | Unique. SnapTrade user ID |
| `email` | String | Required, unique |
| `password` | String | Bcrypt hashed |
| `firstName` | String | |
| `lastName` | String | |
| `userSecret` | String | SnapTrade user secret |
| `preferences` | Object | `{ baseCurrency, benchmark }` |

**Indexes:** `{ userId: 1 }` unique

**Notes:** `preferences.riskFree` field was removed (RFR-02) — RF now comes from FamaFrenchService.

---

## FamaFrenchFactors

**File:** `models/FamaFrenchFactors.js`
**Collection:** `famafrenchfactors`

| Field | Type | Notes |
|-------|------|-------|
| `date` | Date | Trading day |
| `mktRf` | Number | Market excess return (Mkt-RF) |
| `smb` | Number | Small Minus Big factor |
| `hml` | Number | High Minus Low factor |
| `rf` | Number | Daily risk-free rate (decimal, not percent) |

**Indexes:** `{ date: 1 }` unique

**Notes:** Populated by `famaFrenchService.js` from Kenneth French Data Library. TTL-based refresh (7-day). All values stored as decimals (e.g., 0.0002 not 0.02%).

---

## SnapTradeMetrics (Metrics)

**File:** `models/Metrics.js`
**Collection:** `snaptrademetrics`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | String | Required |
| `accountId` | String | Optional (null = aggregate across all accounts) |
| `date` | Date | Calculation date |
| `period` | String | Enum: `1M`, `3M`, `YTD`, `1Y`, `ALL` |
| `metrics.aum` | Number | Assets under management |
| `metrics.totalReturn` | Number | Point-to-point return |
| `metrics.cagr` | Number | Compound annual growth rate |
| `metrics.volatility` | Number | Annualized volatility |
| `metrics.sharpe` | Number | Sharpe ratio (using FF RF) |
| `metrics.sortino` | Number | Sortino ratio |
| `metrics.maxDrawdown` | Number | Maximum drawdown |
| `metrics.beta` | Number | Beta vs benchmark |
| `metrics.var95` | Number | Value at Risk (95%) |
| `metrics.cvar95` | Number | Conditional VaR |
| `metrics.hhi` | Number | Herfindahl-Hirschman Index |
| `metrics.diversificationScore` | Number | Derived from HHI |
| `metrics.correlation` | Number | Portfolio-benchmark correlation |
| `metrics.dividendIncome` | Number | Period dividend income |
| `metrics.interestIncome` | Number | Period interest income |
| `metrics.totalIncomeYield` | Number | Combined income yield |
| `metrics.nav` | Decimal128 | Net asset value |
| `metrics.downsideDeviation` | Number | **Stub — returns null** |
| `metrics.omegaRatio` | Number | **Stub — returns null** |
| `metrics.sharpeConfidenceInterval` | Number | **Stub — returns null** |
| `metrics.calmarRatio` | Number | **Stub — returns null** |
| `metrics.alpha` | Number | **Stub — returns null** |

**Indexes:**
- `{ userId: 1, accountId: 1, date: 1, period: 1 }` unique sparse
- `{ asOfDate: 1, accountId: 1 }` unique sparse (legacy compat)

---

## PortfolioTimeseries

**File:** `models/PortfolioTimeseries.js`
**Collection:** `portfoliotimeseries`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | String | Required |
| `accountId` | String | Required |
| `date` | Date | Trading day |
| `stockValue` | Number | Total equity value |
| `cashValue` | Number | Cash balance |
| `totalValue` | Number | stockValue + cashValue |
| `depositWithdrawal` | Number | Net external flow for the day |
| `externalFlowCumulative` | Number | Running total of external flows |
| `simpleReturns` | Number | Daily simple return |
| `dailyTWRReturn` | Number | Daily TWR return |
| `twr1Day` | Number | 1-day TWR |
| `twr3M` | Number | 3-month TWR |
| `twrYTD` | Number | Year-to-date TWR |
| `twrAllTime` | Number | All-time TWR |
| `cumReturn` | Number | Cumulative return |
| `equityIndex` | Number | Equity index (starts at 1.0) |
| `positions` | Array | `[{ symbol, units, price, value }]` |

**Indexes:** `{ userId: 1, accountId: 1, date: 1 }` unique

---

## EquitiesWeightTimeseries

**File:** `models/EquitiesWeightTimeseries.js`
**Collection:** `equitiesweighttimeseries`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | String | |
| `accountId` | String | |
| `date` | Date | |
| `symbol` | String | Ticker symbol |
| `units` | Number | Position size in shares |

**Indexes:** `{ accountId: 1, date: 1, symbol: 1 }` unique

---

## PriceHistory

**File:** `models/PriceHistory.js`
**Collection:** `pricehistory`

| Field | Type | Notes |
|-------|------|-------|
| `symbol` | String | Ticker (normalized for crypto) |
| `date` | Date | Trading day |
| `close` | Number | Closing price |
| `open` | Number | Opening price |
| `high` | Number | Day high |
| `low` | Number | Day low |
| `volume` | Number | Trading volume |

**Indexes:** `{ symbol: 1, date: 1 }` unique

---

## AccountsList

**File:** `models/AccountsList.js`
**Collection:** `accountslists`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | String | |
| `accountId` | String | Unique. SnapTrade account ID |
| `accountName` | String | |
| `number` | String | Account number |
| `currency` | String | e.g., USD, CAD |
| `institutionName` | String | Brokerage name |
| `syncStatus` | String | |
| `brokerageAuthorizationId` | String | |

**Indexes:** `{ accountId: 1 }` unique

---

## AccountDetail

**File:** `models/AccountDetail.js`
**Collection:** `accountdetails`

| Field | Type | Notes |
|-------|------|-------|
| `accountId` | String | |
| (additional detail fields) | Mixed | Account-level metadata from SnapTrade |

**Indexes:** `{ accountId: 1 }`

---

## AccountHoldings

**File:** `models/AccountHoldings.js`
**Collection:** `accountholdings`

| Field | Type | Notes |
|-------|------|-------|
| `accountId` | String | |
| `userId` | String | |
| (holdings array) | Array | Current position snapshot from SnapTrade |

**Indexes:** `{ accountId: 1 }`

---

## AccountBalances

**File:** `models/AccountBalances.js`
**Collection:** `accountbalances`

| Field | Type | Notes |
|-------|------|-------|
| `accountId` | String | |
| (balance fields) | Mixed | Cash, equity, total from SnapTrade |

**Indexes:** `{ accountId: 1 }`

**Note:** The Next.js port has no dedicated `/api/accounts/balances` endpoint. Balance info is read off `AccountsList` / `AccountHoldings` / `PortfolioTimeseries` via the combined `/api/accounts` and `/api/metrics/*` routes. (The MERN version's `GET /accounts/balances` called SnapTrade live — flagged in the old arch notes but not ported.)

---

## AccountPositions

**File:** `models/AccountPositions.js`
**Collection:** `accountpositions`

| Field | Type | Notes |
|-------|------|-------|
| `accountId` | String | |
| (positions array) | Array | Current positions from SnapTrade |

**Indexes:** `{ accountId: 1 }`

---

## AccountOrders

**File:** `models/AccountOrders.js`
**Collection:** `accountorders`

| Field | Type | Notes |
|-------|------|-------|
| `accountId` | String | |
| (order fields) | Mixed | Order history from SnapTrade |

**Indexes:** `{ accountId: 1 }`

---

## SnapTradeAccountActivities (AccountActivities)

**File:** `models/AccountActivities.js`
**Collection:** `snaptradeaccountactivities`

| Field | Type | Notes |
|-------|------|-------|
| `accountId` | String | |
| `userId` | String | |
| `activityId` | String | SnapTrade activity ID |
| `type` | String | Activity type (BUY, SELL, DIVIDEND, etc.) |
| `date` | Date | Activity/trade date |
| `symbol` | String | Ticker symbol |
| `units` | Number | Shares transacted |
| `price` | Number | Per-share price |
| `amount` | Number | Total amount |
| `fee` | Number | Transaction fee |
| `option_symbol` | Object | Option contract details (if applicable) |
| `raw` | Object | Raw SnapTrade response |

**Indexes:** `{ accountId: 1, activityId: 1 }` unique

---

## Connection

**File:** `models/Connection.js`
**Collection:** `connections`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | String | |
| `connectionId` | String | Unique. SnapTrade connection ID |
| `authorizationId` | String | SnapTrade auth ID |
| `brokerage` | String | Brokerage name |
| `status` | String | Connection status |
| `lastSyncDate` | Date | |

**Indexes:** `{ connectionId: 1 }` unique

---

## Options

**File:** `models/Options.js`
**Collection:** `options`

| Field | Type | Notes |
|-------|------|-------|
| (option contract fields) | Mixed | Option positions from SnapTrade |

**Indexes:** None defined

---

## InstrumentReference

**File:** `models/InstrumentReference.js`
**Collection:** `instrumentreferences`

| Field | Type | Notes |
|-------|------|-------|
| `tickerUpper` | String | Required, unique. Uppercase ticker key |
| `classificationOutcome` | String | Enum: `classified`, `confirmed_absent`, `unresolved` |
| `market` | String | Enum: `stocks`, `crypto`, `fx`, `otc`, `indices`, or null |
| `massiveTicker` | String | Resolved symbol used in the Massive feed |
| `active` | Boolean | |
| `type` | String | Instrument type (e.g., CS, ETF) |
| `locale` | String | |
| `primaryExchange` | String | |
| `name` | String | |
| `lastCheckedAt` | Date | Required. When we last attempted resolution |
| `lastSuccessAt` | Date | When resolution last succeeded |
| `lastHttpStatus` | Number | |
| `lastError` | String | |
| `lastRequestId` | String | |
| `ambiguityCandidates` | [String] | Alternate tickers when resolution is ambiguous |

**Indexes:** `{ tickerUpper: 1 }` unique, `{ lastSuccessAt: 1 }`

**Notes:** Cache + resolver state for mapping our stored symbols onto Massive's ticker universe. Populated by `lib/instrument-reference/`.

---

## TickerOverview

**File:** `models/TickerOverview.js`
**Collection:** `tickeroverviews`

| Field | Type | Notes |
|-------|------|-------|
| `tickerUpper` | String | Required, unique |
| `name` | String | |
| `description` | String | |
| `type` | String | |
| `market` | String | |
| `locale` | String | |
| `active` | Boolean | |
| `marketCap` | Number | |
| `totalEmployees` | Number | |
| `roundLot` | Number | |
| `sicCode` | String | |
| `sicDescription` | String | |
| `homepageUrl` | String | |
| `currencyName` | String | |
| `primaryExchange` | String | |
| `brandingIconUrl` | String | |
| `brandingLogoUrl` | String | |
| `address` | Object | `{ address1, city, state, postalCode }` |
| `listDate` | String | |
| `cik` | String | |
| `tickerRoot` / `tickerSuffix` | String | |
| `shareClassSharesOutstanding` | Number | |
| `weightedSharesOutstanding` | Number | |
| `compositeFigi` / `shareClassFigi` | String | |
| `lastCheckedAt` | Date | Required |
| `lastSuccessAt` | Date | |
| `lastHttpStatus` | Number | |
| `lastError` | String | |

**Indexes:** `{ tickerUpper: 1 }` unique, `{ lastSuccessAt: 1 }`

**Notes:** Per-ticker overview cache backing `GET /api/ticker-overview/[ticker]`. Populated from the Massive reference API.

---

*Update this file when model schemas change.*

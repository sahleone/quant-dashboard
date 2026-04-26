# Data Scripts Reference

This folder contains standalone analysis scripts for QuantDashboard.
Scripts are run manually from the project root with:

`node --env-file=.env.local <script>`

## File-by-file guide

### `checkTimeseriesGapsVsMarket.mjs`
- Diagnostic tool for missing days in `PortfolioTimeseries`.
- Compares expected weekday coverage vs actual portfolio rows.
- Cross-checks gaps against the Massive market-closed calendar endpoint and SPY daily bars.
- Helps classify missing dates as likely holiday/market closed vs probable data gap.

Example:
- `node --env-file=.env.local data/checkTimeseriesGapsVsMarket.mjs --userId <id> --accountId <id>`

---

### `betaVsSpyDaily.mjs`
- Computes portfolio beta vs SPY daily total returns.
- Aligns portfolio daily returns with SPY returns from `pricehistories`.
- Uses trailing window (default based on `--months`, default 36 months).
- Outputs beta and observation counts (no DB writes).

---

### `betaCapmFfDaily.mjs`
- CAPM beta using Fama-French market excess factor (`Mkt-RF`).
- Computes excess portfolio return (`Rp-Rf`) and beta via covariance ratio.
- Also reports daily/annualized alpha approximation.
- Reads `PortfolioTimeseries` + `FamaFrenchFactors`; outputs stats only.

---

### `betaCapmFfOlsDaily.mjs`
- CAPM regression via OLS:
  - `(Rp-Rf) ~ alpha + beta*(Mkt-Rf)`
- Returns intercept (Jensen alpha), market beta, and `R^2`.
- Reads `PortfolioTimeseries` + `FamaFrenchFactors`; outputs stats only.

---

### `betaFf3Daily.mjs`
- Fama-French 3-factor OLS regression:
  - `(Rp-Rf) ~ alpha + beta_mkt*(Mkt-Rf) + beta_smb*SMB + beta_hml*HML`
- Returns factor loadings, alpha, and `R^2`.
- Reads `PortfolioTimeseries` + `FamaFrenchFactors`; outputs stats only.

---

### `betaVsMarketFf.mjs`
- Alias wrapper for `betaCapmFfDaily.mjs`.
- Exists for naming convenience; delegates directly to the CAPM covariance script.

---

### `lib/betaShared.mjs`
- Shared helpers used by beta/regression scripts:
  - argument parsing (`--months`, `--userId`, `--accountId`, `--end`)
  - trading-day window sizing
  - date alignment utilities
  - CAPM/FF alignment and alpha helper

---

### `lib/regression.mjs`
- Lightweight multivariate OLS implementation used by factor scripts.
- Provides `olsMultivariate(y, factorCols)` returning coefficients, `R^2`, and observation count.
- Includes internal linear-system solver (`solveSymmetric`).

## Notes

- Scripts here are intended for data ops, diagnostics, and financial analysis.
- Most are read-heavy and print JSON summaries to stdout.
- Price/coverage behavior depends on `MASSIVE_API_KEY` for the Massive REST API.

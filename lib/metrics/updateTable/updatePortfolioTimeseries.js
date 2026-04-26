import mongoose from "mongoose";
import { isCryptoSymbol } from "@/utils/cryptoSymbols";
import { resolveStatusesForSymbols } from "@/lib/instrument-reference/statusResolver.js";
import { groupMissingEventsByRange } from "@/lib/metrics/helpers/missingPriceGrouping.js";

function normalizeCryptoSymbol(symbol) {
  if (isCryptoSymbol(symbol))
    return `${symbol.replace(/\s+/g, "").toUpperCase()}-USD`;
  return symbol;
}

function isOptionSymbol(symbol) {
  if (typeof symbol !== "string") return false;
  return symbol.includes(" ") && symbol.trim() !== symbol.replace(/\s+/g, "");
}

function buildUnitsFromActivities(activities, allDates) {
  const UNITS_ACTIVITY_TYPES = new Set([
    "BUY",
    "SELL",
    "REI",
    "OPTIONASSIGNMENT",
    "OPTIONEXERCISE",
    "OPTIONEXPIRATION",
  ]);

  const activitiesByDate = new Map();
  activities.forEach((activity) => {
    const dateValue = activity.trade_date || activity.date;
    if (!dateValue) return;
    const dateStr = (
      dateValue instanceof Date ? dateValue : new Date(dateValue)
    )
      .toISOString()
      .split("T")[0];
    if (!activitiesByDate.has(dateStr)) activitiesByDate.set(dateStr, []);
    activitiesByDate.get(dateStr).push(activity);
  });

  const unitsByDate = new Map();
  const units = {};
  const firstDate = allDates.length > 0 ? allDates[0] : null;

  if (firstDate) {
    for (const [dateStr, dayActivities] of activitiesByDate.entries()) {
      if (dateStr >= firstDate) continue;
      dayActivities.forEach((activity) => {
        const type = String(activity.type || "").toUpperCase();
        if (UNITS_ACTIVITY_TYPES.has(type)) {
          const symbol = activity.symbol || activity.symbolObj?.symbol || null;
          if (!symbol) return;
          const quantity = parseFloat(activity.quantity || activity.units || 0);
          if (isNaN(quantity)) return;
          if (!units[symbol]) units[symbol] = 0;
          if (type === "BUY" || type === "REI")
            units[symbol] += Math.abs(quantity);
          else if (type === "SELL") units[symbol] -= Math.abs(quantity);
        }
      });
    }
  }

  for (const dateStr of allDates.sort()) {
    const dayActivities = activitiesByDate.get(dateStr) || [];

    dayActivities.forEach((activity) => {
      const type = String(activity.type || "").toUpperCase();
      if (UNITS_ACTIVITY_TYPES.has(type)) {
        const symbol = activity.symbol || activity.symbolObj?.symbol || null;
        if (!symbol) return;
        const quantity = parseFloat(activity.quantity || activity.units || 0);
        if (isNaN(quantity)) return;
        if (!units[symbol]) units[symbol] = 0;
        if (type === "BUY" || type === "REI")
          units[symbol] += Math.abs(quantity);
        else if (type === "SELL") units[symbol] -= Math.abs(quantity);
      }
    });

    unitsByDate.set(dateStr, { ...units });
  }

  return unitsByDate;
}

async function calculateStockValueFromUnits(units, date, db) {
  const priceHistoryCollection = db.collection("pricehistories");

  if (!units || Object.keys(units).length === 0)
    return { stockValue: 0, positions: [], hasUnpricedEquity: false };

  const symbols = Object.keys(units).filter((s) => units[s] !== 0);
  if (symbols.length === 0)
    return { stockValue: 0, positions: [], hasUnpricedEquity: false };

  const symbolsToQuery = new Set(symbols);
  for (const symbol of symbols) {
    if (isCryptoSymbol(symbol))
      symbolsToQuery.add(normalizeCryptoSymbol(symbol));
  }

  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  const priceQueryDate = new Date(normalizedDate);
  priceQueryDate.setHours(23, 59, 59, 999);

  const prices = await priceHistoryCollection
    .aggregate([
      {
        $match: {
          symbol: { $in: Array.from(symbolsToQuery) },
          date: { $lte: priceQueryDate },
        },
      },
      { $sort: { symbol: 1, date: -1 } },
      {
        $group: {
          _id: "$symbol",
          close: { $first: "$close" },
          date: { $first: "$date" },
        },
      },
    ])
    .toArray();

  const pricesBySymbol = new Map();
  for (const price of prices) pricesBySymbol.set(price._id, price.close || 0);

  let totalStockValue = 0;
  const positionDetails = [];

  for (const symbol of symbols) {
    const symbolUnits = units[symbol] || 0;
    if (symbolUnits === 0) continue;

    let price = pricesBySymbol.get(symbol) || 0;
    if (price === 0 && isCryptoSymbol(symbol)) {
      price = pricesBySymbol.get(normalizeCryptoSymbol(symbol)) || 0;
    }

    const value = symbolUnits * price;
    totalStockValue += value;
    positionDetails.push({ symbol, units: symbolUnits, price, value });
  }

  const hasUnpricedEquity = positionDetails.some(
    (p) => p.price === 0 && p.units !== 0 && !isOptionSymbol(p.symbol),
  );

  return { stockValue: totalStockValue, positions: positionDetails, hasUnpricedEquity };
}

async function buildCashAndFlows(
  accountId,
  db,
  endDate = null,
  activities = null,
) {
  if (!activities) {
    const activitiesCollection = db.collection("snaptradeaccountactivities");
    activities = await activitiesCollection
      .find({ accountId })
      .sort({ trade_date: 1, date: 1, _id: 1 })
      .toArray();
  }

  if (activities.length === 0) {
    return {
      cashValue: new Map(),
      cashFlowDay: new Map(),
      extFlowDay: new Map(),
      extFlowCum: new Map(),
    };
  }

  let earliestDate = null;
  const activitiesByDate = new Map();

  for (const activity of activities) {
    const dateRaw = activity.trade_date || activity.date;
    if (!dateRaw) continue;
    const date = new Date(dateRaw);
    date.setHours(0, 0, 0, 0);
    const dateKey = date.toISOString().split("T")[0];
    if (!earliestDate || dateKey < earliestDate) earliestDate = dateKey;
    if (!activitiesByDate.has(dateKey)) activitiesByDate.set(dateKey, []);
    activitiesByDate.get(dateKey).push(activity);
  }

  if (!earliestDate)
    return {
      cashValue: new Map(),
      cashFlowDay: new Map(),
      extFlowDay: new Map(),
      extFlowCum: new Map(),
    };

  const startDate = new Date(earliestDate);
  const finalEndDate = endDate || new Date();
  finalEndDate.setHours(23, 59, 59, 999);

  const allDates = [];
  const current = new Date(startDate);
  while (current <= finalEndDate) {
    allDates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  const EXT_TYPES = new Set([
    "CONTRIBUTION",
    "DEPOSIT",
    "WITHDRAWAL",
    "DIVIDEND",
  ]);

  let cash = 0;
  const cashValue = new Map();
  const cashFlowDay = new Map();
  const extFlowDay = new Map();
  const extFlowCum = new Map();
  let runningExtFlow = 0;
  let minCashValue = 0;

  for (const dateKey of allDates) {
    let dayCashFlow = 0;
    let dayExtFlow = 0;
    const dayActivities = activitiesByDate.get(dateKey) || [];

    for (const activity of dayActivities) {
      const type = String(activity.type || "").toUpperCase();
      const amount = parseFloat(activity.amount || 0);
      if (isNaN(amount)) continue;

      cash += amount;
      dayCashFlow += amount;

      const isOptionTransaction =
        (type === "BUY" || type === "SELL") && activity.option_symbol != null;
      const isExternalFlow = EXT_TYPES.has(type) || isOptionTransaction;

      if (isExternalFlow) {
        let extAmount = amount;
        if (type === "WITHDRAWAL") extAmount = -Math.abs(amount);
        else if (type === "CONTRIBUTION" || type === "DEPOSIT")
          extAmount = Math.abs(amount);
        dayExtFlow += extAmount;
        runningExtFlow += extAmount;
      }
    }

    cashValue.set(dateKey, cash);
    extFlowCum.set(dateKey, runningExtFlow);

    if (dayActivities.length > 0) {
      if (dayCashFlow !== 0) cashFlowDay.set(dateKey, dayCashFlow);
      if (dayExtFlow !== 0) extFlowDay.set(dateKey, dayExtFlow);
    }

    if (cash < minCashValue) minCashValue = cash;
  }

  if (minCashValue < 0) {
    console.warn(
      `Account ${accountId}: Cash value goes negative (min: ${minCashValue.toFixed(2)}). May indicate missing initial deposit.`,
    );
  }

  return { cashValue, cashFlowDay, extFlowDay, extFlowCum };
}

function calculateReturns(portfolioData) {
  const dates = Array.from(portfolioData.keys()).sort();
  if (dates.length === 0) return portfolioData;

  for (let i = 1; i < dates.length; i++) {
    const prev = portfolioData.get(dates[i - 1]);
    const curr = portfolioData.get(dates[i]);
    const V_prev = prev.totalValue || 0;
    const CF = curr.depositWithdrawal || 0;
    const base = V_prev + CF;
    const V_curr = curr.totalValue || 0;

    curr.simpleReturns = base <= 0 ? 0 : (V_curr - base) / base;

    const startValueWithCF = V_prev + CF;
    if (Math.abs(startValueWithCF) < 1e-6) {
      curr.dailyTWRReturn = 0;
    } else if (V_curr <= 0) {
      console.warn(
        `TWR: V_curr <= 0 on ${dates[i]}. Setting dailyTWRReturn = 0.`,
      );
      curr.dailyTWRReturn = 0;
    } else {
      const ratio = V_curr / startValueWithCF;
      const logReturn = Math.log(Math.max(ratio, 1e-10));
      if (
        isNaN(logReturn) ||
        !isFinite(logReturn) ||
        Math.abs(logReturn) > 10
      ) {
        curr.dailyTWRReturn = 0;
      } else {
        curr.dailyTWRReturn = logReturn;
      }
    }

    if (curr.simpleReturns !== 0 && curr.dailyTWRReturn !== 0) {
      const divergence = Math.abs(curr.dailyTWRReturn - curr.simpleReturns);
      if (divergence > 0.05) {
        console.warn(
          `Large return divergence on ${dates[i]}: simple=${curr.simpleReturns.toFixed(6)}, log=${curr.dailyTWRReturn.toFixed(6)}`,
        );
      }
    }
  }

  if (dates.length > 0) {
    const firstData = portfolioData.get(dates[0]);
    firstData.simpleReturns = 0;
    firstData.dailyTWRReturn = 0;
  }

  const THRESH = 1e-3;
  const alive = new Map();
  for (const date of dates) {
    alive.set(date, (portfolioData.get(date).totalValue || 0) > THRESH);
  }

  const segmentId = new Map();
  let currentSegment = 0;
  let prevAlive = false;
  for (const date of dates) {
    const isAlive = alive.get(date);
    if (isAlive && !prevAlive) currentSegment++;
    segmentId.set(date, isAlive ? currentSegment : 0);
    prevAlive = isAlive;
  }

  const cumReturn = new Map();
  const equityIndex = new Map();
  const maxSegment = Math.max(...Array.from(segmentId.values()));

  for (let seg = 1; seg <= maxSegment; seg++) {
    const segmentDates = dates.filter((d) => segmentId.get(d) === seg);
    if (segmentDates.length === 0) continue;

    let cumRet = 0;
    let eqIdx = 1;

    for (const date of segmentDates) {
      const data = portfolioData.get(date);
      const ret = data.simpleReturns || 0;
      cumRet = (1 + ret) * (1 + cumRet) - 1;
      eqIdx = (1 + ret) * eqIdx;
      cumReturn.set(date, cumRet);
      equityIndex.set(date, eqIdx);
    }
  }

  for (const date of dates) {
    const data = portfolioData.get(date);
    data.cumReturn = cumReturn.get(date) || 0;
    data.equityIndex =
      segmentId.get(date) === 0 ? null : equityIndex.get(date) || null;
  }

  return portfolioData;
}

function calculatePeriodTWRReturns(portfolioData) {
  const dates = Array.from(portfolioData.keys()).sort();
  if (dates.length === 0) return portfolioData;

  const firstDate = dates[0];
  const [firstYear] = firstDate.split("-").map(Number);

  for (let i = 0; i < dates.length; i++) {
    const currentDate = dates[i];
    const currentData = portfolioData.get(currentDate);

    if (
      currentData.dailyTWRReturn !== undefined &&
      currentData.dailyTWRReturn !== null &&
      isFinite(currentData.dailyTWRReturn)
    ) {
      const simpleReturn = Math.exp(currentData.dailyTWRReturn) - 1;
      currentData.twr1Day = isFinite(simpleReturn) ? simpleReturn : null;
    } else {
      currentData.twr1Day = null;
    }

    const [currentYear, currentMonth, currentDay] = currentDate
      .split("-")
      .map(Number);

    let targetYear = currentYear;
    let targetMonth = currentMonth - 3;
    while (targetMonth < 1) {
      targetMonth += 12;
      targetYear -= 1;
    }
    const lastDayOfTargetMonth = new Date(
      Date.UTC(targetYear, targetMonth, 0),
    ).getUTCDate();
    const targetDay = Math.min(currentDay, lastDayOfTargetMonth);
    const threeMonthsAgoStr = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
    const yearStartStr = `${currentYear}-01-01`;

    const geometricLink = (startDateStr, endDateStr) => {
      const periodDates = dates.filter(
        (d) => d >= startDateStr && d <= endDateStr,
      );
      if (periodDates.length === 0) return null;

      const actualStartData = portfolioData.get(periodDates[0]);
      if (
        !actualStartData ||
        actualStartData.dailyTWRReturn === undefined ||
        actualStartData.dailyTWRReturn === null
      )
        return null;

      let sumLogReturns = 0;
      let hasValidReturns = false;
      for (const dateStr of periodDates) {
        const dayData = portfolioData.get(dateStr);
        if (
          dayData &&
          dayData.dailyTWRReturn !== undefined &&
          dayData.dailyTWRReturn !== null &&
          isFinite(dayData.dailyTWRReturn)
        ) {
          sumLogReturns += dayData.dailyTWRReturn;
          hasValidReturns = true;
        }
      }

      if (!hasValidReturns) return null;
      const result = Math.exp(sumLogReturns) - 1;
      return isFinite(result) ? result : null;
    };

    const start3M =
      threeMonthsAgoStr > firstDate ? threeMonthsAgoStr : firstDate;
    currentData.twr3Months = geometricLink(start3M, currentDate);

    const startYTD = yearStartStr > firstDate ? yearStartStr : firstDate;
    currentData.twrYearToDate =
      currentYear >= firstYear ? geometricLink(startYTD, currentDate) : null;
    currentData.twrAllTime = geometricLink(firstDate, currentDate);
  }

  return portfolioData;
}

async function getValuationEndDate(db) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let latestPrice = null;
  try {
    latestPrice = await db
      .collection("pricehistories")
      .find({}, { projection: { date: 1 } })
      .sort({ date: -1 })
      .limit(1)
      .next();
  } catch {

    return yesterday;
  }

  if (!latestPrice?.date) {
    return yesterday;
  }

  const latestPriceDate = new Date(latestPrice.date);
  latestPriceDate.setHours(23, 59, 59, 999);
  return latestPriceDate < today ? latestPriceDate : today;
}

export async function updatePortfolioTimeseries(opts = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error(
      "MongoDB not connected. Call connectDB() before running updatePortfolioTimeseries.",
    );
  }

  const userId = opts.userId || null;
  const accountId = opts.accountId || null;
  const fullSync = opts.fullSync === true;

  const db = mongoose.connection.db;
  const summary = {
    totalAccounts: 0,
    processed: 0,
    skipped: 0,
    totalRecords: 0,
    errors: [],
  };
  summary._missingPrices = [];
  summary._missingPriceRanges = [];

  try {
    const activitiesCollection = db.collection("snaptradeaccountactivities");
    const query = {};
    if (userId) query.userId = userId;
    if (accountId) query.accountId = accountId;

    const accounts = await activitiesCollection.distinct("accountId", query);
    summary.totalAccounts = accounts.length;

    if (accounts.length === 0) {
      console.log("No accounts found in activities");
      return summary;
    }

    console.log(
      `Processing ${accounts.length} account(s) (fullSync: ${fullSync})`,
    );

    for (const acctId of accounts) {
      try {
        const sampleActivity = await activitiesCollection.findOne({
          accountId: acctId,
        });
        if (!sampleActivity) {
          summary.skipped++;
          continue;
        }

        const acctUserId = sampleActivity.userId;
        if (!acctUserId) {
          summary.skipped++;
          continue;
        }

        console.log(`Processing account ${acctId} (user ${acctUserId})...`);

        const activities = await activitiesCollection
          .find({ accountId: acctId, userId: acctUserId })
          .sort({ trade_date: 1, date: 1, _id: 1 })
          .toArray();
        if (activities.length === 0) {
          summary.skipped++;
          continue;
        }

        let earliestActivityDate = null;
        let latestActivityDate = null;
        for (const activity of activities) {
          const dateValue = activity.trade_date || activity.date;
          if (!dateValue) continue;
          const date = new Date(dateValue);
          date.setHours(0, 0, 0, 0);
          if (!earliestActivityDate || date < earliestActivityDate)
            earliestActivityDate = date;
          if (!latestActivityDate || date > latestActivityDate)
            latestActivityDate = date;
        }

        if (!earliestActivityDate) {
          summary.skipped++;
          continue;
        }

        let startDate, endDate;
        const valuationEndDate = await getValuationEndDate(db);
        if (fullSync) {
          startDate = earliestActivityDate;
          endDate = new Date(valuationEndDate);
        } else {
          const portfolioCollection = db.collection("portfoliotimeseries");
          const lastEntry = await portfolioCollection
            .find({ accountId: acctId })
            .sort({ date: -1 })
            .limit(1)
            .toArray();

          if (lastEntry.length > 0) {
            startDate = new Date(lastEntry[0].date);
            if (startDate < earliestActivityDate)
              startDate = earliestActivityDate;
          } else {
            startDate = earliestActivityDate;
          }
          endDate = new Date(valuationEndDate);
        }

        const cashFlows = await buildCashAndFlows(
          acctId,
          db,
          endDate,
          activities,
        );

        const balancesCollection = db.collection("snaptradeaccountbalances");
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        const accountBalance = await balancesCollection
          .find({ accountId: acctId, asOfDate: { $lt: startOfToday } })
          .sort({ asOfDate: -1 })
          .limit(1)
          .next();

        if (accountBalance && accountBalance.cash != null) {
          const cashVal = accountBalance.cash;
          const knownCash = parseFloat(cashVal?.toString?.() ?? cashVal ?? 0);
          const allCashDates = Array.from(cashFlows.cashValue.keys()).sort();

          if (allCashDates.length > 0) {
            const lastCashDate = allCashDates[allCashDates.length - 1];
            const runningCash = cashFlows.cashValue.get(lastCashDate) || 0;
            const offset = knownCash - runningCash;
            const calibrationThreshold = Math.max(
              1,
              Math.abs(knownCash) * 0.001,
            );

            if (Math.abs(offset) > calibrationThreshold) {
              console.log(
                `  Calibrating cash: SnapTrade=$${knownCash.toFixed(2)}, running=$${runningCash.toFixed(2)}, offset=$${offset.toFixed(2)}`,
              );

              const CALIBRATION_WINDOW_DAYS = 30;
              const cutoffIdx = Math.max(
                0,
                allCashDates.length - CALIBRATION_WINDOW_DAYS,
              );
              for (let ci = cutoffIdx; ci < allCashDates.length; ci++) {
                const dk = allCashDates[ci];
                cashFlows.cashValue.set(
                  dk,
                  cashFlows.cashValue.get(dk) + offset,
                );
              }
            }
          }
        }

        const dates = [];
        const current = new Date(startDate);
        const end = new Date(endDate);
        while (current <= end) {
          dates.push(new Date(current));
          current.setDate(current.getDate() + 1);
        }

        const allDatesSorted = dates.map((d) => d.toISOString().split("T")[0]);
        const unitsByDate = buildUnitsFromActivities(
          activities,
          allDatesSorted,
        );
        const accountSymbols = new Set();
        for (const units of unitsByDate.values()) {
          for (const [symbol, value] of Object.entries(units)) {
            if (value !== 0) accountSymbols.add(symbol);
          }
        }
        const accountSymbolStatuses = new Map();
        if (accountSymbols.size > 0) {
          const resolvedStatuses = await resolveStatusesForSymbols(
            Array.from(accountSymbols),
          );
          for (const status of resolvedStatuses) {
            if (status?.tickerUpper) {
              accountSymbolStatuses.set(status.tickerUpper, status);
            }
          }
        }
        const accountMissingEvents = [];
        const portfolioData = new Map();

        const cashValueByDate = new Map();
        let lastCashValue = 0;
        const extFlowCumByDate = new Map();
        let lastExtFlowCum = 0;

        for (const dateKey of allDatesSorted) {
          if (cashFlows.cashValue.has(dateKey))
            lastCashValue = cashFlows.cashValue.get(dateKey);
          cashValueByDate.set(dateKey, lastCashValue);
          if (cashFlows.extFlowCum.has(dateKey))
            lastExtFlowCum = cashFlows.extFlowCum.get(dateKey);
          extFlowCumByDate.set(dateKey, lastExtFlowCum);
        }

        const datesWithUnpricedEquity = new Set();

        for (const date of dates) {
          const dateKey = date.toISOString().split("T")[0];
          const units = unitsByDate.get(dateKey) || {};
          const { stockValue, positions, hasUnpricedEquity } =
            await calculateStockValueFromUnits(units, date, db);

          if (hasUnpricedEquity) {
            datesWithUnpricedEquity.add(dateKey);
          }

          const symbolsWithoutPrices = positions
            .filter((p) => p.price === 0 && p.units !== 0)
            .map((p) => p.symbol);
          if (symbolsWithoutPrices.length > 0) {
            summary._missingPrices.push({
              accountId: acctId,
              date: dateKey,
              symbols: symbolsWithoutPrices,
            });
            for (const symbol of symbolsWithoutPrices) {
              const statusMeta =
                accountSymbolStatuses.get(String(symbol).trim().toUpperCase()) ||
                null;
              accountMissingEvents.push({
                accountId: acctId,
                date: dateKey,
                symbol,
                status: statusMeta?.status || "unknown",
                reason: statusMeta?.reason || "UNRESOLVED_STATUS",
              });
            }
          }

          const cashValue = cashValueByDate.get(dateKey) || 0;
          const totalValue = stockValue + cashValue;
          const depositWithdrawal = cashFlows.extFlowDay.get(dateKey) || 0;
          const externalFlowCumulative = extFlowCumByDate.get(dateKey) || 0;

          portfolioData.set(dateKey, {
            userId: acctUserId,
            accountId: acctId,
            date,
            stockValue,
            cashValue,
            totalValue,
            depositWithdrawal,
            externalFlowCumulative,
            positions,
          });
        }

        const missingRanges = groupMissingEventsByRange(accountMissingEvents);
        if (missingRanges.length > 0) {
          summary._missingPriceRanges.push(...missingRanges);
          for (const range of missingRanges) {
            const msg =
              `Account ${range.accountId}: Missing price for ${range.symbol} ` +
              `(${range.status}) from ${range.startDate} to ${range.endDate} ` +
              `(${range.dayCount} day(s)). Portfolio value may be understated.` +
              ` Reason: ${range.sampleReason || "n/a"}.`;
            if (range.status === "active") {
              console.error(msg);
            } else {
              console.warn(msg);
            }
          }
        }

        calculateReturns(portfolioData);
        calculatePeriodTWRReturns(portfolioData);

        let tailAnchored = false;
        if (accountBalance && accountBalance.accountBalance != null) {
          const knownTotal = parseFloat(
            accountBalance.accountBalance?.toString?.() ??
              accountBalance.accountBalance ??
              0,
          );
          const latestDate = allDatesSorted[allDatesSorted.length - 1];
          const latestData = portfolioData.get(latestDate);

          const balanceDateKey = accountBalance.asOfDate
            ? new Date(accountBalance.asOfDate).toISOString().split("T")[0]
            : null;
          const sameDay = balanceDateKey === latestDate;

          if (latestData && knownTotal > 0 && sameDay) {
            const calcTotal = latestData.totalValue;
            if (Math.abs(calcTotal - knownTotal) / knownTotal > 0.01) {
              console.log(
                `  Anchoring latest totalValue: calculated=$${calcTotal.toFixed(2)}, SnapTrade=$${knownTotal.toFixed(2)}`,
              );
              latestData.totalValue = knownTotal;

              latestData.stockValue = knownTotal - latestData.cashValue;
            }
            tailAnchored = true;
          } else if (latestData && knownTotal > 0 && !sameDay) {
            console.warn(
              `  Skipping anchor: balance asOfDate ${balanceDateKey || "unknown"} does not match tail date ${latestDate}`,
            );
          }
        }

        const tailDate = allDatesSorted[allDatesSorted.length - 1];
        if (
          tailDate &&
          datesWithUnpricedEquity.has(tailDate) &&
          !tailAnchored
        ) {
          console.warn(
            `  Skipping tail date ${tailDate} for account ${acctId}: unpriced equity positions would undercount totalValue`,
          );
          portfolioData.delete(tailDate);
        }

        for (const [dateKey, data] of portfolioData) {
          if (
            isNaN(data.totalValue) ||
            isNaN(data.stockValue) ||
            isNaN(data.cashValue)
          ) {
            console.error(
              `Account ${acctId} on ${dateKey}: NaN detected in portfolio values (total: ${data.totalValue}, stock: ${data.stockValue}, cash: ${data.cashValue}). Skipping this record.`,
            );
            portfolioData.delete(dateKey);
            continue;
          }

          const expectedTotal = data.stockValue + data.cashValue;
          if (Math.abs(data.totalValue - expectedTotal) > 0.01) {
            console.warn(
              `Account ${acctId} on ${dateKey}: totalValue (${data.totalValue.toFixed(2)}) != stock (${data.stockValue.toFixed(2)}) + cash (${data.cashValue.toFixed(2)}). Correcting.`,
            );
            data.totalValue = expectedTotal;
          }
        }

        const portfolioCollection = db.collection("portfoliotimeseries");
        const ops = [];

        for (const [, data] of portfolioData) {
          ops.push({
            updateOne: {
              filter: {
                userId: data.userId,
                accountId: data.accountId,
                date: data.date,
              },
              update: {
                $set: {
                  userId: data.userId,
                  accountId: data.accountId,
                  date: data.date,
                  stockValue: data.stockValue,
                  cashValue: data.cashValue,
                  totalValue: data.totalValue,
                  depositWithdrawal: data.depositWithdrawal,
                  externalFlowCumulative: data.externalFlowCumulative,
                  simpleReturns: data.simpleReturns,
                  dailyTWRReturn: data.dailyTWRReturn,
                  twr1Day: data.twr1Day,
                  twr3Months: data.twr3Months,
                  twrYearToDate: data.twrYearToDate,
                  twrAllTime: data.twrAllTime,
                  cumReturn: data.cumReturn,
                  equityIndex: data.equityIndex,
                  positions: data.positions,
                },
                $setOnInsert: { createdAt: new Date() },
              },
              upsert: true,
            },
          });
        }

        if (ops.length > 0) {
          const BATCH_SIZE = 1000;
          let totalUpserted = 0;
          for (let i = 0; i < ops.length; i += BATCH_SIZE) {
            const batch = ops.slice(i, i + BATCH_SIZE);
            const res = await portfolioCollection.bulkWrite(batch, {
              ordered: false,
            });
            totalUpserted += res.upsertedCount || res.nUpserted || 0;
          }
          summary.totalRecords += totalUpserted;
          console.log(
            `  Account ${acctId}: stored ${totalUpserted} portfolio records`,
          );
        }

        summary.processed++;
      } catch (err) {
        console.error(
          `Error processing account ${acctId}:`,
          err?.message || err,
        );
        summary.errors.push({
          accountId: acctId,
          error: err?.message || String(err),
        });
      }
    }
  } catch (error) {
    console.error("Error in updatePortfolioTimeseries:", error);
    throw error;
  }

  return summary;
}

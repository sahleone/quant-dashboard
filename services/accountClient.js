import { getSnapTradeClient } from "./snapTradeClient";

export async function listAccounts(userId, userSecret) {
  const client = getSnapTradeClient();
  const response = await client.accountInformation.listUserAccounts({
    userId,
    userSecret,
  });
  return response.data || [];
}

export async function getAccountHoldings(userId, userSecret, accountId) {
  const client = getSnapTradeClient();
  const response = await client.accountInformation.getUserHoldings({
    userId,
    userSecret,
    accountId,
  });
  return response.data;
}

export async function getAccountPositions(userId, userSecret, accountId) {
  const client = getSnapTradeClient();
  const response = await client.accountInformation.getUserAccountPositions({
    userId,
    userSecret,
    accountId,
  });
  return response.data || [];
}

export async function getAccountBalances(userId, userSecret, accountId) {
  const client = getSnapTradeClient();
  const response = await client.accountInformation.getUserAccountBalance({
    userId,
    userSecret,
    accountId,
  });
  return response.data || [];
}

export async function getAccountOrders(
  userId,
  userSecret,
  accountId,
  days = 30,
) {
  const client = getSnapTradeClient();
  const response = await client.accountInformation.getUserAccountOrders({
    userId,
    userSecret,
    accountId,
    days,
  });
  return response.data || [];
}

export async function getAccountDetails(userId, userSecret, accountId) {
  const client = getSnapTradeClient();
  const response = await client.accountInformation.getUserAccountDetails({
    userId,
    userSecret,
    accountId,
  });
  return response.data;
}

async function listAllAccountActivities(
  userId,
  userSecret,
  accountId,
  options = {},
) {
  const client = getSnapTradeClient();
  const { days = 30, startDate = null, endDate = null } = options;

  const ALL_TYPES =
    "BUY,SELL,DIVIDEND,CONTRIBUTION,WITHDRAWAL,REI,STOCK_DIVIDEND,INTEREST,FEE,OPTIONEXPIRATION,OPTIONEXERCISE,OPTIONASSIGNMENT,TRANSFER";

  let allActivities = [];
  let offset = 0;
  const limit = 1000;
  let hasMorePages = true;
  let pageCount = 0;
  const MAX_PAGES = 1000;

  while (hasMorePages) {
    const params = {
      accountId,
      userId,
      userSecret,
      offset,
      limit,
      type: ALL_TYPES,
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    };

    const response =
      await client.accountInformation.getAccountActivities(params);
    const page = response.data || {};
    const activities = Array.isArray(page.data)
      ? page.data
      : Array.isArray(page)
        ? page
        : [];
    const pagination = page.pagination || {};

    allActivities = allActivities.concat(activities);

    if (activities.length < limit) {
      hasMorePages = false;
    } else if (
      typeof pagination.total === "number" &&
      offset + activities.length >= pagination.total
    ) {
      hasMorePages = false;
    } else {
      offset += limit;
      pageCount++;
      await new Promise((r) => setTimeout(r, 500));
    }

    if (pageCount >= MAX_PAGES) hasMorePages = false;
  }

  return allActivities;
}

function transformHoldings(holdings, accountId, userId) {
  if (!Array.isArray(holdings)) return [];
  const asOfDate = new Date();
  return holdings.map((holding) => ({
    userId,
    asOfDate,
    accountId,
    symbol: holding.symbol?.symbol || holding.symbol,
    description: holding.symbol?.description || "Unknown Security",
    currency: holding.symbol?.currency?.code || "USD",
    units: Number(holding.units ?? 0),
    price: Number(holding.price ?? 0),
    averagePurchasePrice: Number(holding.average_purchase_price ?? 0),
    marketValue: Number(holding.market_value ?? 0),
    typeCode: holding.symbol?.type?.code || "",
    typeDescription: holding.symbol?.type?.description || "",
    openPnl: holding.open_pnl || 0,
    fractionalUnits: holding.fractional_units || 0,
    exchange: holding.symbol?.exchange?.code || "Unknown",
    isCashEquivalent: holding.cash_equivalent || false,
    createdAt: new Date(),
  }));
}

function transformPositions(positions, accountId, userId) {
  if (!Array.isArray(positions)) return [];
  const asOfDate = new Date();
  return positions.map((position) => {
    let symbolTicker = "UNKNOWN";
    if (typeof position.symbol === "string") {
      symbolTicker = position.symbol;
    } else if (position.symbol && typeof position.symbol === "object") {
      if (
        position.symbol.symbol &&
        typeof position.symbol.symbol === "object"
      ) {
        symbolTicker =
          position.symbol.symbol.symbol ||
          position.symbol.symbol.raw_symbol ||
          "UNKNOWN";
      } else {
        symbolTicker =
          position.symbol.symbol || position.symbol.raw_symbol || "UNKNOWN";
      }
    }

    return {
      userId,
      asOfDate,
      accountId,
      symbolTicker,
      listingExchangeCode:
        position.symbol?.exchange?.code ||
        position.symbol?.symbol?.exchange?.code ||
        null,
      positionSymbol: position.symbol || {},
      units: Number(position.units ?? 0),
      price: Number(position.price ?? 0),
      open_pnl: Number(position.open_pnl ?? 0),
      average_purchase_price: Number(position.average_purchase_price ?? 0),
      currency: position.currency || {},
      cash_equivalent: position.cash_equivalent,
      createdAt: new Date(),
    };
  });
}

function transformBalances(balances, accountId, userId) {
  const balanceData = Array.isArray(balances) ? balances[0] : balances;
  if (!balanceData) {
    return {
      userId,
      asOfDate: new Date(),
      accountId,
      currency: { code: "USD" },
      cash: 0,
      buyingPower: 0,
      accountBalance: 0,
      openPn1: null,
      createdAt: new Date(),
    };
  }
  return {
    userId,
    asOfDate: new Date(),
    accountId,
    currency: balanceData.currency || { code: "USD" },
    cash: balanceData.cash,
    buyingPower: balanceData.buying_power,
    accountBalance: balanceData.account_balance,
    openPn1: balanceData.open_pnl,
    createdAt: new Date(),
  };
}

function orderUniversalSymbol(order) {
  const u = order.universal_symbol;
  if (u && typeof u === "object") return u;

  if (typeof order.symbol === "string" && order.symbol) return { id: order.symbol };
  return null;
}

function transformOrders(orders, accountId, userId) {
  if (!Array.isArray(orders)) return [];
  return orders.map((order) => ({
    accountId,
    userId,
    brokerage_order_id: order.brokerage_order_id,
    status: order.status,
    universal_symbol: orderUniversalSymbol(order),
    option_symbol: order.option_symbol || null,
    action: order.action,
    total_quantity: order.total_quantity,
    open_quantity: order.open_quantity,
    canceled_quantity: order.canceled_quantity,
    filled_quantity: order.filled_quantity,
    execution_price: order.execution_price,
    limit_price: order.limit_price,
    stop_price: order.stop_price,
    order_type: order.order_type,
    time_in_force: order.time_in_force,
    time_placed: order.time_placed ? new Date(order.time_placed) : null,
    time_updated: order.time_updated ? new Date(order.time_updated) : null,
    time_executed: order.time_executed ? new Date(order.time_executed) : null,
    createdAt: new Date(),
  }));
}

function transformActivities(activities, accountId, userId) {
  return activities.map((activity) => {
    const dateVal = activity.trade_date || activity.date || null;
    return {
      accountId,
      userId,
      activityId: activity.id,
      externalReferenceId: activity.external_reference_id || null,
      type: activity.type,
      date: dateVal ? new Date(dateVal) : null,
      trade_date: activity.trade_date ? new Date(activity.trade_date) : null,
      settlement_date: activity.settlement_date
        ? new Date(activity.settlement_date)
        : null,
      description: activity.description,
      symbol: activity.symbol?.symbol || activity.symbol || null,
      symbolObj: activity.symbol || null,
      option_symbol: activity.option_symbol || null,
      units: activity.units ?? null,
      quantity: activity.units ?? activity.quantity ?? null,
      price: activity.price ?? null,
      amount: activity.amount ?? null,
      currency: activity.currency?.code || activity.currency || null,
      currencyObj: activity.currency || null,
      fee: activity.fee ?? null,
      fees: activity.fee ?? activity.fees ?? null,
      fx_rate: activity.fx_rate ?? null,
      netAmount: activity.net_amount ?? activity.netAmount ?? null,
      raw: activity,
      createdAt: new Date(),
    };
  });
}

function transformAccount(account, userId) {
  if (!account) return null;
  return {
    userId,
    brokerageAuthorizationId:
      account.brokerage_authorization || account.authorizationId,
    accountId: account.id,
    accountName: account.name,
    number: account.number,
    currency: account.currency?.code || account.currency || "USD",
    institutionName: account.institution_name,
    createdDate: account.created_date ? new Date(account.created_date) : null,
    raw_type: account.raw_type,
    status: account.status,
  };
}

function transformAccountDetail(accountDetail, userId) {
  return {
    userId,
    accountId: accountDetail.id,
    brokerageAuthorizationId: accountDetail.brokerage_authorization,
    name: accountDetail.name,
    number: accountDetail.number,
    institutionName: accountDetail.institution_name,
    status: accountDetail.status,
    rawType: accountDetail.raw_type,
  };
}

export async function syncAllAccountData(
  userId,
  userSecret,
  accountId,
  options = {},
) {
  const { days = 30, startDate = null, endDate = null } = options;

  console.log(`Starting comprehensive data sync for account ${accountId}`);

  const [
    accounts,
    accountDetail,
    balances,
    holdings,
    positions,
    orders,
    activities,
  ] = await Promise.all([
    listAccounts(userId, userSecret),
    getAccountDetails(userId, userSecret, accountId),
    getAccountBalances(userId, userSecret, accountId),
    getAccountHoldings(userId, userSecret, accountId),
    getAccountPositions(userId, userSecret, accountId),
    getAccountOrders(userId, userSecret, accountId, days),
    listAllAccountActivities(userId, userSecret, accountId, {
      days,
      startDate,
      endDate,
    }),
  ]);

  const account = Array.isArray(accounts)
    ? accounts.find((acc) => acc.id === accountId)
    : null;

  const holdingsArr = Array.isArray(holdings)
    ? holdings
    : holdings?.holdings || [];
  const positionsArr = Array.isArray(positions) ? positions : [];
  const ordersArr = Array.isArray(orders) ? orders : [];

  return {
    account: transformAccount(account, userId),
    accountDetail: accountDetail
      ? transformAccountDetail(accountDetail, userId)
      : null,
    balances: transformBalances(balances, accountId, userId),
    holdings: transformHoldings(holdingsArr, accountId, userId),
    positions: transformPositions(positionsArr, accountId, userId),
    orders: transformOrders(ordersArr, accountId, userId),
    activities: transformActivities(activities, accountId, userId),
  };
}

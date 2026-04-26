import mongoose from "mongoose";

const accountPositionsSchema = new mongoose.Schema(
  {

    userId: {
      type: String,
      required: true,
      index: true,
    },

    asOfDate: {
      type: Date,
      required: true,
    },

    accountId: {
      type: String,
      required: true,
      index: true,
    },

    symbolTicker: { type: String, required: true },
    listingExchangeCode: { type: String, default: null },

    positionSymbol: {

      symbol: {
        id: { type: String },
        symbol: { type: String },
        raw_symbol: { type: String },
        description: { type: String, default: null },
        currency: {
          id: { type: String },
          code: { type: String },
          name: { type: String },
        },
        exchange: {
          id: { type: String },
          code: { type: String },
          mic_code: { type: String },
          name: { type: String },
          timezone: { type: String },
          start_time: { type: String },
          close_time: { type: String },
          suffix: { type: String, default: null },
        },
        type: {
          id: { type: String },
          code: { type: String },
          description: { type: String },
        },
        figi_code: { type: String, default: null },
        figi_instrument: {
          figi_code: { type: String, default: null },
          figi_share_class: { type: String, default: null },
        },
      },

      id: { type: String },
      description: { type: String, default: null },
      local_id: { type: String, default: null },
      is_quotable: { type: Boolean, default: null },
      is_tradable: { type: Boolean, default: null },
    },

    units: { type: Number, default: null },
    price: { type: Number, default: null },
    open_pnl: { type: Number, default: null },
    average_purchase_price: { type: Number, default: null },

    currency: {
      id: { type: String },
      code: { type: String },
      name: { type: String },
    },

    cash_equivalent: { type: Boolean, default: null },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

accountPositionsSchema.index({ userId: 1, symbolTicker: 1, asOfDate: -1 });

const AccountPositions = mongoose.models.SnapTradeAccountPositionsV2 || mongoose.model(
  "SnapTradeAccountPositionsV2",
  accountPositionsSchema
);

export default AccountPositions;

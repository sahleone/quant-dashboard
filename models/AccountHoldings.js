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
      default: Date.now,
      required: true,
    },

    accountId: {
      type: String,
      required: true,
    },

    symbol: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: false,
      default: "Unknown Security",
    },

    currency: {
      type: String,
      required: true,
    },

    units: { type: Number, required: true },

    price: {
      type: Number,
      required: true,
    },

    averagePurchasePrice: { type: Number, required: true },

    marketValue: { type: Number, required: true },

    typeCode: {
      type: String,
      required: false,
      default: "",
    },

    typeDescription: {
      type: String,
      required: false,
      default: "",
    },

    openPnl: {
      type: Number,
      default: 0,
    },

    fractionalUnits: {
      type: Number,
      default: 0,
    },

    exchange: {
      type: String,
      default: "Unknown",
    },

    isCashEquivalent: {
      type: Boolean,
      default: false,
    },

    symbolDetails: {
      rawSymbol: String,

      figiCode: String,

      exchangeCode: String,

      exchangeName: String,

      timezone: String,

      startTime: String,

      closeTime: String,

      suffix: String,

      typeCode: String,

      typeDescription: String,

      localId: String,

      isQuotable: Boolean,

      isTradable: Boolean,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

accountPositionsSchema.index({ userId: 1, accountId: 1, asOfDate: -1 });

const AccountPositions = mongoose.models.SnapTradeAccountPositions || mongoose.model(
  "SnapTradeAccountPositions",
  accountPositionsSchema
);

export default AccountPositions;

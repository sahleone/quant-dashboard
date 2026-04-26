import mongoose from "mongoose";

const accountBalancesSchema = new mongoose.Schema(
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
    },

    currency: {
      id: { type: String },
      code: { type: String },
      name: { type: String },
    },
    cash: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    buyingPower: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,

    },
    accountBalance: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    openPn1: {
      type: Number,
      default: null,
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

accountBalancesSchema.index({ accountId: 1, asOfDate: 1 }, { unique: true });

const AccountBalances = mongoose.models.SnapTradeAccountBalances || mongoose.model(
  "SnapTradeAccountBalances",
  accountBalancesSchema
);

export default AccountBalances;

import mongoose from "mongoose";

const portfolioTimeseriesSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    accountId: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    stockValue: {
      type: Number,
      required: true,
    },
    cashValue: {
      type: Number,
      required: true,
    },
    totalValue: {
      type: Number,
      required: true,
    },
    depositWithdrawal: {
      type: Number,
      default: 0,
    },
    externalFlowCumulative: {
      type: Number,
      default: 0,
    },
    simpleReturns: {
      type: Number,
      default: null,
    },
    dailyTWRReturn: {
      type: Number,
      default: null,
    },
    twr1Day: {
      type: Number,
      default: null,
    },
    twr3Months: {
      type: Number,
      default: null,
    },
    twrYearToDate: {
      type: Number,
      default: null,
    },
    twrAllTime: {
      type: Number,
      default: null,
    },
    cumReturn: {
      type: Number,
      default: null,
    },
    equityIndex: {
      type: Number,
      default: null,
    },
    positions: [
      {
        symbol: String,
        units: Number,
        price: Number,
        value: Number,
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

portfolioTimeseriesSchema.index(
  { userId: 1, accountId: 1, date: 1 },
  { unique: true }
);

const PortfolioTimeseries = mongoose.models.PortfolioTimeseries || mongoose.model(
  "PortfolioTimeseries",
  portfolioTimeseriesSchema
);

export default PortfolioTimeseries;

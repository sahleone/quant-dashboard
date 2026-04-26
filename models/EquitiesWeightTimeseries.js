import mongoose from "mongoose";

const equitiesWeightTimeseriesSchema = new mongoose.Schema(
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
    symbol: {
      type: String,
      required: true,
      index: true,
    },
    units: {
      type: Number,
      required: true,
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

equitiesWeightTimeseriesSchema.index({ accountId: 1, date: 1, symbol: 1 }, { unique: true });

const EquitiesWeightTimeseries = mongoose.models.EquitiesWeightTimeseries || mongoose.model(
  "EquitiesWeightTimeseries",
  equitiesWeightTimeseriesSchema
);

export default EquitiesWeightTimeseries;


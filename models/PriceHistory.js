import mongoose from "mongoose";

const priceHistorySchema = new mongoose.Schema(
  {
    symbol: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    close: {
      type: Number,
      required: true,
    },
    open: {
      type: Number,
      default: null,
    },
    high: {
      type: Number,
      default: null,
    },
    low: {
      type: Number,
      default: null,
    },
    volume: {
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

priceHistorySchema.index({ symbol: 1, date: 1 }, { unique: true });

const PriceHistory = mongoose.models.PriceHistory || mongoose.model("PriceHistory", priceHistorySchema);

export default PriceHistory;


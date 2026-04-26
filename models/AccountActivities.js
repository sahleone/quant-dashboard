import mongoose from "mongoose";

const activitiesSchema = new mongoose.Schema(
  {

    accountId: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    activityId: { type: String, required: true, index: true },
    externalReferenceId: { type: String, default: null },
    type: { type: String, default: null },

    date: { type: Date, default: null, index: true },
    trade_date: { type: Date, default: null },
    settlement_date: { type: Date, default: null },
    description: { type: String, default: null },

    symbol: { type: String, default: null },
    symbolObj: { type: mongoose.Schema.Types.Mixed, default: null },
    option_symbol: { type: mongoose.Schema.Types.Mixed, default: null },

    quantity: { type: Number, default: null },
    units: { type: Number, default: null },
    price: { type: Number, default: null },
    amount: { type: Number, default: null },

    currency: { type: String, default: null },
    currencyObj: { type: mongoose.Schema.Types.Mixed, default: null },
    fee: { type: Number, default: null },
    fees: { type: mongoose.Schema.Types.Mixed, default: null },
    fx_rate: { type: Number, default: null },

    option_type: { type: String, default: null },
    institution: { type: String, default: null },
    netAmount: { type: Number, default: null },

    raw: { type: mongoose.Schema.Types.Mixed, default: null },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

activitiesSchema.index({ accountId: 1, activityId: 1 }, { unique: true });

activitiesSchema.index({ accountId: 1, trade_date: -1 });
activitiesSchema.index({ accountId: 1, type: 1, date: -1 });

const Activities = mongoose.models.SnapTradeAccountActivities || mongoose.model(
  "SnapTradeAccountActivities",
  activitiesSchema
);

export default Activities;

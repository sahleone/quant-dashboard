import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    brokerageAuthorizationId: {
      type: String,
      required: true,
    },
    accountId: {
      type: String,
      required: true,
      unique: true,
    },
    accountName: {
      type: String,
      required: true,
    },
    number: {
      type: String,
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
    },
    institutionName: {
      type: String,
      required: true,
    },
    createdDate: {
      type: Date,
    },
    syncStatus: {
      transactions: {
        initial_sync_completed: { type: Boolean },
        last_successful_sync: { type: Date },
        first_transaction_date: { type: Date },
      },
      holdings: {
        initial_sync_completed: { type: Boolean },
        last_successful_sync: { type: Date },
      },
    },
    balance: {
      total: {
        amount: { type: Number },
        currency: { type: String },
      },
    },
    raw_type: {
      type: String,
    },
    status: {
      type: String,
      enum: ["open", "closed", "archived"],
      default: null,
    },
  },
  { timestamps: true }
);

const Account = mongoose.models.SnapTradeAccount || mongoose.model("SnapTradeAccount", accountSchema);

export default Account;

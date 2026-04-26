import mongoose from "mongoose";

const accountDetailSchema = new mongoose.Schema(
  {

    userId: {
      type: String,
      index: true,
    },

    accountId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    brokerageAuthorizationId: {
      type: String,
      required: true,
      index: true,
    },

    name: { type: String, default: null },
    number: { type: String },
    institutionName: { type: String },
    createdDate: { type: Date },

    syncStatus: {
      transactions: {
        initial_sync_completed: { type: Boolean, default: null },
        last_successful_sync: { type: Date, default: null },
        first_transaction_date: { type: Date, default: null },
      },
      holdings: {
        initial_sync_completed: { type: Boolean, default: null },
        last_successful_sync: { type: Date, default: null },
      },
    },

    balance: {
      total: {
        amount: { type: Number, default: null },
        currency: { type: String },
      },
    },

    status: {
      type: String,
      enum: ["open", "closed", "archived", null],
      default: null,
    },
    rawType: { type: String, default: null },
  },
  { timestamps: true }
);

const AccountDetails = mongoose.models.SnapTradeAccountDetails || mongoose.model(
  "SnapTradeAccountDetails",
  accountDetailSchema
);

export default AccountDetails;

import mongoose from "mongoose";

const connectionSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(),
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  connectionId: {
    type: String,
    required: true,
    unique: true,
  },

  authorizationId: {
    type: String,
  },
  brokerageName: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["ACTIVE", "INACTIVE", "PENDING", "ERROR"],
    default: "ACTIVE",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastSyncDate: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

connectionSchema.index({ userId: 1, connectionId: 1 });
connectionSchema.index({ userId: 1, isActive: 1 });

connectionSchema.index({ authorizationId: 1 }, { sparse: true });

connectionSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

connectionSchema.statics.getConnection = async function (userId) {
  return this.findOne({ userId, isActive: true });
};

const Connection = mongoose.models.SnapTradeConnection || mongoose.model("SnapTradeConnection", connectionSchema);

export default Connection;

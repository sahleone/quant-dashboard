import mongoose from "mongoose";

const famaFrenchFactorsSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    mktRf: {
      type: Number,
      required: true,
    },
    smb: {
      type: Number,
      required: true,
    },
    hml: {
      type: Number,
      required: true,
    },
    rf: {
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

famaFrenchFactorsSchema.index({ date: 1 }, { unique: true });

const FamaFrenchFactors = mongoose.models.FamaFrenchFactors || mongoose.model(
  "FamaFrenchFactors",
  famaFrenchFactorsSchema
);

export default FamaFrenchFactors;

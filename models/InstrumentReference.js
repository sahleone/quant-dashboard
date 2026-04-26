import mongoose from 'mongoose'

const schema = new mongoose.Schema(
  {
    tickerUpper: { type: String, required: true, unique: true },

    classificationOutcome: {
      type: String,
      enum: ['classified', 'confirmed_absent', 'unresolved'],
      default: 'unresolved',
    },

    market: {
      type: String,
      enum: {
        values: [null, 'stocks', 'crypto', 'fx', 'otc', 'indices'],
        message: 'Invalid market enum',
      },
      default: null,
    },

    massiveTicker: { type: String, default: null },
    active: { type: Boolean, default: null },
    type: { type: String, default: null },
    locale: { type: String, default: null },
    primaryExchange: { type: String, default: null },
    name: { type: String, default: null },

    lastCheckedAt: { type: Date, required: true },
    lastSuccessAt: { type: Date, default: null },

    lastHttpStatus: { type: Number, default: null },
    lastError: { type: String, default: null },
    lastRequestId: { type: String, default: null },

    ambiguityCandidates: { type: [String], default: [] },
  },
  { timestamps: false }
)

schema.index({ lastSuccessAt: 1 })

export default mongoose.models.InstrumentReference ||
  mongoose.model('InstrumentReference', schema)

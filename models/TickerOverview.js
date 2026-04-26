import mongoose from 'mongoose'

const addressSchema = new mongoose.Schema(
  {
    address1: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    postalCode: { type: String, default: null },
  },
  { _id: false }
)

const schema = new mongoose.Schema(
  {
    tickerUpper: { type: String, required: true, unique: true },

    name: { type: String, default: null },
    description: { type: String, default: null },
    type: { type: String, default: null },
    market: { type: String, default: null },
    locale: { type: String, default: null },
    active: { type: Boolean, default: null },

    marketCap: { type: Number, default: null },
    totalEmployees: { type: Number, default: null },
    roundLot: { type: Number, default: null },

    sicCode: { type: String, default: null },
    sicDescription: { type: String, default: null },

    homepageUrl: { type: String, default: null },
    currencyName: { type: String, default: null },
    primaryExchange: { type: String, default: null },

    brandingIconUrl: { type: String, default: null },
    brandingLogoUrl: { type: String, default: null },

    address: { type: addressSchema, default: null },

    listDate: { type: String, default: null },
    cik: { type: String, default: null },
    tickerRoot: { type: String, default: null },
    tickerSuffix: { type: String, default: null },

    shareClassSharesOutstanding: { type: Number, default: null },
    weightedSharesOutstanding: { type: Number, default: null },

    compositeFigi: { type: String, default: null },
    shareClassFigi: { type: String, default: null },

    lastCheckedAt: { type: Date, required: true },
    lastSuccessAt: { type: Date, default: null },
    lastHttpStatus: { type: Number, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: false }
)

schema.index({ lastSuccessAt: 1 })

export default mongoose.models.TickerOverview ||
  mongoose.model('TickerOverview', schema)

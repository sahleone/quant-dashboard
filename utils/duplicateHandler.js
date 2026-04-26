export async function upsertWithDuplicateCheck(Model, records, uniqueFields, recordType) {
  const result = {
    total: records.length,
    upserted: 0,
    duplicates: 0,
    errors: 0,
    duplicateDetails: [],
    recordType,
  }

  for (const record of records) {
    try {
      const query = {}
      Object.keys(uniqueFields).forEach((key) => {
        query[key] = record[uniqueFields[key]]
      })

      const existingRecord = await Model.findOne(query)

      if (existingRecord) {
        result.duplicates++
        result.duplicateDetails.push({
          ...query,
          reason: `Duplicate found based on ${Object.keys(query).join(', ')}`,
        })
        await Model.findOneAndUpdate(query, record, { upsert: true })
      } else {
        await Model.create(record)
        result.upserted++
      }
    } catch (error) {
      console.error(`Error upserting ${recordType} record:`, error)
      result.errors++
    }
  }

  return result
}

export const UNIQUE_FIELD_MAPPINGS = {
  AccountHoldings: {
    accountId: 'accountId',
    asOfDate: 'asOfDate',
    symbol: 'symbol',
  },
  AccountPositions: {
    accountId: 'accountId',
    asOfDate: 'asOfDate',
    symbolTicker: 'symbolTicker',
  },
  AccountOrders: {
    accountId: 'accountId',
    brokerage_order_id: 'brokerage_order_id',
  },
  AccountBalances: {
    accountId: 'accountId',
    asOfDate: 'asOfDate',
  },
  Activities: {
    accountId: 'accountId',
    activityId: 'activityId',
  },
}

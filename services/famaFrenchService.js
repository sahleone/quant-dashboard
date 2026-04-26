import https from 'https'
import http from 'http'
import { inflateRawSync } from 'zlib'
import FamaFrenchFactors from '@/models/FamaFrenchFactors'

const FF_ZIP_URL = 'https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_daily_CSV.zip'
const FALLBACK_ANNUAL_RF = 0.04
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function parseFamaFrenchCSV(csvText) {
  const lines = csvText.split(/\r?\n/)
  const records = []
  let headerFound = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!headerFound) {
      if (trimmed.includes('Mkt-RF')) headerFound = true
      continue
    }
    if (trimmed === '') break

    const parts = trimmed.split(',').map((s) => s.trim())
    if (parts.length < 5) continue

    const dateStr = parts[0]
    if (!/^\d{8}$/.test(dateStr)) continue

    const year = parseInt(dateStr.slice(0, 4), 10)
    const month = parseInt(dateStr.slice(4, 6), 10) - 1
    const day = parseInt(dateStr.slice(6, 8), 10)
    const date = new Date(Date.UTC(year, month, day))

    const mktRf = parseFloat(parts[1]) / 100
    const smb = parseFloat(parts[2]) / 100
    const hml = parseFloat(parts[3]) / 100
    const rf = parseFloat(parts[4]) / 100

    if ([mktRf, smb, hml, rf].some((v) => !Number.isFinite(v))) continue
    records.push({ date, mktRf, smb, hml, rf })
  }

  return records
}

export async function downloadFamaFrenchCSV() {
  return new Promise((resolve, reject) => {
    const request = https.get(FF_ZIP_URL, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = response.headers.location
        const getter = redirectUrl.startsWith('https') ? https : http
        getter.get(redirectUrl, handleResponse).on('error', reject)
        return
      }
      handleResponse(response)
    })

    request.on('error', reject)
    request.setTimeout(30000, () => {
      request.destroy(new Error('Download timed out after 30 seconds'))
    })

    function handleResponse(res) {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} from French Data Library`))
        res.resume()
        return
      }
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        try {
          const zipBuffer = Buffer.concat(chunks)
          resolve(extractCSVFromZip(zipBuffer))
        } catch (err) {
          reject(err)
        }
      })
      res.on('error', reject)
    }
  })
}

function extractCSVFromZip(zipBuffer) {
  const LOCAL_HEADER_SIG = 0x04034b50
  if (zipBuffer.length < 30) throw new Error('Zip buffer too small')
  const sig = zipBuffer.readUInt32LE(0)
  if (sig !== LOCAL_HEADER_SIG) throw new Error('Not a valid zip file')

  const compressionMethod = zipBuffer.readUInt16LE(8)
  const compressedSize = zipBuffer.readUInt32LE(18)
  const filenameLength = zipBuffer.readUInt16LE(26)
  const extraLength = zipBuffer.readUInt16LE(28)
  const dataStart = 30 + filenameLength + extraLength

  if (compressionMethod === 0) {
    return zipBuffer.slice(dataStart, dataStart + compressedSize).toString('utf-8')
  }
  if (compressionMethod === 8) {
    const compressed = zipBuffer.slice(dataStart, dataStart + compressedSize)
    return inflateRawSync(compressed).toString('utf-8')
  }
  throw new Error(`Unsupported zip compression method: ${compressionMethod}`)
}

async function isCacheStale() {
  const newest = await FamaFrenchFactors.findOne().sort({ date: -1 }).select('date createdAt').lean()
  if (!newest) return true
  const age = Date.now() - new Date(newest.createdAt).getTime()
  return age > CACHE_TTL_MS
}

export async function refreshCache() {
  console.log('[FamaFrenchService] Downloading factor data')
  const csvText = await downloadFamaFrenchCSV()
  const records = parseFamaFrenchCSV(csvText)

  if (records.length === 0) throw new Error('Parsed 0 records from Fama-French CSV')

  console.log(`[FamaFrenchService] Parsed ${records.length} daily records. Upserting...`)

  const CHUNK_SIZE = 5000
  let totalInserted = 0
  let totalModified = 0

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE)
    const ops = chunk.map((r) => ({
      updateOne: {
        filter: { date: r.date },
        update: { $set: { mktRf: r.mktRf, smb: r.smb, hml: r.hml, rf: r.rf, createdAt: new Date() } },
        upsert: true,
      },
    }))
    const result = await FamaFrenchFactors.bulkWrite(ops, { ordered: false })
    totalInserted += result.upsertedCount || 0
    totalModified += result.modifiedCount || 0
  }

  console.log(`[FamaFrenchService] Cache refreshed: ${totalInserted} inserted, ${totalModified} modified`)
  return { inserted: totalInserted, modified: totalModified, total: records.length }
}

async function ensureFreshCache() {
  try {
    if (await isCacheStale()) await refreshCache()
  } catch (err) {
    console.warn(`[FamaFrenchService] Failed to refresh cache: ${err.message}. Using fallback.`)
  }
}

export async function getAnnualizedRiskFreeRate() {
  await ensureFreshCache()
  const latest = await FamaFrenchFactors.findOne().sort({ date: -1 }).select('rf date').lean()
  if (!latest) {
    console.warn(`[FamaFrenchService] No cached data. Using fallback RF = ${FALLBACK_ANNUAL_RF}`)
    return FALLBACK_ANNUAL_RF
  }
  return latest.rf * 252
}

export async function getDailyRates(startDate, endDate) {
  await ensureFreshCache()
  return FamaFrenchFactors.find({ date: { $gte: startDate, $lte: endDate } })
    .sort({ date: 1 })
    .select('date mktRf smb hml rf -_id')
    .lean()
}

export async function getDailyRiskFreeRate(date) {
  await ensureFreshCache()
  const record = await FamaFrenchFactors.findOne({ date: { $lte: date } }).sort({ date: -1 }).select('rf').lean()
  return record ? record.rf : null
}

const famaFrenchService = { parseFamaFrenchCSV, downloadFamaFrenchCSV, refreshCache, getAnnualizedRiskFreeRate, getDailyRates, getDailyRiskFreeRate }
export default famaFrenchService

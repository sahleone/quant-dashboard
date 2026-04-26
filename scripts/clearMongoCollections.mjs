/**
 * Drops non-system collections in the database from MONGODB_URI, except
 * preserved collections (default: users — Mongoose model "user").
 * Loads .env.local from the project root when MONGODB_URI is unset.
 *
 * Usage:
 *   node scripts/clearMongoCollections.mjs --dry-run
 *   node scripts/clearMongoCollections.mjs --force
 *   node scripts/clearMongoCollections.mjs --force --keep=users,othercoll
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnvLocal() {
  const p = resolve(root, '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

const argv = process.argv.slice(2)
const args = new Set(argv)
const dryRun = args.has('--dry-run')
const force = args.has('--force')

const keepArg = argv.find((a) => a.startsWith('--keep='))
let keepList = (keepArg ? keepArg.slice('--keep='.length) : 'users')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)
if (keepList.length === 0) keepList = ['users']
const keepSet = new Set(keepList)

loadEnvLocal()

const uri = process.env.MONGODB_URI?.trim()
if (!uri) {
  console.error('MONGODB_URI is not set. Add it to .env.local or the environment.')
  process.exit(1)
}

if (!dryRun && !force) {
  console.error(
    'Refusing to drop collections without --force (use --dry-run to list only).'
  )
  process.exit(1)
}

await mongoose.connect(uri)
const db = mongoose.connection.db
const listed = await db.listCollections().toArray()
const allNames = listed
  .map((c) => c.name)
  .filter((n) => !n.startsWith('system.'))
  .sort()

const preserved = allNames.filter((n) => keepSet.has(n.toLowerCase()))
const toDrop = allNames.filter((n) => !keepSet.has(n.toLowerCase()))

if (dryRun) {
  console.log('Dry run — preserving', preserved.length, 'collection(s):')
  for (const n of preserved) console.log('  (keep)', n)
  console.log('Would drop', toDrop.length, 'collection(s):')
  for (const n of toDrop) console.log(' ', n)
  await mongoose.disconnect()
  process.exit(0)
}

for (const name of toDrop) {
  try {
    await db.collection(name).drop()
    console.log('Dropped:', name)
  } catch (e) {
    if (e?.codeName === 'NamespaceNotFound') continue
    throw e
  }
}

console.log(
  'Done. Dropped',
  toDrop.length,
  'collection(s); kept',
  preserved.length,
  '—',
  preserved.join(', ') || '(none)'
)
await mongoose.disconnect()
process.exit(0)

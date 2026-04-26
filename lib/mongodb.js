import mongoose from 'mongoose'

let cached = global.mongoose
if (!cached) cached = global.mongoose = { conn: null, promise: null }

export async function connectDB() {
  const uri = process.env.MONGODB_URI
  if (!uri?.trim()) {
    throw new Error('MONGODB_URI is not set. Add it to .env.local.')
  }
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri).then((m) => m)
  }
  try {
    cached.conn = await cached.promise
    return cached.conn
  } catch (err) {
    cached.promise = null
    throw err
  }
}

import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mongoose must load from node_modules; bundling it breaks resolution in dev.
  serverExternalPackages: ['mongoose'],
  // Multiple lockfiles in the repo parent: pin the app root so resolution matches this project.
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig

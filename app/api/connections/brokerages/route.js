import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { listBrokerages } from '@/services/referenceDataClient'

function toPublicBrokerage(b) {
  return {
    slug: b.slug || '',
    name: b.name || '',
    displayName: b.display_name || b.name || b.slug || 'Unknown',
    logoUrl: b.aws_s3_square_logo_url || b.aws_s3_logo_url || null,
    enabled: b.enabled !== false,
    maintenanceMode: b.maintenance_mode === true,
    degraded: b.is_degraded === true,
  }
}

export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
    }

    const raw = await listBrokerages()
    const brokerages = raw
      .map(toPublicBrokerage)
      .filter((b) => b.slug)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }))

    return NextResponse.json({ brokerages })
  } catch (error) {
    console.error('Error listing brokerages:', error)
    return NextResponse.json(
      { error: { code: 'BROKERAGES_LIST_FAILED', message: 'Failed to load brokerages' } },
      { status: 500 }
    )
  }
}

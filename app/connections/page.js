'use client'

import useAuth from '@/hooks/useAuth'
import Connections from '@/components/connections/Connections'

export default function ConnectionsPage() {
  const user = useAuth()
  if (!user) return null

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Connections</h2>
        <p>Your linked brokerage accounts.</p>
      </div>

      <div className="card">
        <Connections />
      </div>
    </div>
  )
}

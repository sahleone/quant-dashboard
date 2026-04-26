'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { authenticatedGet, authenticatedPost } from '@/utils/apiClient'

const INTEGRATIONS_URL = 'https://snaptrade.com/brokerage-integrations'
const BROKERAGES_DOC_URL = 'https://support.snaptrade.com/brokerages'

function ConnectBrokerage({ onConnected }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [brokerages, setBrokerages] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [listError, setListError] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)

  const loadBrokerages = useCallback(async () => {
    setLoadingList(true)
    setListError(null)
    try {
      const res = await authenticatedGet('/api/connections/brokerages')
      setBrokerages(res.data?.brokerages || [])
    } catch (err) {
      console.error('ConnectBrokerage list error:', err)
      setListError('Could not load brokerage list. You can still open the connection portal.')
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    if (modalOpen) {
      loadBrokerages()
    } else {
      setSearch('')
      setError(null)
    }
  }, [modalOpen, loadBrokerages])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return brokerages
    return brokerages.filter(
      (b) =>
        b.displayName.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q)
    )
  }, [brokerages, search])

  const startPortal = async (brokerSlug) => {
    setConnecting(true)
    setError(null)
    try {
      const payload = brokerSlug ? { broker: brokerSlug } : {}
      const res = await authenticatedPost('/api/connections/portal', payload)
      const { redirectUrl } = res.data
      if (redirectUrl) {
        setModalOpen(false)
        if (onConnected) onConnected()
        window.location.href = redirectUrl
      } else {
        setError('Could not get connection link')
      }
    } catch (err) {
      console.error('ConnectBrokerage error:', err)
      setError('Failed to open connection portal')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div>
      <button type="button" className="btn-primary" onClick={() => setModalOpen(true)} disabled={connecting}>
        {connecting ? 'Opening portal…' : '+ Connect Brokerage'}
      </button>
      {error && !modalOpen && (
        <p className="error" style={{ marginTop: '0.5rem' }}>
          {error}
        </p>
      )}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="connect-brokerage-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => !connecting && setModalOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !connecting) setModalOpen(false)
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 520,
              maxHeight: 'min(90vh, 640px)',
              display: 'flex',
              flexDirection: 'column',
              margin: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div>
                <h3 id="connect-brokerage-title" style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>
                  Choose a brokerage
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Select where you want to connect. You can also open SnapTrade&apos;s portal without pre-selecting a
                  firm.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', flexShrink: 0 }}
                disabled={connecting}
                onClick={() => setModalOpen(false)}
              >
                Close
              </button>
            </div>

            <input
              type="search"
              placeholder="Search brokerages…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginTop: '1rem' }}
              autoFocus
            />

            {listError && (
              <p className="error" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                {listError}
              </p>
            )}

            <div
              style={{
                marginTop: '0.75rem',
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              {loadingList ? (
                <div className="loading" style={{ padding: '2rem 1rem' }}>
                  Loading brokerages…
                </div>
              ) : (
                filtered.map((b) => {
                  const available = b.enabled && !b.maintenanceMode
                  const hint = !b.enabled ? 'Unavailable' : b.maintenanceMode ? 'Maintenance' : b.degraded ? 'Limited' : null
                  return (
                    <button
                      key={b.slug}
                      type="button"
                      disabled={!available || connecting}
                      className="btn-secondary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        opacity: available ? 1 : 0.45,
                        cursor: available ? 'pointer' : 'not-allowed',
                      }}
                      onClick={() => available && startPortal(b.slug)}
                    >
                      {b.logoUrl ? (
                        <Image src={b.logoUrl} alt="" width={32} height={32} style={{ borderRadius: 6, objectFit: 'contain' }} unoptimized />
                      ) : (
                        <span
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: 'var(--color-surface)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '0.7rem',
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          {b.slug.slice(0, 2)}
                        </span>
                      )}
                      <span style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600 }}>{b.displayName}</span>
                        {hint && (
                          <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                            {hint}
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            {error && (
              <p className="error" style={{ marginTop: '0.65rem', fontSize: '0.85rem' }}>
                {error}
              </p>
            )}

            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button type="button" className="btn-secondary" disabled={connecting} onClick={() => startPortal()}>
                Open connection portal (choose there)
              </button>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Full directory:{' '}
                <a href={INTEGRATIONS_URL} target="_blank" rel="noopener noreferrer">
                  SnapTrade brokerage integrations
                </a>
                {' · '}
                <a href={BROKERAGES_DOC_URL} target="_blank" rel="noopener noreferrer">
                  Brokerage slugs and docs
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConnectBrokerage

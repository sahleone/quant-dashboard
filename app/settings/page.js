'use client'

import { useState, useEffect, useContext, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useAuth from '@/hooks/useAuth'
import UserContext from '@/context/UserContext'
import { authenticatedPost } from '@/utils/apiClient'
import Connections from '@/components/connections/Connections'
import Preferences from '@/components/preferences/Preferences'

export default function SettingsPage() {
  const user = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser } = useContext(UserContext)
  const [activeTab, setActiveTab] = useState('connections')
  const [oauthMessage, setOauthMessage] = useState(null)
  const hasProcessedOauthCallback = useRef(false)

  useEffect(() => {
    if (hasProcessedOauthCallback.current) return

    const code = searchParams.get('code')
    const status = searchParams.get('status')
    const connectionId = searchParams.get('connection_id') || searchParams.get('authorizationId')
    const error = searchParams.get('error')

    const shouldProcessCallback = Boolean(
      (status === 'SUCCESS') ||
      code ||
      error
    )

    if (!shouldProcessCallback) return
    hasProcessedOauthCallback.current = true

    if (status === 'SUCCESS') {
      const handleSuccess = async () => {
        try {

          if (connectionId) {
            await authenticatedPost('/api/connections/exchange', { authorizationId: connectionId })
          } else {

            await authenticatedPost('/api/connections/refresh', {})
            await authenticatedPost('/api/metrics/calculate', { fullSync: false })
          }
          setOauthMessage({ type: 'success', text: 'Brokerage connected successfully! Syncing your data...' })
        } catch (err) {
          console.error('OAuth SUCCESS callback error:', err)
          setOauthMessage({ type: 'error', text: 'Connection completed but sync failed. Please click "Refresh Data".' })
        } finally {
          router.replace('/settings')
        }
      }
      handleSuccess()
      return
    }

    if (code) {
      const exchangeCode = async () => {
        try {
          await authenticatedPost('/api/connections/exchange', { authorizationId: code })
          setOauthMessage({ type: 'success', text: 'Brokerage connected successfully!' })
        } catch (err) {
          console.error('OAuth callback error:', err)
          setOauthMessage({ type: 'error', text: 'Could not complete brokerage connection.' })
        } finally {
          router.replace('/settings')
        }
      }
      exchangeCode()
      return
    }

    if (error) {
      setOauthMessage({ type: 'error', text: `Connection error: ${error}` })
      router.replace('/settings')
    }
  }, [searchParams, router])

  if (!user) return null

  const tabs = [
    { id: 'connections', label: 'Connections' },
    { id: 'preferences', label: 'Preferences' },
    { id: 'account', label: 'Account' },
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Settings</h2>
        <p>Manage your account and brokerage connections</p>
      </div>

      {oauthMessage && (
        <div
          className={oauthMessage.type === 'success' ? '' : 'error-msg'}
          style={{
            marginBottom: '1.5rem', padding: '1rem 1.25rem', borderRadius: 'var(--radius)',
            background: oauthMessage.type === 'success' ? 'rgba(0,212,170,0.1)' : undefined,
            border: oauthMessage.type === 'success' ? '1px solid rgba(0,212,170,0.3)' : undefined,
            color: oauthMessage.type === 'success' ? 'var(--color-accent)' : undefined,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>{oauthMessage.text}</span>
          <button onClick={() => setOauthMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '1.1rem' }}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${activeTab === tab.id ? 'var(--color-primary)' : 'transparent'}`,
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
              padding: '0.65rem 1.1rem', marginBottom: '-1px', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === 'connections' && <Connections />}
        {activeTab === 'preferences' && <Preferences />}
        {activeTab === 'account' && <AccountSection user={user} />}
      </div>
    </div>
  )
}

function AccountSection({ user }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setMessage({ type: 'error', text: 'New passwords do not match.' }); return }
    if (newPassword.length < 8) { setMessage({ type: 'error', text: 'Password must be at least 8 characters.' }); return }

    setSaving(true)
    setMessage(null)
    try {
      await authenticatedPost('/api/user/change-password', { currentPassword, newPassword })
      setMessage({ type: 'success', text: 'Password updated successfully!' })
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (err) {
      setMessage({ type: 'error', text: 'Could not update password.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Account Info</h3>
        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ color: 'var(--color-text-muted)', minWidth: 100 }}>Name:</span>
            <span>{user?.firstName} {user?.lastName}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ color: 'var(--color-text-muted)', minWidth: 100 }}>Email:</span>
            <span>{user?.email || '—'}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Change Password</h3>
        <form onSubmit={handlePasswordChange} style={{ maxWidth: 380, display: 'grid', gap: '1rem' }}>
          <div><label htmlFor="currentPw">Current Password</label><input id="currentPw" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></div>
          <div><label htmlFor="newPw">New Password</label><input id="newPw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required /></div>
          <div><label htmlFor="confirmPw">Confirm New Password</label><input id="confirmPw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required /></div>
          {message && <p style={{ fontSize: '0.875rem', color: message.type === 'success' ? 'var(--color-accent)' : 'var(--color-danger)' }}>{message.text}</p>}
          <button type="submit" className="btn-primary" disabled={saving} style={{ justifySelf: 'start' }}>{saving ? 'Saving...' : 'Update Password'}</button>
        </form>
      </div>
    </div>
  )
}

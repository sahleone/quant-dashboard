/**
 * Tests for RefreshButton component
 *
 * Verifies:
 * 1. Clicking "Refresh Data" calls POST /api/connections/refresh (connection metadata)
 * 2. Clicking "Refresh Data" also calls POST /api/metrics/calculate with fullSync: false (incremental metrics)
 * 3. onRefresh callback is invoked after both calls succeed
 * 4. Error state shown when either call fails
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// Mock apiClient — captures all authenticatedPost calls
const mockAuthenticatedPost = jest.fn()
jest.mock('@/utils/apiClient', () => ({
  authenticatedPost: (...args) => mockAuthenticatedPost(...args),
}))

// Import after mocks
const RefreshButton = require('@/components/refreshButton/RefreshButton').default

describe('RefreshButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockAuthenticatedPost.mockResolvedValue({})
  })

  afterEach(() => {
    jest.runAllTimers()
    jest.useRealTimers()
  })

  it('renders the Refresh Data button', () => {
    render(<RefreshButton />)
    expect(screen.getByRole('button', { name: /refresh data/i })).toBeInTheDocument()
  })

  it('calls POST /api/connections/refresh when clicked', async () => {
    render(<RefreshButton />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /refresh data/i }))
    })
    await waitFor(() => {
      expect(mockAuthenticatedPost).toHaveBeenCalledWith('/api/connections/refresh')
    })
  })

  it('calls POST /api/metrics/calculate with fullSync: false after connections refresh', async () => {
    render(<RefreshButton />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /refresh data/i }))
    })
    await waitFor(() => {
      expect(mockAuthenticatedPost).toHaveBeenCalledWith('/api/metrics/calculate', { fullSync: false })
    })
  })

  it('calls /api/connections/refresh before /api/metrics/calculate (order matters)', async () => {
    const callOrder = []
    mockAuthenticatedPost.mockImplementation((url) => {
      callOrder.push(url)
      return Promise.resolve({})
    })

    render(<RefreshButton />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /refresh data/i }))
    })
    await waitFor(() => expect(callOrder).toHaveLength(2))

    expect(callOrder[0]).toBe('/api/connections/refresh')
    expect(callOrder[1]).toBe('/api/metrics/calculate')
  })

  it('invokes onRefresh callback after both calls succeed', async () => {
    const onRefresh = jest.fn()
    render(<RefreshButton onRefresh={onRefresh} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /refresh data/i }))
    })
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1))
  })

  it('shows error message and does NOT call onRefresh when connections/refresh fails', async () => {
    mockAuthenticatedPost.mockRejectedValueOnce(new Error('network error'))
    const onRefresh = jest.fn()
    render(<RefreshButton onRefresh={onRefresh} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /refresh data/i }))
    })
    await waitFor(() => expect(screen.getByText(/refresh failed/i)).toBeInTheDocument())
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('shows error message and does NOT call onRefresh when metrics/calculate fails', async () => {
    mockAuthenticatedPost
      .mockResolvedValueOnce({}) // connections/refresh succeeds
      .mockRejectedValueOnce(new Error('calculate error')) // metrics/calculate fails
    const onRefresh = jest.fn()
    render(<RefreshButton onRefresh={onRefresh} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /refresh data/i }))
    })
    await waitFor(() => expect(screen.getByText(/refresh failed/i)).toBeInTheDocument())
    expect(onRefresh).not.toHaveBeenCalled()
  })
})

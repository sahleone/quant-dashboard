import { render, screen } from '@testing-library/react'
import UserContext from '@/context/UserContext'
import { PortfolioProvider } from '@/context/PortfolioContext'
import NavBar from '@/components/navbar/NavBar'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

describe('NavBar component', () => {
  it('renders nothing when user is not authenticated', () => {
    const { container } = render(
      <UserContext.Provider value={{ user: null, setUser: jest.fn() }}>
        <NavBar />
      </UserContext.Provider>
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders nav links when user is authenticated', () => {
    render(
      <UserContext.Provider value={{ user: { firstName: 'Test' }, setUser: jest.fn() }}>
        <PortfolioProvider>
          <NavBar />
        </PortfolioProvider>
      </UserContext.Provider>
    )
    expect(screen.getByRole('link', { name: 'Portfolio' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })
})

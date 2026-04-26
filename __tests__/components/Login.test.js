import { render, screen, fireEvent } from '@testing-library/react'
import UserContext from '@/context/UserContext'
import Login from '@/components/login/Login'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

function renderWithContext(ui) {
  return render(
    <UserContext.Provider value={{ user: null, setUser: jest.fn() }}>
      {ui}
    </UserContext.Provider>
  )
}

describe('Login component', () => {
  it('renders login form with email and password fields', () => {
    renderWithContext(<Login />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('renders a submit button', () => {
    renderWithContext(<Login />)
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
  })

  it('has required attribute on email input', () => {
    renderWithContext(<Login />)
    expect(screen.getByLabelText(/email/i)).toBeRequired()
  })

  it('has required attribute on password input', () => {
    renderWithContext(<Login />)
    expect(screen.getByLabelText(/password/i)).toBeRequired()
  })

  it('updates email field when user types', () => {
    renderWithContext(<Login />)
    const emailInput = screen.getByLabelText(/email/i)
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    expect(emailInput.value).toBe('test@example.com')
  })

  it('updates password field when user types', () => {
    renderWithContext(<Login />)
    const passwordInput = screen.getByLabelText(/password/i)
    fireEvent.change(passwordInput, { target: { value: 'secret123' } })
    expect(passwordInput.value).toBe('secret123')
  })

  it('renders a heading with the text "Login"', () => {
    renderWithContext(<Login />)
    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument()
  })
})

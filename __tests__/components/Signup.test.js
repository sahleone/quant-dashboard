import { render, screen, fireEvent } from '@testing-library/react'
import UserContext from '@/context/UserContext'
import Signup from '@/components/login/Signup'

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

describe('Signup component', () => {
  it('renders all four form fields', () => {
    renderWithContext(<Signup />)
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('renders a Sign Up submit button', () => {
    renderWithContext(<Signup />)
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument()
  })

  it('updates first name field when user types', () => {
    renderWithContext(<Signup />)
    const input = screen.getByLabelText(/first name/i)
    fireEvent.change(input, { target: { value: 'Rhys' } })
    expect(input.value).toBe('Rhys')
  })

  it('updates email field when user types', () => {
    renderWithContext(<Signup />)
    const input = screen.getByLabelText(/email/i)
    fireEvent.change(input, { target: { value: 'rhys@example.com' } })
    expect(input.value).toBe('rhys@example.com')
  })

  it('password input has minLength of 8', () => {
    renderWithContext(<Signup />)
    const passwordInput = screen.getByLabelText(/password/i)
    expect(passwordInput).toHaveAttribute('minLength', '8')
  })
})

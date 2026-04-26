import { render, screen, fireEvent } from '@testing-library/react'
import TabPanel from '@/components/tabPanel/TabPanel'

const sampleTabs = [
  { label: 'Overview', content: <p>Overview content</p> },
  { label: 'Holdings', content: <p>Holdings content</p> },
  { label: 'Activity', content: <p>Activity content</p> },
]

describe('TabPanel component', () => {
  it('renders a button for each tab label', () => {
    render(<TabPanel tabs={sampleTabs} />)
    expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /holdings/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /activity/i })).toBeInTheDocument()
  })

  it('shows the first tab content by default', () => {
    render(<TabPanel tabs={sampleTabs} />)
    expect(screen.getByText('Overview content')).toBeInTheDocument()
  })

  it('switches content when a different tab is clicked', () => {
    render(<TabPanel tabs={sampleTabs} />)
    fireEvent.click(screen.getByRole('button', { name: /holdings/i }))
    expect(screen.getByText('Holdings content')).toBeInTheDocument()
  })

  it('clicking the third tab shows the third tab content', () => {
    render(<TabPanel tabs={sampleTabs} />)
    fireEvent.click(screen.getByRole('button', { name: /activity/i }))
    expect(screen.getByText('Activity content')).toBeInTheDocument()
  })

  it('returns null when given an empty tabs array', () => {
    const { container } = render(<TabPanel tabs={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

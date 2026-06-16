import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';

describe('Badge Component', () => {
  it('renders with text content', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders with different variants', () => {
    const { rerender } = render(<Badge variant="success">OK</Badge>);
    expect(screen.getByText('OK')).toBeInTheDocument();

    rerender(<Badge variant="danger">Error</Badge>);
    expect(screen.getByText('Error')).toBeInTheDocument();

    rerender(<Badge variant="brand">Brand</Badge>);
    expect(screen.getByText('Brand')).toBeInTheDocument();
  });

  it('renders with dot indicator', () => {
    const { container } = render(<Badge dot>Status</Badge>);
    expect(container.querySelector('.w-1\\.5')).toBeTruthy();
  });
});

describe('Button Component', () => {
  it('renders with text content', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('renders different variants', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByText('Primary')).toBeInTheDocument();

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByText('Secondary')).toBeInTheDocument();

    rerender(<Button variant="danger">Danger</Button>);
    expect(screen.getByText('Danger')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    const { container } = render(<Button loading>Loading</Button>);
    expect(container.querySelector('button')).toBeDisabled();
  });

  it('renders disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByText('Disabled').closest('button')).toBeDisabled();
  });
});

describe('Card Component', () => {
  it('renders children', () => {
    render(<Card>Card Content</Card>);
    expect(screen.getByText('Card Content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>);
    expect(container.firstChild.classList.contains('custom-class')).toBe(true);
  });
});

describe('Input Component', () => {
  it('renders with label', () => {
    render(<Input label="Email" placeholder="Enter email" />);
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<Input label="Name" error="Required field" />);
    expect(screen.getByText('Required field')).toBeInTheDocument();
  });
});

describe('EmptyState Component', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No Data" description="Nothing here yet" />);
    expect(screen.getByText('No Data')).toBeInTheDocument();
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });

  it('renders with action button', () => {
    render(
      <EmptyState
        title="Empty"
        description="Start adding"
        action={<button>Add New</button>}
      />
    );
    expect(screen.getByText('Add New')).toBeInTheDocument();
  });
});

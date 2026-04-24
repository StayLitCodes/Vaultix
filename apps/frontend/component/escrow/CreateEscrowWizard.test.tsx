import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateEscrowWizard from './CreateEscrowWizard';
import { isConnected } from '@stellar/freighter-api';

jest.mock('@stellar/freighter-api', () => ({
  isConnected: jest.fn(),
  getAddress: jest.fn(),
  signTransaction: jest.fn(),
}));

jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode, href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe('CreateEscrowWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the first step by default', () => {
    render(<CreateEscrowWizard />);
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
  });

  it('validates current step before moving to the next one', async () => {
    render(<CreateEscrowWizard />);
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);
    await waitFor(() => {
      expect(screen.getByText('Title must be at least 5 characters')).toBeInTheDocument();
    });
  });

  it('navigates through all steps with valid data', async () => {
    const user = userEvent.setup();
    render(<CreateEscrowWizard />);
    
    // Step 0: Basic Info
    const title = screen.getByLabelText(/Title/i);
    const category = screen.getByLabelText(/Category/i);
    const description = screen.getByLabelText(/Description/i);

    await user.type(title, 'Project Development');
    await user.selectOptions(category, 'service');
    await user.type(description, 'This is a long enough description for the test.');
    
    await user.click(screen.getByRole('button', { name: /Next/i }));
    
    // Step 1: Parties
    await waitFor(() => expect(screen.getByText(/Counterparty Address/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/Counterparty Address/i), 'GBAH4VETEJSTLXU7I6I7DTH2W57YI6XWUT2C7O7XWS6QW2LWSXUUT2C7');
    await user.click(screen.getByRole('button', { name: /Next/i }));
    
    // Step 2: Terms
    await waitFor(() => expect(screen.getByText(/Amount/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/Amount/i), '100');
    
    const dateInput = screen.getByLabelText(/Deadline/i);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const dateString = futureDate.toISOString().slice(0, 16); 
    fireEvent.change(dateInput, { target: { value: dateString } });
    
    await user.click(screen.getByRole('button', { name: /Next/i }));
    
    // Step 3: Review
    await waitFor(() => expect(screen.getByText(/Review & Confirm/i)).toBeInTheDocument());
    expect(screen.getByText('Project Development')).toBeInTheDocument();
  });
});

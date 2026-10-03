import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateEscrowWizard from './CreateEscrowWizard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/app/contexts/ToastProvider';
import { useWallet } from '@/app/contexts/WalletContext';
import { AssetService } from '@/services/assets';
import { prepareEscrowCreation, submitEscrowCreation } from '@/services/escrow-creation';

jest.mock('@/app/contexts/WalletContext', () => ({ useWallet: jest.fn() }));
jest.mock('@/services/escrow-creation', () => ({
  prepareEscrowCreation: jest.fn(),
  submitEscrowCreation: jest.fn(),
}));

jest.mock('@stellar/freighter-api', () => ({
  isConnected: jest.fn(),
  getAddress: jest.fn(),
  signTransaction: jest.fn(),
}));

jest.mock('@/services/assets', () => ({
  AssetService: {
    getActiveAssets: jest.fn(),
    getUsdConversionRate: jest.fn().mockResolvedValue(0),
  },
}));

jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode, href: string }) => (
    <a href={href}>{children}</a>
  );
});

const VALID_STELLAR_ADDRESS =
  'GDZ667HFMKM7HDKUYM2Q22TX4CSKOAG56ZXQ6MOR6LNOXX5CL6Y4MEEA';

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CreateEscrowWizard />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function goToBasicInfo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /next/i }));
  await screen.findByRole('heading', { name: 'Basic Information' });
}

describe('CreateEscrowWizard', () => {
  const signTransaction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useWallet as jest.Mock).mockReturnValue({
      activeAccount: { publicKey: VALID_STELLAR_ADDRESS, walletType: 'freighter', network: 'testnet' },
      signTransaction,
    });
    (AssetService.getActiveAssets as jest.Mock).mockResolvedValue([
      { id: 'xlm', code: 'XLM', displayName: 'Stellar Lumens', decimals: 7, active: true },
    ]);
  });

  it('renders the first step by default', () => {
    renderWizard();
    expect(screen.getByText('Choose a Template')).toBeInTheDocument();
  });

  it('validates current step before moving to the next one', async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToBasicInfo(user);
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByText('Title must be at least 5 characters')).toBeInTheDocument();
    });
  });

  it('shows XLM as the default asset on the terms step', async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToBasicInfo(user);

    await user.type(screen.getByLabelText(/Title/i), 'Project Development');
    await user.selectOptions(screen.getByLabelText(/Category/i), 'service');
    await user.type(screen.getByLabelText(/Description/i), 'This is a long enough description for the test.');
    await user.click(screen.getByRole('button', { name: /Next/i }));

    await waitFor(() => expect(screen.getByText(/Counterparty Address/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/Counterparty Address/i), VALID_STELLAR_ADDRESS);
    await user.click(screen.getByRole('button', { name: /Next/i }));

    await waitFor(() => expect(screen.getByText(/Amount/i)).toBeInTheDocument());

    expect(screen.getByText('Select Funding Asset')).toBeInTheDocument();
    expect(screen.getAllByText('XLM', { exact: true }).length).toBeGreaterThan(0);
  });

  it('navigates through all steps with valid data', async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToBasicInfo(user);
    
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
    await user.type(screen.getByLabelText(/Counterparty Address/i), VALID_STELLAR_ADDRESS);
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
    
    // Step 3: Optional milestones
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Milestones' })).toBeInTheDocument()
    );
    await user.click(screen.getByRole('button', { name: /Next/i }));

    // Step 4: Optional conditions
    await waitFor(() => expect(screen.getByText(/Release Conditions/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Next/i }));

    // Step 5: Review
    await waitFor(() => expect(screen.getByText(/Review & Confirm/i)).toBeInTheDocument());
    expect(screen.getByText('Project Development')).toBeInTheDocument();
  });

  it('retains the validated form and reuses its intent after wallet signing is rejected', async () => {
    (prepareEscrowCreation as jest.Mock).mockImplementation((intentId) =>
      Promise.resolve({ intentId, chainEscrowId: '7001', unsignedXdr: 'unsigned-xdr' }),
    );
    signTransaction.mockRejectedValueOnce(new Error('User rejected the transaction.'))
      .mockResolvedValueOnce('signed-xdr');
    (submitEscrowCreation as jest.Mock).mockResolvedValue({
      escrowId: 'db-escrow-id',
      transactionHash: 'real-transaction-hash',
      status: 'confirmed',
    });

    const user = userEvent.setup();
    renderWizard();
    await goToBasicInfo(user);
    await user.type(screen.getByLabelText(/Title/i), 'Project Development');
    await user.selectOptions(screen.getByLabelText(/Category/i), 'service');
    await user.type(screen.getByLabelText(/Description/i), 'This is a long enough description for the test.');
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.type(screen.getByLabelText(/Counterparty Address/i), VALID_STELLAR_ADDRESS);
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.type(screen.getByLabelText(/Amount/i), '1.25');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    fireEvent.change(screen.getByLabelText(/Deadline/i), {
      target: { value: futureDate.toISOString().slice(0, 16) },
    });
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await screen.findByText('Project Development');

    await user.click(screen.getByRole('button', { name: /Create Escrow/i }));
    expect(await screen.findByText('User rejected the transaction.')).toBeInTheDocument();
    expect(screen.getByText('1.25 XLM')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Create Escrow/i }));
    expect(await screen.findByText('Escrow Created Successfully!')).toBeInTheDocument();
    expect(screen.getByText('db-escrow-id')).toBeInTheDocument();
    expect(screen.getByText('real-transaction-hash')).toBeInTheDocument();
    expect(signTransaction).toHaveBeenCalledTimes(2);
    const firstIntent = (prepareEscrowCreation as jest.Mock).mock.calls[0][0];
    const retriedIntent = (prepareEscrowCreation as jest.Mock).mock.calls[1][0];
    expect(retriedIntent).toBe(firstIntent);
    expect(submitEscrowCreation).toHaveBeenCalledWith(firstIntent, 'signed-xdr');
  }, 20000);

  it('retries an ambiguous submission using the same signed XDR and intent', async () => {
    (prepareEscrowCreation as jest.Mock).mockImplementation((intentId) =>
      Promise.resolve({ intentId, chainEscrowId: '7002', unsignedXdr: 'unsigned-xdr' }),
    );
    signTransaction.mockResolvedValue('same-signed-xdr');
    (submitEscrowCreation as jest.Mock)
      .mockRejectedValueOnce(new Error('Escrow transaction is pending; retry the same submission.'))
      .mockResolvedValueOnce({
        escrowId: 'db-escrow-retried',
        transactionHash: 'same-transaction-hash',
        status: 'confirmed',
      });

    const user = userEvent.setup();
    renderWizard();
    await goToBasicInfo(user);
    await user.type(screen.getByLabelText(/Title/i), 'Project Development');
    await user.selectOptions(screen.getByLabelText(/Category/i), 'service');
    await user.type(screen.getByLabelText(/Description/i), 'This is a long enough description for the test.');
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.type(screen.getByLabelText(/Counterparty Address/i), VALID_STELLAR_ADDRESS);
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.type(screen.getByLabelText(/Amount/i), '1.25');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    fireEvent.change(screen.getByLabelText(/Deadline/i), {
      target: { value: futureDate.toISOString().slice(0, 16) },
    });
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await screen.findByText('Project Development');

    await user.click(screen.getByRole('button', { name: /Create Escrow/i }));
    expect(await screen.findByText(/pending; retry the same submission/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Create Escrow/i }));
    expect(await screen.findByText('Escrow Created Successfully!')).toBeInTheDocument();

    expect(prepareEscrowCreation).toHaveBeenCalledTimes(1);
    expect(signTransaction).toHaveBeenCalledTimes(1);
    const intentId = (prepareEscrowCreation as jest.Mock).mock.calls[0][0];
    expect(submitEscrowCreation).toHaveBeenNthCalledWith(1, intentId, 'same-signed-xdr');
    expect(submitEscrowCreation).toHaveBeenNthCalledWith(2, intentId, 'same-signed-xdr');
  }, 20000);
});

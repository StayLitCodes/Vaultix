import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ReleaseFundsModal from "./ReleaseFundsModal";
import { IEscrowExtended } from "@/types/escrow";

// Mock TransactionTracker to simplify tests
jest.mock("@/components/stellar/TransactionTracker", () => {
  return () => <div data-testid="transaction-tracker">Transaction Tracker Mock</div>;
});

const mockEscrow: IEscrowExtended = {
  id: "escrow_123",
  amount: "1000",
  asset: "XLM",
  status: "active",
  counterpartyAddress: "GBV...SELLER",
  creatorAddress: "GBA...BUYER",
  title: "Test Escrow",
  description: "Test Description",
  category: "service",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as any;

describe("ReleaseFundsModal", () => {
  const mockOnClose = jest.fn();
  const mockConnect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("renders the review step initially when not released", () => {
    render(
      <ReleaseFundsModal
        isOpen={true}
        onClose={mockOnClose}
        escrow={mockEscrow}
        connected={true}
        connect={mockConnect}
        publicKey="GBA...BUYER"
      />
    );

    expect(screen.getByText("Review payout details")).toBeInTheDocument();
    expect(screen.getByText("1,000.00 XLM")).toBeInTheDocument();
  });

  it("navigates to confirm step when 'Release funds' is clicked", () => {
    render(
      <ReleaseFundsModal
        isOpen={true}
        onClose={mockOnClose}
        escrow={mockEscrow}
        connected={true}
        connect={mockConnect}
        publicKey="GBA...BUYER"
      />
    );

    fireEvent.click(screen.getByText("Release funds"));
    expect(screen.getByText("Confirm on-chain release")).toBeInTheDocument();
  });

  it("calculates fees correctly (0.5%)", () => {
    render(
      <ReleaseFundsModal
        isOpen={true}
        onClose={mockOnClose}
        escrow={mockEscrow}
        connected={true}
        connect={mockConnect}
        publicKey="GBA...BUYER"
      />
    );

    // 1000 * 0.005 = 5
    expect(screen.getByText("5.00 XLM (0.5%)")).toBeInTheDocument();
    expect(screen.getByText("995.00 XLM")).toBeInTheDocument();
  });

  it("shows error if wallet is not connected in confirm step", () => {
    render(
      <ReleaseFundsModal
        isOpen={true}
        onClose={mockOnClose}
        escrow={mockEscrow}
        connected={false}
        connect={mockConnect}
        publicKey={null}
      />
    );

    fireEvent.click(screen.getByText("Release funds"));
    fireEvent.click(screen.getByText("Confirm release"));

    expect(screen.getByText("Connect your wallet before releasing funds.")).toBeInTheDocument();
  });

  it("submits the release request and shows success step", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ transactionHash: "tx_hash_123", status: "success" }),
    });

    render(
      <ReleaseFundsModal
        isOpen={true}
        onClose={mockOnClose}
        escrow={mockEscrow}
        connected={true}
        connect={mockConnect}
        publicKey="GBA...BUYER"
      />
    );

    fireEvent.click(screen.getByText("Release funds"));
    fireEvent.click(screen.getByText("Confirm release"));

    await waitFor(() => {
      expect(screen.getByText("Funds successfully released")).toBeInTheDocument();
    });
    expect(screen.getByText("tx_hash_123")).toBeInTheDocument();
    expect(screen.getByTestId("transaction-tracker")).toBeInTheDocument();
  });

  it("handles API error during release", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Incompatible threshold" }),
    });

    render(
      <ReleaseFundsModal
        isOpen={true}
        onClose={mockOnClose}
        escrow={mockEscrow}
        connected={true}
        connect={mockConnect}
        publicKey="GBA...BUYER"
      />
    );

    fireEvent.click(screen.getByText("Release funds"));
    fireEvent.click(screen.getByText("Confirm release"));

    await waitFor(() => {
      expect(screen.getByTestId("release-error")).toHaveTextContent("Incompatible threshold");
    });
  });
});

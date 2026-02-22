import React, { useState, useContext } from 'react';
import { WalletContext } from '../../services/WalletContext';

interface Props {
  escrowId: string;
  onClose: () => void;
}

const FundEscrowModal: React.FC<Props> = ({ escrowId, onClose }) => {
  const { connectWallet, signTransaction } = useContext(WalletContext);
  const [amount, setAmount] = useState('');
  const [fees, setFees] = useState('0.1'); // Example fee
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);

  const total = parseFloat(amount || '0') + parseFloat(fees);

  const handleFund = async () => {
    try {
      setStatus('pending');
      await connectWallet();

      // Build transaction preview
      const tx = {
        escrowId,
        amount,
        fees,
      };

      // Sign and submit transaction
      const result = await signTransaction(tx);
      setTxHash(result.hash);
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('failed');
    }
  };

  return (
    <div className="modal">
      <h3>Fund Escrow</h3>
      <label>
        Amount:
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <p>Fees: {fees} XLM</p>
      <p>Total: {total} XLM</p>

      {status === 'idle' && <button onClick={handleFund}>Fund Escrow</button>}
      {status === 'pending' && <p>Transaction pending...</p>}
      {status === 'success' && (
        <p>
          Transaction successful! Hash: <code>{txHash}</code>
        </p>
      )}
      {status === 'failed' && <p>Transaction failed. Please try again.</p>}

      <button onClick={onClose}>Close</button>
    </div>
  );
};

export default FundEscrowModal;

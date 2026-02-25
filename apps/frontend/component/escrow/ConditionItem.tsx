import React, { useState } from 'react';
import FulfillConditionModal from './FulfillConditionModal';

interface Condition {
  id: string;
  description: string;
  fulfilled: boolean;
  confirmed: boolean;
}

interface Props {
  condition: Condition;
  role: 'seller' | 'buyer';
}

const ConditionItem: React.FC<Props> = ({ condition, role }) => {
  const [showModal, setShowModal] = useState(false);

  const handleFulfill = () => setShowModal(true);
  const handleConfirm = async () => {
    // API call to confirm condition
    await fetch(`/api/escrow/conditions/${condition.id}/confirm`, { method: 'POST' });
  };

  return (
    <div className="condition-item">
      <p>{condition.description}</p>
      {role === 'seller' && !condition.fulfilled && (
        <button onClick={handleFulfill}>Fulfill</button>
      )}
      {role === 'buyer' && condition.fulfilled && !condition.confirmed && (
        <button onClick={handleConfirm}>Confirm</button>
      )}
      {showModal && (
        <FulfillConditionModal
          conditionId={condition.id}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default ConditionItem;

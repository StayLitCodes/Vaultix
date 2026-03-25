import React, { useState } from 'react';

interface Props {
  conditionId: string;
  onClose: () => void;
}

const FulfillConditionModal: React.FC<Props> = ({ conditionId, onClose }) => {
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async () => {
    const formData = new FormData();
    formData.append('notes', notes);
    if (file) formData.append('evidence', file);

    await fetch(`/api/escrow/conditions/${conditionId}/fulfill`, {
      method: 'POST',
      body: formData,
    });

    onClose();
  };

  return (
    <div className="modal">
      <h3>Fulfill Condition</h3>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes or evidence..."
      />
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button onClick={handleSubmit}>Submit</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};

export default FulfillConditionModal;

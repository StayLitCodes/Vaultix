import React from 'react';
import ConditionItem from './ConditionItem';

interface Condition {
  id: string;
  description: string;
  fulfilled: boolean;
  confirmed: boolean;
}

interface Props {
  conditions: Condition[];
  role: 'seller' | 'buyer';
}

const ConditionsList: React.FC<Props> = ({ conditions, role }) => {
  return (
    <div>
      {conditions.map((condition) => (
        <ConditionItem key={condition.id} condition={condition} role={role} />
      ))}
    </div>
  );
};

export default ConditionsList;

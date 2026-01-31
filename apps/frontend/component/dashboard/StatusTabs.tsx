import React from 'react';

interface StatusTabsProps {
  activeTab: 'all' | 'active' | 'pending' | 'completed' | 'disputed';
  onTabChange: (tab: 'all' | 'active' | 'pending' | 'completed' | 'disputed') => void;
}

const StatusTabs: React.FC<StatusTabsProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'pending', label: 'Pending Confirmation' },
    { id: 'completed', label: 'Completed' },
    { id: 'disputed', label: 'Disputed' },
  ];

  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="-mb-px flex space-x-8 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => onTabChange(tab.id as any)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default StatusTabs;
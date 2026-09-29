import React from 'react';
import { CanonicalEscrowStatus } from '@/utils/escrowStatus';
import { useTranslations } from 'next-intl';

type StatusTabId = CanonicalEscrowStatus | 'all';

interface StatusTabsProps {
  activeStatuses: CanonicalEscrowStatus[];
  onToggleStatus: (status: StatusTabId) => void;
}

const StatusTabs: React.FC<StatusTabsProps> = ({ activeStatuses, onToggleStatus }) => {
  const t = useTranslations('dashboard');
  const tabs: Array<{ id: StatusTabId; label: string }> = [
    { id: 'all', label: t('all') },
    { id: CanonicalEscrowStatus.ACTIVE, label: t('active') },
    { id: CanonicalEscrowStatus.CREATED, label: t('pending') },
    { id: CanonicalEscrowStatus.COMPLETED, label: t('completed') },
    { id: CanonicalEscrowStatus.DISPUTED, label: t('disputed') },
    { id: CanonicalEscrowStatus.EXPIRED, label: t('expired') },
  ];
  const isActive = (id: StatusTabId) => id === 'all' ? activeStatuses.length === 0 : activeStatuses.includes(id);

  return (
    <div className="mb-5 -mx-1">
      {/* Scrollable tab strip — no horizontal scroll bleed on the page */}
      <div className="overflow-x-auto scrollbar-none pb-1">
        <nav className="flex items-center gap-1 min-w-max px-1" aria-label={t('yourEscrows')}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onToggleStatus(tab.id)}
              className={`
                min-h-[44px] whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
                ${isActive(tab.id)
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}
              `}
              aria-pressed={isActive(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default StatusTabs;

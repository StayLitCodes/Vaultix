import React from "react";

interface StatusTabsProps {
  activeStatuses: string[];
  onToggleStatus: (status: string) => void;
}

const StatusTabs: React.FC<StatusTabsProps> = ({
  activeStatuses,
  onToggleStatus,
}) => {
  const tabs = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "pending", label: "Pending Confirmation" },
    { id: "completed", label: "Completed" },
    { id: "disputed", label: "Disputed" },
    { id: "expired", label: "Expired" },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-4">
      {tabs.map((tab) => {
        const isActive =
          tab.id === "all"
            ? activeStatuses.length === 0
            : activeStatuses.includes(tab.id);

        return (
          <button
            key={tab.id}
            onClick={() => onToggleStatus(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              isActive
                ? "bg-blue-100 text-blue-700 border-2 border-blue-500"
                : "bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default StatusTabs;

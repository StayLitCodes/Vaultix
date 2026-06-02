'use client'
interface ConfirmationProgressProps {
  total: number;
  confirmed: number;
}

const ConfirmationProgress: React.FC<ConfirmationProgressProps> = ({ total, confirmed }) => {
  const percentage = Math.round((confirmed / total) * 100);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 mb-6 shadow-sm">
      <div className="flex justify-between items-end mb-3">
        <div>
          <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">
            Release Status
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">
              {confirmed} of {total}
            </span>
            <span className="text-gray-400 font-medium">Parties Confirmed</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-purple-400 font-bold text-lg">{percentage}%</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden flex">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ConfirmationProgress;
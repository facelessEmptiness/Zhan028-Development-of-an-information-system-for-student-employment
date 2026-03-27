interface MatchIndexProps {
  percentage: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const MatchIndex = ({ percentage, size = 'md', showLabel = true }: MatchIndexProps) => {
  const getColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-blue-600';
    if (percentage >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBackgroundColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-50';
    if (percentage >= 60) return 'bg-blue-50';
    if (percentage >= 40) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  const getBorderColor = (percentage: number) => {
    if (percentage >= 80) return 'border-green-200';
    if (percentage >= 60) return 'border-blue-200';
    if (percentage >= 40) return 'border-yellow-200';
    return 'border-red-200';
  };

  const sizeClasses = {
    sm: 'w-12 h-12 text-sm',
    md: 'w-16 h-16 text-lg',
    lg: 'w-20 h-20 text-2xl',
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className={`${sizeClasses[size]} rounded-full ${getBackgroundColor(
          percentage
        )} border-2 ${getBorderColor(percentage)} flex items-center justify-center`}
      >
        <span className={`font-bold ${getColor(percentage)}`}>{percentage}%</span>
      </div>
      {showLabel && (
        <p className="mt-2 text-xs font-medium text-gray-600">Match Index</p>
      )}
      <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${
            percentage >= 80
              ? 'bg-green-600'
              : percentage >= 60
              ? 'bg-blue-600'
              : percentage >= 40
              ? 'bg-yellow-600'
              : 'bg-red-600'
          }`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default MatchIndex;

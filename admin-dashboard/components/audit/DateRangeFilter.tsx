'use client';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onDateRangeChange: (startDate: string, endDate: string) => void;
}

export function DateRangeFilter({
  startDate,
  endDate,
  onDateRangeChange,
}: DateRangeFilterProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-2">
          Start Date
        </label>
        <input
          type="date"
          id="start-date"
          value={startDate}
          onChange={(e) => onDateRangeChange(e.target.value, endDate)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      <div>
        <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-2">
          End Date
        </label>
        <input
          type="date"
          id="end-date"
          value={endDate}
          onChange={(e) => onDateRangeChange(startDate, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
    </div>
  );
}

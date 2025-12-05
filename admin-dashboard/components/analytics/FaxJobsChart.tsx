import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface FaxJobsChartProps {
  data?: {
    total: number;
    last24Hours: number;
    byStatus: Record<string, number>;
    perDay: Array<{ date: string; count: number }>;
  };
}

export function FaxJobsChart({ data }: FaxJobsChartProps) {
  if (!data || !data.perDay || data.perDay.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-500 text-center">No data available</p>
      </div>
    );
  }

  // Format data for chart (reverse to show oldest to newest)
  const chartData = [...data.perDay].reverse().map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count: item.count,
  }));

  // Calculate status breakdown
  const statusData = Object.entries(data.byStatus).map(([status, count]) => ({
    status: status.charAt(0).toUpperCase() + status.slice(1),
    count,
    percentage: data.total > 0 ? ((count / data.total) * 100).toFixed(1) : '0',
  }));

  const getStatusColor = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'completed' || lowerStatus === 'delivered') return 'text-green-600 bg-green-50';
    if (lowerStatus === 'failed') return 'text-red-600 bg-red-50';
    if (lowerStatus === 'processing' || lowerStatus === 'sending') return 'text-blue-600 bg-blue-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      {/* Chart */}
      <div className="mb-6">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="count" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
              name="Fax Jobs"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Status Breakdown */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Status Breakdown</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statusData.map((item) => (
            <div key={item.status} className={`p-3 rounded-lg ${getStatusColor(item.status)}`}>
              <p className="text-xs font-medium mb-1">{item.status}</p>
              <p className="text-lg font-bold">{item.count}</p>
              <p className="text-xs opacity-75">{item.percentage}%</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

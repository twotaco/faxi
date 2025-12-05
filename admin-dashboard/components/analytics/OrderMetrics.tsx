import { ShoppingCart, DollarSign, Package } from 'lucide-react';

interface OrderMetricsProps {
  data?: {
    total: number;
    totalRevenue: number;
    byStatus: Record<string, number>;
  };
}

export function OrderMetrics({ data }: OrderMetricsProps) {
  if (!data) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-500 text-center">No data available</p>
      </div>
    );
  }

  const statusData = Object.entries(data.byStatus).map(([status, count]) => ({
    status: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '),
    count,
    percentage: data.total > 0 ? ((count / data.total) * 100).toFixed(1) : '0',
  }));

  const getStatusColor = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('delivered') || lowerStatus.includes('purchased')) return 'text-green-600 bg-green-50';
    if (lowerStatus.includes('cancelled') || lowerStatus.includes('failed')) return 'text-red-600 bg-red-50';
    if (lowerStatus.includes('processing') || lowerStatus.includes('shipped')) return 'text-blue-600 bg-blue-50';
    if (lowerStatus.includes('pending')) return 'text-yellow-600 bg-yellow-50';
    if (lowerStatus.includes('paid')) return 'text-purple-600 bg-purple-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <p className="text-xs font-medium text-blue-600">Total Orders</p>
          </div>
          <p className="text-2xl font-bold text-blue-800">{data.total}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <p className="text-xs font-medium text-green-600">Total Revenue</p>
          </div>
          <p className="text-2xl font-bold text-green-800">
            ¥{data.totalRevenue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Average Order Value */}
      {data.total > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Average Order Value</p>
            <p className="text-lg font-bold text-gray-800">
              ¥{Math.round(data.totalRevenue / data.total).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Status Breakdown */}
      {statusData.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Order Status</h4>
          <div className="space-y-2">
            {statusData.map((item) => (
              <div key={item.status} className={`p-3 rounded-lg ${getStatusColor(item.status)}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium">{item.status}</p>
                  <p className="text-xs opacity-75">{item.percentage}%</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="w-full bg-white bg-opacity-50 rounded-full h-2 mr-3">
                    <div
                      className="h-2 rounded-full bg-current opacity-50"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <p className="text-sm font-bold whitespace-nowrap">{item.count}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

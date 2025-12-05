import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

interface UserInsightsChartProps {
  data?: {
    total: number;
    byRegion: Record<string, number>;
    byAgeRange: Record<string, number>;
    byDigitalScore: Record<string, number>;
  };
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

export function UserInsightsChart({ data }: UserInsightsChartProps) {
  if (!data) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-500 text-center">No data available</p>
      </div>
    );
  }

  // Format region data for bar chart
  const regionData = Object.entries(data.byRegion)
    .map(([region, count]) => ({
      region: region || 'Unknown',
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 regions

  // Format age range data for pie chart
  const ageData = Object.entries(data.byAgeRange)
    .map(([range, count]) => ({
      name: range || 'Unknown',
      value: count,
    }))
    .sort((a, b) => {
      // Sort by age range order
      const order = ['18-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80+'];
      return order.indexOf(a.name) - order.indexOf(b.name);
    });

  // Format digital score data
  const digitalScoreData = Object.entries(data.byDigitalScore)
    .map(([score, count]) => ({
      name: score || 'Unknown',
      value: count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="bg-white p-6 rounded-lg shadow space-y-6">
      {/* Total Users */}
      <div className="border-b border-gray-200 pb-4">
        <p className="text-sm text-gray-600">Total Users</p>
        <p className="text-3xl font-bold text-gray-800">{data.total}</p>
      </div>

      {/* Region Distribution */}
      {regionData.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Top Regions</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={regionData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis 
                type="category" 
                dataKey="region" 
                stroke="#6b7280" 
                style={{ fontSize: '12px' }}
                width={80}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Age Range Distribution */}
      {ageData.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Age Distribution</h4>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={ageData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {ageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Digital Exclusion Score */}
      {digitalScoreData.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Digital Exclusion Score</h4>
          <div className="space-y-2">
            {digitalScoreData.map((item, index) => {
              const percentage = data.total > 0 ? (item.value / data.total) * 100 : 0;
              return (
                <div key={item.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600">{item.name}</span>
                    <span className="font-medium text-gray-800">{item.value}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

import { Users, FileText, ShoppingCart, Zap } from 'lucide-react';

interface OverviewStatsProps {
  data?: {
    users: {
      total: number;
    };
    faxJobs: {
      total: number;
      last24Hours: number;
    };
    orders: {
      total: number;
      totalRevenue: number;
    };
    processing: {
      avgAccuracy: number;
      avgConfidence: number;
      avgProcessingTime: number;
    };
  };
}

export function OverviewStats({ data }: OverviewStatsProps) {
  const stats = [
    {
      label: 'Total Users',
      value: data?.users.total || 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Total Fax Jobs',
      value: data?.faxJobs.total || 0,
      subtitle: `${data?.faxJobs.last24Hours || 0} in last 24h`,
      icon: FileText,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Total Orders',
      value: data?.orders.total || 0,
      subtitle: `¥${(data?.orders.totalRevenue || 0).toLocaleString()} revenue`,
      icon: ShoppingCart,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      label: 'Avg Processing Time',
      value: `${Math.round(data?.processing.avgProcessingTime || 0)}ms`,
      subtitle: `${Math.round((data?.processing.avgAccuracy || 0) * 100)}% accuracy`,
      icon: Zap,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">{stat.label}</h3>
              <div className={`${stat.bgColor} p-2 rounded-lg`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-800">{stat.value}</p>
            {stat.subtitle && (
              <p className="text-xs text-gray-500 mt-2">{stat.subtitle}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

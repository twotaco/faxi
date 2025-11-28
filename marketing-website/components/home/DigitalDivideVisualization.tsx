'use client';

import { useTranslations } from 'next-intl';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#4f3a21', '#d97706', '#78716c', '#b45309', '#57534e'];

export function DigitalDivideVisualization() {
  const t = useTranslations('home.dataVisualization');

  // Data for elderly internet usage by age group
  const internetUsageData = [
    {
      ageGroup: t('internetUsage.data.60-64.label'),
      percentage: 90,
      label: '60-64'
    },
    {
      ageGroup: t('internetUsage.data.65-69.label'),
      percentage: 82,
      label: '65-69'
    },
    {
      ageGroup: t('internetUsage.data.70-74.label'),
      percentage: 68,
      label: '70-74'
    },
    {
      ageGroup: t('internetUsage.data.75-79.label'),
      percentage: 51,
      label: '75-79'
    },
    {
      ageGroup: t('internetUsage.data.80plus.label'),
      percentage: 25,
      label: '80+'
    }
  ];

  // Data for fax vs internet usage
  const communicationMethodsData = [
    {
      name: t('communicationMethods.data.fax.label'),
      value: 10000000,
      displayValue: '10M'
    },
    {
      name: t('communicationMethods.data.internet.label'),
      value: 27000000,
      displayValue: '27M'
    },
    {
      name: t('communicationMethods.data.neither.label'),
      value: 9000000,
      displayValue: '9M'
    }
  ];

  // Data for service accessibility challenges
  const accessibilityData = [
    {
      service: t('accessibility.data.healthcare.label'),
      withInternet: 95,
      withoutInternet: 45
    },
    {
      service: t('accessibility.data.shopping.label'),
      withInternet: 90,
      withoutInternet: 30
    },
    {
      service: t('accessibility.data.government.label'),
      withInternet: 85,
      withoutInternet: 40
    },
    {
      service: t('accessibility.data.banking.label'),
      withInternet: 92,
      withoutInternet: 35
    }
  ];

  return (
    <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
          {t('title')}
        </h2>
        <p className="text-lg text-center text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto">
          {t('subtitle')}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Internet Usage by Age Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              {t('internetUsage.title')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('internetUsage.description')}
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={internetUsageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="ageGroup" 
                  tick={{ fill: '#6B7280' }}
                />
                <YAxis 
                  tick={{ fill: '#6B7280' }}
                  label={{ value: '%', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: 'none',
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                />
                <Bar dataKey="percentage" fill="#4f3a21" name={t('internetUsage.barLabel')} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
              {t('internetUsage.source')}
            </p>
          </div>

          {/* Communication Methods Pie Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              {t('communicationMethods.title')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('communicationMethods.description')}
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={communicationMethodsData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {communicationMethodsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: 'none',
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                  formatter={(value: number) => `${(value / 1000000).toFixed(1)}M`}
                />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
              {t('communicationMethods.source')}
            </p>
          </div>

          {/* Service Accessibility Comparison */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg lg:col-span-2">
            <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              {t('accessibility.title')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('accessibility.description')}
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={accessibilityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="service" 
                  tick={{ fill: '#6B7280' }}
                />
                <YAxis 
                  tick={{ fill: '#6B7280' }}
                  label={{ value: '%', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: 'none',
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                />
                <Legend />
                <Bar
                  dataKey="withInternet"
                  fill="#d97706"
                  name={t('accessibility.withInternetLabel')}
                />
                <Bar
                  dataKey="withoutInternet"
                  fill="#78716c"
                  name={t('accessibility.withoutInternetLabel')}
                />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
              {t('accessibility.source')}
            </p>
          </div>
        </div>

        {/* Key Insights */}
        <div className="mt-12 max-w-4xl mx-auto">
          <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-600 p-6 rounded-r-lg">
            <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
              {t('insights.title')}
            </h4>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="text-amber-700 mr-2">•</span>
                <span>{t('insights.point1')}</span>
              </li>
              <li className="flex items-start">
                <span className="text-amber-700 mr-2">•</span>
                <span>{t('insights.point2')}</span>
              </li>
              <li className="flex items-start">
                <span className="text-amber-700 mr-2">•</span>
                <span>{t('insights.point3')}</span>
              </li>
              <li className="flex items-start">
                <span className="text-amber-700 mr-2">•</span>
                <span>{t('insights.point4')}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart, 
  CreditCard, 
  Search, 
  Bot,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  DollarSign
} from 'lucide-react';

interface ShoppingMetrics {
  search: {
    totalSearches: number;
    successfulSearches: number;
    failedSearches: number;
    successRate: number;
    averageResultCount: number;
    averageResponseTime: number;
    cacheHitRate: number;
  };
  orders: {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    completionRate: number;
    averageOrderValue: number;
    ordersByStatus: Record<string, number>;
    averageTimeToCompletion: number;
  };
  payments: {
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    successRate: number;
    averagePaymentAmount: number;
    paymentMethodDistribution: Record<string, number>;
    averageProcessingTime: number;
  };
  browserAutomation: {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    successRate: number;
    averageExecutionTime: number;
    failureReasons: Record<string, number>;
  };
  priceDiscrepancy: {
    totalValidations: number;
    discrepanciesFound: number;
    discrepancyRate: number;
    averageDiscrepancy: number;
    maxDiscrepancy: number;
    discrepanciesRequiringApproval: number;
  };
  timestamp: string;
}

interface Alert {
  severity: string;
  message: string;
  metric: string;
  value: number;
}

export default function ShoppingMetricsPage() {
  const [metrics, setMetrics] = useState<ShoppingMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeWindow, setTimeWindow] = useState<number>(24);

  useEffect(() => {
    fetchMetrics();
    fetchAlerts();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchMetrics();
      fetchAlerts();
    }, 30000);

    return () => clearInterval(interval);
  }, [timeWindow]);

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`/api/admin/shopping/metrics/dashboard?timeWindow=${timeWindow}`);
      const data = await response.json();
      if (data.success) {
        setMetrics(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/admin/shopping/metrics/alerts');
      const data = await response.json();
      if (data.success) {
        setAlerts(data.data.alerts);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };

  const formatNumber = (num: number, decimals: number = 1): string => {
    return num.toFixed(decimals);
  };

  const formatCurrency = (amount: number): string => {
    return `¥${Math.round(amount).toLocaleString()}`;
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStatusColor = (rate: number, threshold: number, inverse: boolean = false): string => {
    const passing = inverse ? rate <= threshold : rate >= threshold;
    return passing ? 'text-green-600' : 'text-red-600';
  };

  const getStatusIcon = (rate: number, threshold: number, inverse: boolean = false) => {
    const passing = inverse ? rate <= threshold : rate >= threshold;
    return passing ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load shopping metrics</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Shopping Metrics</h1>
          <p className="text-gray-600 mt-1">Monitor shopping service performance and health</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTimeWindow(1)}
            className={`px-4 py-2 rounded ${timeWindow === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            1 Hour
          </button>
          <button
            onClick={() => setTimeWindow(24)}
            className={`px-4 py-2 rounded ${timeWindow === 24 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            24 Hours
          </button>
          <button
            onClick={() => setTimeWindow(168)}
            className={`px-4 py-2 rounded ${timeWindow === 168 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            7 Days
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <Alert key={index} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{alert.severity === 'critical' ? 'Critical' : 'Warning'}</AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Search Success Rate</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{formatNumber(metrics.search.successRate)}%</div>
              {getStatusIcon(metrics.search.successRate, 90)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.search.totalSearches} total searches
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Order Completion Rate</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{formatNumber(metrics.orders.completionRate)}%</div>
              {getStatusIcon(metrics.orders.completionRate, 85)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.orders.totalOrders} total orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Success Rate</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{formatNumber(metrics.payments.successRate)}%</div>
              {getStatusIcon(metrics.payments.successRate, 95)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.payments.totalPayments} total payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Price Discrepancy Rate</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{formatNumber(metrics.priceDiscrepancy.discrepancyRate)}%</div>
              {getStatusIcon(metrics.priceDiscrepancy.discrepancyRate, 15, true)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg: {formatCurrency(metrics.priceDiscrepancy.averageDiscrepancy)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="search" className="space-y-4">
        <TabsList>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Search Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Success Rate:</span>
                  <span className={`font-semibold ${getStatusColor(metrics.search.successRate, 90)}`}>
                    {formatNumber(metrics.search.successRate)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Avg Response Time:</span>
                  <span className="font-semibold">{formatTime(metrics.search.averageResponseTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Cache Hit Rate:</span>
                  <span className="font-semibold">{formatNumber(metrics.search.cacheHitRate)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Avg Results:</span>
                  <span className="font-semibold">{formatNumber(metrics.search.averageResultCount, 0)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Search Volume</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Searches:</span>
                  <span className="font-semibold">{metrics.search.totalSearches}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Successful:</span>
                  <span className="font-semibold text-green-600">{metrics.search.successfulSearches}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Failed:</span>
                  <span className="font-semibold text-red-600">{metrics.search.failedSearches}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Order Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Completion Rate:</span>
                  <span className={`font-semibold ${getStatusColor(metrics.orders.completionRate, 85)}`}>
                    {formatNumber(metrics.orders.completionRate)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Avg Order Value:</span>
                  <span className="font-semibold">{formatCurrency(metrics.orders.averageOrderValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Avg Time to Complete:</span>
                  <span className="font-semibold">{formatTime(metrics.orders.averageTimeToCompletion * 1000)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Volume</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Orders:</span>
                  <span className="font-semibold">{metrics.orders.totalOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Completed:</span>
                  <span className="font-semibold text-green-600">{metrics.orders.completedOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Cancelled:</span>
                  <span className="font-semibold text-red-600">{metrics.orders.cancelledOrders}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Orders by Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(metrics.orders.ordersByStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between">
                    <span className="text-sm text-gray-600 capitalize">{status.replace('_', ' ')}:</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Success Rate:</span>
                  <span className={`font-semibold ${getStatusColor(metrics.payments.successRate, 95)}`}>
                    {formatNumber(metrics.payments.successRate)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Avg Amount:</span>
                  <span className="font-semibold">{formatCurrency(metrics.payments.averagePaymentAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Avg Processing Time:</span>
                  <span className="font-semibold">{formatTime(metrics.payments.averageProcessingTime)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Volume</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Payments:</span>
                  <span className="font-semibold">{metrics.payments.totalPayments}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Successful:</span>
                  <span className="font-semibold text-green-600">{metrics.payments.successfulPayments}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Failed:</span>
                  <span className="font-semibold text-red-600">{metrics.payments.failedPayments}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(metrics.payments.paymentMethodDistribution).map(([method, count]) => (
                  <div key={method} className="flex justify-between">
                    <span className="text-sm text-gray-600 capitalize">{method.replace('_', ' ')}:</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Automation Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Success Rate:</span>
                  <span className={`font-semibold ${getStatusColor(metrics.browserAutomation.successRate, 80)}`}>
                    {formatNumber(metrics.browserAutomation.successRate)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Avg Execution Time:</span>
                  <span className="font-semibold">{formatTime(metrics.browserAutomation.averageExecutionTime)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Automation Volume</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Attempts:</span>
                  <span className="font-semibold">{metrics.browserAutomation.totalAttempts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Successful:</span>
                  <span className="font-semibold text-green-600">{metrics.browserAutomation.successfulAttempts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Failed:</span>
                  <span className="font-semibold text-red-600">{metrics.browserAutomation.failedAttempts}</span>
                </div>
              </CardContent>
            </Card>

            {Object.keys(metrics.browserAutomation.failureReasons).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Failure Reasons</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(metrics.browserAutomation.failureReasons).map(([reason, count]) => (
                    <div key={reason} className="flex justify-between">
                      <span className="text-sm text-gray-600">{reason}:</span>
                      <Badge variant="destructive">{count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Price Discrepancy Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Discrepancy Rate:</span>
                  <span className={`font-semibold ${getStatusColor(metrics.priceDiscrepancy.discrepancyRate, 15, true)}`}>
                    {formatNumber(metrics.priceDiscrepancy.discrepancyRate)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Avg Discrepancy:</span>
                  <span className="font-semibold">{formatCurrency(metrics.priceDiscrepancy.averageDiscrepancy)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Max Discrepancy:</span>
                  <span className="font-semibold text-red-600">{formatCurrency(metrics.priceDiscrepancy.maxDiscrepancy)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Validation Volume</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Validations:</span>
                  <span className="font-semibold">{metrics.priceDiscrepancy.totalValidations}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Discrepancies Found:</span>
                  <span className="font-semibold text-yellow-600">{metrics.priceDiscrepancy.discrepanciesFound}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Requiring Approval:</span>
                  <span className="font-semibold text-red-600">{metrics.priceDiscrepancy.discrepanciesRequiringApproval}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {new Date(metrics.timestamp).toLocaleString()}
      </div>
    </div>
  );
}

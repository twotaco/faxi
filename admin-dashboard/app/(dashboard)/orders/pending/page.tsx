'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, CheckCircle, Clock, ExternalLink, RefreshCw } from 'lucide-react';
import { ordersApi } from '@/lib/api/client';

interface PendingOrder {
  order: {
    id: string;
    referenceId: string;
    productAsin: string | null;
    productTitle: string | null;
    productImageUrl: string | null;
    quantity: number;
    quotedPrice: number | null;
    totalAmount: number;
    currency: string;
    status: string;
    createdAt: string;
  };
  user: {
    id: string;
    name: string | null;
    phoneNumber: string;
  };
  paymentStatus: {
    method: 'card' | 'bank_transfer';
    stripePaymentIntentId: string | null;
    status: 'pending' | 'succeeded' | 'failed';
    paidAt: Date | null;
  };
  priceValidation: {
    quotedPrice: number;
    currentPrice: number | null;
    discrepancy: number;
    requiresApproval: boolean;
  };
  stockStatus: {
    available: boolean;
    checkedAt: Date;
  };
}

export default function PendingOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async () => {
    try {
      setRefreshing(true);
      const data = await ordersApi.listPending();
      setOrders(data.data.orders);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (amount: number, currency: string = 'JPY') => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Loading pending orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-700">Error Loading Orders</CardTitle>
          <CardDescription className="text-red-600">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchOrders} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pending Orders</h1>
          <p className="text-gray-500 mt-1">
            Orders awaiting admin review and purchase
          </p>
        </div>
        <Button onClick={fetchOrders} disabled={refreshing} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Purchase Queue</CardTitle>
          <CardDescription>
            {orders.length} {orders.length === 1 ? 'order' : 'orders'} ready for review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-gray-500 mt-1">No pending orders at the moment</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((item) => (
                  <TableRow key={item.order.id}>
                    <TableCell className="font-mono text-sm">
                      {item.order.referenceId}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {item.order.productImageUrl && (
                          <img
                            src={item.order.productImageUrl}
                            alt={item.order.productTitle || 'Product'}
                            className="w-12 h-12 object-cover rounded"
                          />
                        )}
                        <div>
                          <p className="font-medium line-clamp-2 max-w-xs">
                            {item.order.productTitle || 'Unknown Product'}
                          </p>
                          <p className="text-xs text-gray-500">
                            ASIN: {item.order.productAsin}
                          </p>
                          <p className="text-xs text-gray-500">
                            Qty: {item.order.quantity}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.user.name || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">{item.user.phoneNumber}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {formatPrice(item.order.quotedPrice || item.order.totalAmount, item.order.currency)}
                        </p>
                        {item.priceValidation.requiresApproval && (
                          <Badge variant="destructive" className="mt-1">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Price Changed
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getPaymentStatusBadge(item.paymentStatus.status)}
                    </TableCell>
                    <TableCell>
                      {item.stockStatus.available ? (
                        <Badge className="bg-green-500">In Stock</Badge>
                      ) : (
                        <Badge variant="destructive">Out of Stock</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDate(item.order.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => router.push(`/orders/${item.order.id}`)}
                      >
                        Review
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

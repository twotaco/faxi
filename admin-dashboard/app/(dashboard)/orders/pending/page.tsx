'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, CheckCircle, Clock, ExternalLink, RefreshCw, Package, Truck, XCircle, CreditCard } from 'lucide-react';
import { ordersApi } from '@/lib/api/client';

interface OrderItem {
  order: {
    id: string;
    referenceId: string;
    externalOrderId: string | null;
    status: string;
    totalAmount: number;
    currency: string;
    productAsin: string | null;
    productTitle: string | null;
    productImageUrl: string | null;
    quantity: number;
    quotedPrice: number | null;
    actualPrice: number | null;
    trackingNumber: string | null;
    stripePaymentIntentId: string | null;
    createdAt: string;
    updatedAt: string;
    purchasedAt: string | null;
  };
  user: {
    id: string;
    name: string | null;
    phoneNumber: string;
  } | null;
}

const ORDER_STATUSES = [
  { value: '', label: 'All Orders' },
  { value: 'pending_payment', label: 'Awaiting Payment' },
  { value: 'paid', label: 'Paid - Ready to Purchase' },
  { value: 'pending_purchase', label: 'Pending Purchase' },
  { value: 'purchased', label: 'Purchased' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || '');

  const fetchOrders = async (status?: string) => {
    try {
      setRefreshing(true);
      const data = await ordersApi.listAll({
        status: status || undefined,
        limit: 100
      });
      setOrders(data.data.orders);
      setTotal(data.data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders(selectedStatus);
  }, [selectedStatus]);

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    const url = status ? `/orders/pending?status=${status}` : '/orders/pending';
    router.push(url);
  };

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><CreditCard className="w-3 h-3 mr-1" />Awaiting Payment</Badge>;
      case 'paid':
        return <Badge className="bg-blue-500"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>;
      case 'pending_purchase':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300"><Clock className="w-3 h-3 mr-1" />Pending Purchase</Badge>;
      case 'purchased':
        return <Badge className="bg-indigo-500"><Package className="w-3 h-3 mr-1" />Purchased</Badge>;
      case 'shipped':
        return <Badge className="bg-cyan-500"><Truck className="w-3 h-3 mr-1" />Shipped</Badge>;
      case 'delivered':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Delivered</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Loading orders...</p>
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
          <Button onClick={() => fetchOrders(selectedStatus)} variant="outline">
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
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-gray-500 mt-1">
            View and manage all shopping orders
          </p>
        </div>
        <Button onClick={() => fetchOrders(selectedStatus)} disabled={refreshing} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            {ORDER_STATUSES.map((status) => (
              <Button
                key={status.value}
                variant={selectedStatus === status.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStatusChange(status.value)}
              >
                {status.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {selectedStatus
              ? ORDER_STATUSES.find(s => s.value === selectedStatus)?.label
              : 'All Orders'}
          </CardTitle>
          <CardDescription>
            {total} {total === 1 ? 'order' : 'orders'} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">No orders found</p>
              <p className="text-gray-500 mt-1">
                {selectedStatus
                  ? `No orders with status "${ORDER_STATUSES.find(s => s.value === selectedStatus)?.label}"`
                  : 'No orders have been placed yet'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
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
                            ASIN: {item.order.productAsin || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Qty: {item.order.quantity}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.user?.name || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">{item.user?.phoneNumber || 'N/A'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {formatPrice(item.order.quotedPrice || item.order.totalAmount, item.order.currency)}
                        </p>
                        {item.order.stripePaymentIntentId && (
                          <p className="text-xs text-gray-500 truncate max-w-[120px]" title={item.order.stripePaymentIntentId}>
                            PI: {item.order.stripePaymentIntentId.slice(-8)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(item.order.status)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDate(item.order.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => router.push(`/orders/${item.order.id}`)}
                      >
                        View
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

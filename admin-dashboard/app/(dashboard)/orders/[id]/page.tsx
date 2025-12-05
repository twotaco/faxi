'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle, Clock, ExternalLink, Package, RefreshCw, ShoppingCart, Truck, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ordersApi } from '@/lib/api/client';

interface OrderDetails {
  order: {
    id: string;
    referenceId: string;
    productAsin: string | null;
    productTitle: string | null;
    productImageUrl: string | null;
    quantity: number;
    quotedPrice: number | null;
    actualPrice: number | null;
    totalAmount: number;
    currency: string;
    status: string;
    shippingAddress: any;
    trackingNumber: string | null;
    externalOrderId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  validation: {
    valid: boolean;
    currentPrice: number | null;
    priceDifference: number;
    inStock: boolean;
    requiresApproval: boolean;
    warnings: string[];
  };
}

interface CheckoutSession {
  sessionId: string;
  checkoutUrl: string;
  checkoutDetails: {
    totalPrice: number;
    shippingCost: number;
    tax: number;
    estimatedDelivery: string;
    inStock: boolean;
    productTitle: string;
    currentPrice: number;
  };
  expiresAt: string;
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [checkoutSession, setCheckoutSession] = useState<CheckoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Form states
  const [amazonOrderId, setAmazonOrderId] = useState('');
  const [actualPrice, setActualPrice] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');

  const fetchOrderDetails = async () => {
    try {
      const data = await ordersApi.getById(orderId);
      setOrderDetails(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const handlePrepareCheckout = async () => {
    try {
      setPreparing(true);
      const data = await ordersApi.prepareCheckout(orderId);
      setCheckoutSession(data.data.checkoutSession);
      await fetchOrderDetails(); // Refresh order status
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to prepare checkout');
    } finally {
      setPreparing(false);
    }
  };

  const handleCompletePurchase = async () => {
    if (!amazonOrderId || !actualPrice) {
      alert('Please enter Amazon Order ID and actual price');
      return;
    }

    try {
      setCompleting(true);
      await ordersApi.completePurchase(orderId, {
        amazonOrderId,
        actualPrice: parseFloat(actualPrice)
      });
      alert('Purchase completed successfully!');
      router.push('/orders/pending');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to complete purchase');
    } finally {
      setCompleting(false);
    }
  };

  const handleUpdateTracking = async () => {
    if (!trackingNumber) {
      alert('Please enter tracking number');
      return;
    }

    try {
      await ordersApi.updateTracking(orderId, trackingNumber);
      alert('Tracking number updated successfully!');
      await fetchOrderDetails();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update tracking');
    }
  };

  const handleCancelOrder = async () => {
    if (!cancellationReason) {
      alert('Please enter cancellation reason');
      return;
    }

    if (!confirm('Are you sure you want to cancel this order?')) {
      return;
    }

    try {
      setCancelling(true);
      await ordersApi.cancel(orderId, cancellationReason);
      alert('Order cancelled successfully');
      router.push('/orders/pending');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
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
    const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
      pending_payment: { color: 'bg-yellow-500', icon: Clock, label: 'Pending Payment' },
      paid: { color: 'bg-green-500', icon: CheckCircle, label: 'Paid' },
      pending_purchase: { color: 'bg-blue-500', icon: ShoppingCart, label: 'Pending Purchase' },
      purchased: { color: 'bg-purple-500', icon: Package, label: 'Purchased' },
      shipped: { color: 'bg-indigo-500', icon: Truck, label: 'Shipped' },
      delivered: { color: 'bg-green-600', icon: CheckCircle, label: 'Delivered' },
      cancelled: { color: 'bg-red-500', icon: XCircle, label: 'Cancelled' }
    };

    const config = statusConfig[status] || { color: 'bg-gray-500', icon: Clock, label: status };
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !orderDetails) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-700">Error Loading Order</CardTitle>
          <CardDescription className="text-red-600">{error || 'Order not found'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push('/orders/pending')} variant="outline">
            Back to Orders
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { order, validation } = orderDetails;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Order Details</h1>
          <p className="text-gray-500 mt-1">Reference ID: {order.referenceId}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchOrderDetails} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => router.push('/orders/pending')} variant="outline" size="sm">
            Back to Orders
          </Button>
        </div>
      </div>

      {/* Status and Warnings */}
      <div className="flex items-center gap-4">
        {getStatusBadge(order.status)}
        {validation.warnings.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Warnings</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside">
                {validation.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Information */}
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.productImageUrl && (
              <img
                src={order.productImageUrl}
                alt={order.productTitle || 'Product'}
                className="w-full h-48 object-cover rounded"
              />
            )}
            <div>
              <Label>Product Title</Label>
              <p className="font-medium">{order.productTitle || 'Unknown Product'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ASIN</Label>
                <p className="font-mono text-sm">{order.productAsin}</p>
              </div>
              <div>
                <Label>Quantity</Label>
                <p>{order.quantity}</p>
              </div>
            </div>
            <div>
              <Label>Amazon Product Page</Label>
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => window.open(`https://www.amazon.co.jp/dp/${order.productAsin}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View on Amazon
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Price Information */}
        <Card>
          <CardHeader>
            <CardTitle>Price Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Quoted Price (shown to user)</Label>
              <p className="text-2xl font-bold">
                {formatPrice(order.quotedPrice || order.totalAmount, order.currency)}
              </p>
            </div>
            {validation.currentPrice && (
              <div>
                <Label>Current Price (from Amazon)</Label>
                <p className="text-2xl font-bold">
                  {formatPrice(validation.currentPrice, order.currency)}
                </p>
              </div>
            )}
            {validation.priceDifference > 0 && (
              <div>
                <Label>Price Difference</Label>
                <p className={`text-lg font-semibold ${validation.priceDifference > 50 ? 'text-red-600' : 'text-yellow-600'}`}>
                  {formatPrice(validation.priceDifference, order.currency)}
                  {validation.requiresApproval && (
                    <Badge variant="destructive" className="ml-2">
                      Requires Approval
                    </Badge>
                  )}
                </p>
              </div>
            )}
            {order.actualPrice && (
              <div>
                <Label>Actual Purchase Price</Label>
                <p className="text-xl font-bold text-green-600">
                  {formatPrice(order.actualPrice, order.currency)}
                </p>
              </div>
            )}
            <div>
              <Label>Stock Status</Label>
              <div className="mt-1">
                {validation.inStock ? (
                  <Badge className="bg-green-500">In Stock</Badge>
                ) : (
                  <Badge variant="destructive">Out of Stock</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Address */}
        <Card>
          <CardHeader>
            <CardTitle>Shipping Address</CardTitle>
          </CardHeader>
          <CardContent>
            {order.shippingAddress ? (
              <div className="space-y-2">
                <p className="font-medium">{order.shippingAddress.name}</p>
                <p>{order.shippingAddress.postalCode}</p>
                <p>{order.shippingAddress.prefecture} {order.shippingAddress.city}</p>
                <p>{order.shippingAddress.addressLine1}</p>
                {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                <p>Tel: {order.shippingAddress.phoneNumber}</p>
              </div>
            ) : (
              <p className="text-gray-500">No shipping address</p>
            )}
          </CardContent>
        </Card>

        {/* Order Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Order Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Created</Label>
              <p>{formatDate(order.createdAt)}</p>
            </div>
            <div>
              <Label>Last Updated</Label>
              <p>{formatDate(order.updatedAt)}</p>
            </div>
            {order.externalOrderId && (
              <div>
                <Label>Amazon Order ID</Label>
                <p className="font-mono text-sm">{order.externalOrderId}</p>
              </div>
            )}
            {order.trackingNumber && (
              <div>
                <Label>Tracking Number</Label>
                <p className="font-mono text-sm">{order.trackingNumber}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Checkout Session */}
      {checkoutSession && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle>Checkout Session Ready</CardTitle>
            <CardDescription>Review the details below and complete the purchase on Amazon</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Current Price</Label>
                <p className="text-xl font-bold">
                  {formatPrice(checkoutSession.checkoutDetails.currentPrice, order.currency)}
                </p>
              </div>
              <div>
                <Label>Estimated Delivery</Label>
                <p>{checkoutSession.checkoutDetails.estimatedDelivery}</p>
              </div>
            </div>
            <Button
              onClick={() => window.open(checkoutSession.checkoutUrl, '_blank')}
              className="w-full"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Amazon Checkout
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {order.status === 'paid' && (
        <Card>
          <CardHeader>
            <CardTitle>Prepare Checkout</CardTitle>
            <CardDescription>
              This will validate the current price and stock, then prepare the Amazon checkout page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handlePrepareCheckout}
              disabled={preparing || !validation.inStock}
              className="w-full"
            >
              {preparing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Prepare Checkout
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {(order.status === 'paid' || order.status === 'pending_purchase') && (
        <Card>
          <CardHeader>
            <CardTitle>Complete Purchase</CardTitle>
            <CardDescription>
              After manually completing the purchase on Amazon, enter the order details here
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="amazonOrderId">Amazon Order ID *</Label>
              <Input
                id="amazonOrderId"
                placeholder="123-4567890-1234567"
                value={amazonOrderId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmazonOrderId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="actualPrice">Actual Price (JPY) *</Label>
              <Input
                id="actualPrice"
                type="number"
                placeholder="1980"
                value={actualPrice}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActualPrice(e.target.value)}
              />
            </div>
            <Button
              onClick={handleCompletePurchase}
              disabled={completing || !amazonOrderId || !actualPrice}
              className="w-full"
            >
              {completing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete Purchase
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {order.status === 'purchased' && (
        <Card>
          <CardHeader>
            <CardTitle>Add Tracking Number</CardTitle>
            <CardDescription>
              Enter the tracking number to update the order status to shipped
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="trackingNumber">Tracking Number *</Label>
              <Input
                id="trackingNumber"
                placeholder="1234567890"
                value={trackingNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTrackingNumber(e.target.value)}
              />
            </div>
            <Button
              onClick={handleUpdateTracking}
              disabled={!trackingNumber}
              className="w-full"
            >
              <Truck className="w-4 h-4 mr-2" />
              Update Tracking
            </Button>
          </CardContent>
        </Card>
      )}

      {order.status !== 'cancelled' && order.status !== 'delivered' && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">Cancel Order</CardTitle>
            <CardDescription>
              Cancel this order and refund the customer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="cancellationReason">Cancellation Reason *</Label>
              <Textarea
                id="cancellationReason"
                placeholder="Product out of stock, price too high, etc."
                value={cancellationReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCancellationReason(e.target.value)}
              />
            </div>
            <Button
              onClick={handleCancelOrder}
              disabled={cancelling || !cancellationReason}
              variant="destructive"
              className="w-full"
            >
              {cancelling ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel Order
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

'use client';

import { useUser, useUserActivity, useUserOrders } from '@/lib/hooks/useUsers';
import { useParams } from 'next/navigation';
import { ArrowLeft, User, Phone, Mail, Calendar, Package, Activity } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function UserDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState<'profile' | 'activity' | 'orders'>('profile');

  const { data: userData, isLoading, error } = useUser(id);
  const { data: activityData } = useUserActivity(id);
  const { data: ordersData } = useUserOrders(id);

  const user = userData?.user;
  const activity = activityData?.activity || [];
  const orders = ordersData?.orders || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-faxi-orange mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading user details...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Failed to load user details</h3>
        <p className="text-red-600 text-sm mb-4">User not found</p>
        <Link
          href="/users"
          className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Users
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link href="/users" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">User Details</h2>
            <p className="text-sm text-gray-600 mt-1">{user.email_address}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'profile'
                  ? 'border-faxi-orange text-faxi-orange'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <User className="w-4 h-4 inline mr-2" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'activity'
                  ? 'border-faxi-orange text-faxi-orange'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Activity className="w-4 h-4 inline mr-2" />
              Activity
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'orders'
                  ? 'border-faxi-orange text-faxi-orange'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Package className="w-4 h-4 inline mr-2" />
              Orders ({orders.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-3">Contact Information</h4>
                  <dl className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <div>
                        <dt className="text-xs text-gray-500">Phone Number</dt>
                        <dd className="text-sm font-medium text-gray-900">{user.phone_number}</dd>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <div>
                        <dt className="text-xs text-gray-500">Email</dt>
                        <dd className="text-sm font-medium text-gray-900">{user.email_address}</dd>
                      </div>
                    </div>
                    {user.name && (
                      <div className="flex items-center space-x-3">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <dt className="text-xs text-gray-500">Name</dt>
                          <dd className="text-sm font-medium text-gray-900">{user.name}</dd>
                        </div>
                      </div>
                    )}
                  </dl>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-3">Account Information</h4>
                  <dl className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <dt className="text-xs text-gray-500">Created</dt>
                        <dd className="text-sm font-medium text-gray-900">
                          {new Date(user.created_at).toLocaleString()}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <dt className="text-xs text-gray-500">Last Updated</dt>
                        <dd className="text-sm font-medium text-gray-900">
                          {new Date(user.updated_at).toLocaleString()}
                        </dd>
                      </div>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div>
              {activity.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No activity logs</p>
              ) : (
                <div className="space-y-3">
                  {activity.map((log: any) => (
                    <div key={log.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-800">{log.event_type}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div>
              {orders.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No orders</p>
              ) : (
                <div className="space-y-3">
                  {orders.map((order: any) => (
                    <div key={order.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm font-medium">{order.reference_id}</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-semibold">¥{order.total_amount.toLocaleString()}</span>
                        {' • '}
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

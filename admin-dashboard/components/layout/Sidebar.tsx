'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Users,
  Server,
  Brain,
  Bell,
  BarChart3,
  FileSearch,
  ShoppingCart,
  BookOpen,
  Mail
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Fax Jobs', href: '/jobs', icon: FileText },
  { name: 'Orders', href: '/orders/pending', icon: ShoppingCart },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Email', href: '/email', icon: Mail },
  { name: 'MCP Servers', href: '/mcp', icon: Server },
  { name: 'AI Inspector', href: '/ai', icon: Brain },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Audit Logs', href: '/audit', icon: FileSearch },
  { name: 'Guides', href: '/guides', icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-faxi-orange rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">F</span>
          </div>
          <span className="text-xl font-bold text-gray-800">Faxi Admin</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors
                ${isActive 
                  ? 'bg-faxi-orange text-white' 
                  : 'text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          <p>Faxi Admin v1.0.0</p>
          <p className="mt-1">© 2025 Faxi</p>
        </div>
      </div>
    </aside>
  );
}

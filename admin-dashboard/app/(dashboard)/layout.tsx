import type { Metadata } from 'next';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { Breadcrumb } from '@/components/layout/Breadcrumb';

export const metadata: Metadata = {
  title: 'Faxi Admin Dashboard',
  description: 'Faxi Admin Dashboard - Operations and Management',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content */}
        <main className="flex-1">
          {/* Top bar */}
          <TopBar />

          {/* Page content */}
          <div className="p-6">
            <Breadcrumb />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

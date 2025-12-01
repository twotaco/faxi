import Link from 'next/link';
import { BookOpen, Rocket, Shield, Database, Code, AlertTriangle, Terminal } from 'lucide-react';

const guides = [
  {
    title: 'Deployment Guide',
    description: 'Learn how to deploy Faxi to staging and production environments',
    href: '/guides/deployment',
    icon: Rocket,
    color: 'bg-blue-500',
  },
  {
    title: 'Deployment MCP Server',
    description: 'Intelligent deployment automation with AI-powered analysis and rollback',
    href: '/guides/deployment-mcp',
    icon: Terminal,
    color: 'bg-cyan-500',
  },
  {
    title: 'Security & Secrets',
    description: 'Managing environment variables and secrets validation',
    href: '/guides/security',
    icon: Shield,
    color: 'bg-green-500',
  },
  {
    title: 'Database Operations',
    description: 'Running migrations and managing database state',
    href: '/guides/database',
    icon: Database,
    color: 'bg-purple-500',
  },
  {
    title: 'Troubleshooting',
    description: 'Common issues and how to resolve them',
    href: '/guides/troubleshooting',
    icon: AlertTriangle,
    color: 'bg-yellow-500',
  },
  {
    title: 'Development Setup',
    description: 'Setting up local development environment',
    href: '/guides/development',
    icon: Code,
    color: 'bg-indigo-500',
  },
];

export default function GuidesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Guides</h1>
        <p className="mt-2 text-gray-600">
          Documentation and guides for managing the Faxi platform
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {guides.map((guide) => {
          const Icon = guide.icon;
          return (
            <Link
              key={guide.href}
              href={guide.href}
              className="block p-6 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start space-x-4">
                <div className={`${guide.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {guide.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {guide.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <BookOpen className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900">Need Help?</h3>
            <p className="mt-1 text-sm text-blue-700">
              If you can't find what you're looking for, check the{' '}
              <a href="https://github.com/faxi/docs" className="underline">
                full documentation
              </a>{' '}
              or contact the development team.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Terminal, Server, Database, Shield } from 'lucide-react';
import Link from 'next/link';

export default function DeploymentGuidePage() {
  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <Link 
          href="/guides" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Guides
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Deployment Guide</h1>
        <p className="mt-2 text-gray-600">
          Complete guide to deploying Faxi to staging and production environments
        </p>
      </div>

      {/* Overview */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Overview</h2>
        <p className="text-gray-700 mb-4">
          The Faxi deployment system uses the Deployment MCP Server to orchestrate deployments
          with automated pre-flight checks, health monitoring, and rollback capabilities.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Automated Validation</p>
              <p className="text-sm text-gray-600">Pre-flight checks verify secrets and configuration</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Health Monitoring</p>
              <p className="text-sm text-gray-600">Continuous health checks during deployment</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Log Analysis</p>
              <p className="text-sm text-gray-600">Automatic error detection in deployment logs</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Rollback Support</p>
              <p className="text-sm text-gray-600">Quick rollback to previous stable version</p>
            </div>
          </div>
        </div>
      </section>

      {/* Prerequisites */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Prerequisites</h2>
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Environment Variables</p>
              <p className="text-sm text-gray-600">All required secrets must be configured in .env files</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <Database className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Database Migrations</p>
              <p className="text-sm text-gray-600">Ensure all migrations are ready to run</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <Server className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Infrastructure Access</p>
              <p className="text-sm text-gray-600">AWS credentials and kubectl access configured</p>
            </div>
          </div>
        </div>
      </section>

      {/* Deployment Steps */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Deployment Steps</h2>
        
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">1. Pre-Flight Checks</h3>
            <p className="text-sm text-gray-700 mb-3">
              The deployment orchestrator automatically runs pre-flight checks to validate:
            </p>
            <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
              <li>All required environment variables are set</li>
              <li>Database connection is available</li>
              <li>Redis connection is available</li>
              <li>S3 storage is accessible</li>
              <li>External API credentials are valid (Telnyx, Stripe, AWS SES)</li>
            </ul>
            <div className="mt-3 bg-gray-50 rounded p-3">
              <code className="text-sm text-gray-800">
                # Pre-flight checks run automatically<br/>
                # In TEST_MODE, checks are skipped for faster testing
              </code>
            </div>
          </div>

          {/* Step 2 */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">2. Deploy Application</h3>
            <p className="text-sm text-gray-700 mb-3">
              Deploy using your preferred method:
            </p>
            <div className="bg-gray-50 rounded p-3 space-y-2">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Docker Compose (Staging)</p>
                <code className="text-sm text-gray-800">
                  docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
                </code>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Kubernetes (Production)</p>
                <code className="text-sm text-gray-800">
                  kubectl apply -f k8s/
                </code>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">AWS ECS (Production)</p>
                <code className="text-sm text-gray-800">
                  ./scripts/aws-deploy.sh production
                </code>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">3. Run Database Migrations</h3>
            <p className="text-sm text-gray-700 mb-3">
              Apply database schema changes:
            </p>
            <div className="bg-gray-50 rounded p-3">
              <code className="text-sm text-gray-800">
                cd backend<br/>
                npm run migrate
              </code>
            </div>
            <div className="mt-2 flex items-start space-x-2 text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <p>Always backup the database before running migrations in production</p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">4. Health Checks</h3>
            <p className="text-sm text-gray-700 mb-3">
              The deployment orchestrator monitors application health:
            </p>
            <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
              <li>HTTP endpoint health checks (every 10 seconds)</li>
              <li>Database connectivity verification</li>
              <li>Redis queue health monitoring</li>
              <li>MCP server availability checks</li>
            </ul>
            <div className="mt-3 bg-green-50 border border-green-200 rounded p-3">
              <p className="text-sm text-green-800">
                <CheckCircle className="w-4 h-4 inline mr-1" />
                Health checks pass when all services respond successfully for 30 seconds
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">5. Log Analysis</h3>
            <p className="text-sm text-gray-700 mb-3">
              Automatic log monitoring detects issues:
            </p>
            <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
              <li>Error patterns in application logs</li>
              <li>Database connection failures</li>
              <li>API authentication errors</li>
              <li>Memory or resource warnings</li>
            </ul>
            <div className="mt-3 bg-gray-50 rounded p-3">
              <code className="text-sm text-gray-800">
                # View deployment logs<br/>
                kubectl logs -f deployment/faxi-backend --tail=100
              </code>
            </div>
          </div>

          {/* Step 6 */}
          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">6. Verify Deployment</h3>
            <p className="text-sm text-gray-700 mb-3">
              Confirm the deployment is successful:
            </p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-gray-700">Check admin dashboard at http://localhost:4001</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-gray-700">Verify backend API at http://localhost:4000/health</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-gray-700">Test a sample fax workflow</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-gray-700">Review metrics and monitoring dashboards</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Rollback */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Rollback Procedure</h2>
        <p className="text-gray-700 mb-4">
          If issues are detected during or after deployment, rollback to the previous version:
        </p>
        
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <h3 className="font-semibold text-red-900 mb-2">When to Rollback</h3>
            <ul className="text-sm text-red-800 space-y-1 ml-4 list-disc">
              <li>Health checks fail after deployment</li>
              <li>Critical errors appear in logs</li>
              <li>Database migration fails</li>
              <li>User-facing functionality is broken</li>
            </ul>
          </div>

          <div className="bg-gray-50 rounded p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Rollback Commands</h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Kubernetes</p>
                <code className="text-sm text-gray-800">
                  kubectl rollout undo deployment/faxi-backend
                </code>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Docker Compose</p>
                <code className="text-sm text-gray-800">
                  docker-compose down && git checkout previous-tag && docker-compose up -d
                </code>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Environment-Specific Notes */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Environment-Specific Notes</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Development</h3>
            <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
              <li>Set <code className="bg-gray-100 px-1 rounded">TEST_MODE=true</code> to skip pre-flight checks</li>
              <li>Use mock services for Telnyx and Stripe</li>
              <li>MinIO for S3 storage instead of AWS S3</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Staging</h3>
            <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
              <li>Use staging environment variables (.env.staging)</li>
              <li>Test with real external services but sandbox accounts</li>
              <li>Run full integration test suite before promoting to production</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Production</h3>
            <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
              <li>All pre-flight checks must pass</li>
              <li>Deploy during low-traffic windows</li>
              <li>Have rollback plan ready</li>
              <li>Monitor metrics closely for 1 hour post-deployment</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Common Issues</h2>
        
        <div className="space-y-4">
          <div className="border-l-4 border-yellow-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-1">Pre-flight checks fail</h3>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Solution:</strong> Review the specific check that failed and verify the corresponding environment variable or service connection.
            </p>
            <code className="text-xs text-gray-600">
              Check logs for: "Pre-flight check failed: [specific check]"
            </code>
          </div>

          <div className="border-l-4 border-yellow-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-1">Health checks timeout</h3>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Solution:</strong> Ensure the application is fully started and all dependencies (database, Redis) are accessible.
            </p>
            <code className="text-xs text-gray-600">
              curl http://localhost:4000/health
            </code>
          </div>

          <div className="border-l-4 border-yellow-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-1">Database migration fails</h3>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Solution:</strong> Check migration logs, verify database connectivity, and ensure no conflicting schema changes.
            </p>
            <code className="text-xs text-gray-600">
              npm run migrate -- --verbose
            </code>
          </div>
        </div>
      </section>

      {/* Related Resources */}
      <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-3">Related Resources</h2>
        <div className="space-y-2">
          <Link href="/guides/security" className="block text-sm text-blue-700 hover:text-blue-900 underline">
            → Security & Secrets Management
          </Link>
          <Link href="/guides/database" className="block text-sm text-blue-700 hover:text-blue-900 underline">
            → Database Operations Guide
          </Link>
          <Link href="/guides/troubleshooting" className="block text-sm text-blue-700 hover:text-blue-900 underline">
            → Troubleshooting Guide
          </Link>
        </div>
      </section>
    </div>
  );
}

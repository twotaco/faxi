import { ArrowLeft, Rocket, Server, Database, Shield, Terminal, AlertTriangle, CheckCircle, Code, GitBranch, Activity, FileText, Package, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function DeploymentMcpGuidePage() {
  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <Link 
          href="/guides" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Guides
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Deployment MCP Server</h1>
        <p className="mt-2 text-gray-600">
          Comprehensive guide to the Deployment Model Context Protocol server for intelligent, automated deployments
        </p>
      </div>

      {/* Overview */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Overview</h2>
        <p className="text-gray-700 mb-4">
          The Deployment MCP is a Model Context Protocol server that provides comprehensive deployment automation 
          for the Faxi application. It orchestrates end-to-end deployments, performs multi-tier health checks, 
          provides AI-powered log analysis, manages intelligent rollbacks, and ensures deployment safety through 
          secrets verification, drift detection, and integration testing.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <Rocket className="w-6 h-6 text-blue-600 mb-2" />
            <h3 className="font-semibold text-blue-900 mb-1">Zero-Downtime</h3>
            <p className="text-sm text-blue-700">Health checks and gradual rollouts</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <Shield className="w-6 h-6 text-green-600 mb-2" />
            <h3 className="font-semibold text-green-900 mb-1">Zero-Fear</h3>
            <p className="text-sm text-green-700">Comprehensive validation and automatic rollback</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <Activity className="w-6 h-6 text-purple-600 mb-2" />
            <h3 className="font-semibold text-purple-900 mb-1">Zero-Surprise</h3>
            <p className="text-sm text-purple-700">Pre-flight checks and drift detection</p>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Architecture</h2>
        <p className="text-gray-700 mb-4">
          The Deployment MCP consists of multiple specialized services that work together to provide 
          comprehensive deployment automation:
        </p>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <pre className="text-xs text-gray-800 overflow-x-auto">
{`┌─────────────────────────────────────────────────────────────┐
│                    Deployment MCP Server                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Orchestration│  │   Health     │  │     Log      │      │
│  │   Service    │  │   Service    │  │   Analysis   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Rollback   │  │   Secrets    │  │    Drift     │      │
│  │   Manager    │  │  Validator   │  │   Detector   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Integration  │  │    Script    │  │  Dependency  │      │
│  │    Tester    │  │   Auditor    │  │   Analyzer   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘`}
          </pre>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">Core Services</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• <strong>Orchestration:</strong> Coordinates deployment workflow</li>
              <li>• <strong>Health Checks:</strong> Multi-tier validation (system, smoke, E2E)</li>
              <li>• <strong>Log Analysis:</strong> AI-powered error diagnosis</li>
              <li>• <strong>Rollback Manager:</strong> Intelligent version recovery</li>
            </ul>
          </div>
          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">Safety Services</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• <strong>Secrets Validator:</strong> Environment variable verification</li>
              <li>• <strong>Drift Detector:</strong> Configuration consistency checks</li>
              <li>• <strong>Integration Tester:</strong> External service validation</li>
              <li>• <strong>Dependency Analyzer:</strong> Security vulnerability scanning</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Configuration */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Configuration</h2>
        <p className="text-gray-700 mb-4">
          The Deployment MCP is configured through environment variables:
        </p>
        
        <div className="space-y-3">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <code className="text-sm font-semibold text-gray-900">DEPLOYMENT_ENVIRONMENTS</code>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">String</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              Comma-separated list of available deployment environments
            </p>
            <code className="text-xs text-gray-600">Default: "development,staging,production"</code>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <code className="text-sm font-semibold text-gray-900">DEPLOYMENT_STRATEGY</code>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">String</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              Default deployment strategy (rolling, blue-green, or canary)
            </p>
            <code className="text-xs text-gray-600">Default: "rolling"</code>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <code className="text-sm font-semibold text-gray-900">HEALTH_CHECK_TIMEOUT</code>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Number</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              Maximum time (in seconds) to wait for health checks to pass
            </p>
            <code className="text-xs text-gray-600">Default: 300 (5 minutes)</code>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <code className="text-sm font-semibold text-gray-900">ROLLBACK_ENABLED</code>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Boolean</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              Enable automatic rollback on deployment failure
            </p>
            <code className="text-xs text-gray-600">Default: true</code>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <code className="text-sm font-semibold text-gray-900">LOG_ANALYSIS_MODEL</code>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">String</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              Gemini model to use for AI-powered log analysis
            </p>
            <code className="text-xs text-gray-600">Default: "gemini-2.0-flash"</code>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <code className="text-sm font-semibold text-gray-900">INTEGRATION_TEST_TIMEOUT</code>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Number</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              Maximum time (in seconds) for integration tests to complete
            </p>
            <code className="text-xs text-gray-600">Default: 600 (10 minutes)</code>
          </div>
        </div>
      </section>

      {/* Available Tools - Deployment Operations */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Rocket className="w-5 h-5 mr-2 text-blue-600" />
          Deployment Operations
        </h2>
        
        <div className="space-y-6">
          {/* deploy_full */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-blue-600">deploy_full</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Deploy all components with full orchestration, including pre-flight checks, builds, tests, 
              and health validation.
            </p>
            <div className="bg-gray-50 rounded p-3 mb-2">
              <p className="text-xs font-semibold text-gray-600 mb-2">Parameters:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <code>environment</code> (required): "development" | "staging" | "production"</li>
                <li>• <code>components</code> (required): Array of "backend" | "admin-dashboard" | "marketing-website"</li>
                <li>• <code>strategy</code>: "rolling" | "blue-green" | "canary"</li>
                <li>• <code>runMigrations</code>: boolean - Execute database migrations</li>
                <li>• <code>runTests</code>: "none" | "smoke" | "e2e" | "full"</li>
                <li>• <code>autoRollback</code>: boolean - Enable automatic rollback on failure</li>
              </ul>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-xs font-semibold text-blue-900 mb-1">Example:</p>
              <pre className="text-xs text-blue-800 overflow-x-auto">
{`{
  "environment": "staging",
  "components": ["backend", "admin-dashboard"],
  "strategy": "rolling",
  "runMigrations": true,
  "runTests": "smoke",
  "autoRollback": true
}`}
              </pre>
            </div>
          </div>

          {/* deploy_partial */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-blue-600">deploy_partial</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Deploy only changed components based on git commit analysis. Automatically detects which 
              components need deployment.
            </p>
            <div className="bg-gray-50 rounded p-3 mb-2">
              <p className="text-xs font-semibold text-gray-600 mb-2">Parameters:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <code>environment</code> (required): Target environment</li>
                <li>• <code>fromCommit</code>: Starting commit hash for change detection</li>
                <li>• <code>toCommit</code>: Ending commit hash (defaults to HEAD)</li>
                <li>• <code>detectBreakingChanges</code>: boolean - Highlight breaking changes</li>
              </ul>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-xs font-semibold text-blue-900 mb-1">Example:</p>
              <pre className="text-xs text-blue-800 overflow-x-auto">
{`{
  "environment": "staging",
  "fromCommit": "abc123",
  "toCommit": "HEAD",
  "detectBreakingChanges": true
}`}
              </pre>
            </div>
          </div>

          {/* deploy_cross_environment */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-blue-600">deploy_cross_environment</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Promote a deployment from one environment to another (e.g., staging → production).
            </p>
            <div className="bg-gray-50 rounded p-3 mb-2">
              <p className="text-xs font-semibold text-gray-600 mb-2">Parameters:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <code>sourceEnvironment</code> (required): Source environment</li>
                <li>• <code>targetEnvironment</code> (required): Target environment</li>
                <li>• <code>verifySecrets</code>: boolean - Verify secrets match target</li>
                <li>• <code>createDiffReport</code>: boolean - Generate environment diff report</li>
              </ul>
            </div>
          </div>

          {/* plan_deployment */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-blue-600">plan_deployment</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Generate a detailed deployment plan without executing it. Shows exact sequence of operations.
            </p>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Parameters:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <code>environment</code> (required): Target environment</li>
                <li>• <code>components</code> (required): Array of components to deploy</li>
              </ul>
            </div>
          </div>

          {/* simulate_deployment */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-blue-600">simulate_deployment</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Dry-run a deployment plan to validate without making any changes.
            </p>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Parameters:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <code>plan</code> (required): Deployment plan object from plan_deployment</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Available Tools - Health & Validation */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-green-600" />
          Health & Validation
        </h2>
        
        <div className="space-y-6">
          {/* check_health */}
          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-green-600">check_health</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Perform multi-tier health checks on the deployed system.
            </p>
            <div className="bg-gray-50 rounded p-3 mb-2">
              <p className="text-xs font-semibold text-gray-600 mb-2">Health Check Tiers:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <strong>Tier 0 (System):</strong> Services running, ports responding, database/Redis/S3 accessible</li>
                <li>• <strong>Tier 1 (Smoke):</strong> API endpoints, webhooks, NLP agent, core business logic</li>
                <li>• <strong>Tier 2 (E2E):</strong> End-to-end functional tests for critical user paths</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Parameters:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <code>tier</code> (required): 0 | 1 | 2</li>
                <li>• <code>environment</code> (required): Target environment</li>
              </ul>
            </div>
          </div>

          {/* run_smoke_tests */}
          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-green-600">run_smoke_tests</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Run API-level smoke tests to verify critical functionality.
            </p>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Parameters:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <code>environment</code> (required): Target environment</li>
              </ul>
            </div>
          </div>

          {/* run_e2e_tests */}
          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-green-600">run_e2e_tests</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Run end-to-end functional tests for complete user workflows.
            </p>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Parameters:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <code>environment</code> (required): Target environment</li>
                <li>• <code>scope</code>: "critical" | "changed" | "full"</li>
              </ul>
            </div>
          </div>

          {/* verify_secrets */}
          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-green-600">verify_secrets</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Validate that all required environment variables and secrets are properly configured.
            </p>
            <div className="bg-gray-50 rounded p-3 mb-2">
              <p className="text-xs font-semibold text-gray-600 mb-2">Checks:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• All required secrets exist</li>
                <li>• API key formats are valid (JWT, URLs, key patterns)</li>
                <li>• Secrets match target environment (no prod keys in staging)</li>
                <li>• No leaked secrets in logs or commits</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Parameters:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <code>environment</code> (required): Target environment</li>
              </ul>
            </div>
          </div>

          {/* detect_drift */}
          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-green-600">detect_drift</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Detect configuration drift between two environments.
            </p>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Parameters:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <code>source</code> (required): Source environment</li>
                <li>• <code>target</code> (required): Target environment</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Available Tools - Analysis & Maintenance */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Terminal className="w-5 h-5 mr-2 text-purple-600" />
          Analysis & Maintenance
        </h2>
        
        <div className="space-y-6">
          {/* analyze_logs */}
          <div className="border-l-4 border-purple-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-purple-600">analyze_logs</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              AI-powered log analysis using Gemini to categorize errors and suggest fixes.
            </p>
            <div className="bg-gray-50 rounded p-3 mb-2">
              <p className="text-xs font-semibold text-gray-600 mb-2">Log Sources:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <strong>build:</strong> Build process logs</li>
                <li>• <strong>deployment:</strong> Deployment orchestration logs</li>
                <li>• <strong>service:</strong> Application service logs</li>
                <li>• <strong>docker:</strong> Docker container logs</li>
                <li>• <strong>systemd:</strong> System service logs</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded p-3 mb-2">
              <p className="text-xs font-semibold text-gray-600 mb-2">Parameters:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <code>sources</code> (required): Array of log sources to analyze</li>
                <li>• <code>environment</code> (required): Target environment</li>
                <li>• <code>timeRange</code>: Object with start and end timestamps</li>
              </ul>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded p-3">
              <p className="text-xs font-semibold text-purple-900 mb-1">Example:</p>
              <pre className="text-xs text-purple-800 overflow-x-auto">
{`{
  "sources": ["service", "docker"],
  "environment": "production",
  "timeRange": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-01T23:59:59Z"
  }
}`}
              </pre>
            </div>
          </div>

          {/* test_integrations */}
          <div className="border-l-4 border-purple-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-purple-600">test_integrations</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Test connectivity and API key validity for external services.
            </p>
            <div className="bg-gray-50 rounded p-3 mb-2">
              <p className="text-xs font-semibold text-gray-600 mb-2">Supported Services:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <strong>telnyx:</strong> Fax service API</li>
                <li>• <strong>stripe:</strong> Payment processing</li>
                <li>• <strong>aws-ses:</strong> Email sending service</li>
                <li>• <strong>s3:</strong> Object storage</li>
                <li>• <strong>gemini:</strong> AI/ML service</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Parameters:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <code>environment</code> (required): Target environment</li>
                <li>• <code>services</code>: Array of services to test (defaults to all)</li>
              </ul>
            </div>
          </div>

          {/* audit_scripts */}
          <div className="border-l-4 border-purple-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-purple-600">audit_scripts</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Audit deployment scripts for broken paths, missing commands, and inconsistencies.
            </p>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Analyzes:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• Bash scripts in scripts/ directory</li>
                <li>• Dockerfiles and docker-compose.yml</li>
                <li>• Kubernetes manifests</li>
                <li>• CI/CD workflow files</li>
              </ul>
            </div>
          </div>

          {/* analyze_dependencies */}
          <div className="border-l-4 border-purple-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-purple-600">analyze_dependencies</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Scan for dependency vulnerabilities, outdated packages, and lockfile inconsistencies.
            </p>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Checks:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• Known security vulnerabilities (npm audit)</li>
                <li>• Outdated packages by severity</li>
                <li>• package.json and package-lock.json consistency</li>
                <li>• Breaking version changes (major version jumps)</li>
              </ul>
            </div>
          </div>

          {/* generate_release_notes */}
          <div className="border-l-4 border-purple-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-purple-600">generate_release_notes</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Automatically generate release notes from git commit history.
            </p>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Parameters:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <code>fromVersion</code> (required): Starting version/tag</li>
                <li>• <code>toVersion</code> (required): Ending version/tag</li>
                <li>• <code>format</code>: "markdown" | "html" | "json"</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Available Tools - Rollback & Recovery */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <RefreshCw className="w-5 h-5 mr-2 text-red-600" />
          Rollback & Recovery
        </h2>
        
        <div className="space-y-6">
          {/* rollback */}
          <div className="border-l-4 border-red-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-red-600">rollback</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Rollback to a previous stable version after a failed deployment.
            </p>
            <div className="bg-gray-50 rounded p-3 mb-2">
              <p className="text-xs font-semibold text-gray-600 mb-2">Parameters:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <code>environment</code> (required): Target environment</li>
                <li>• <code>targetVersion</code>: Specific version to rollback to (defaults to last stable)</li>
                <li>• <code>rollbackMigrations</code>: boolean - Execute down migrations</li>
              </ul>
            </div>
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-xs font-semibold text-red-900 mb-1">⚠️ Warning:</p>
              <p className="text-xs text-red-800">
                Database migration rollbacks may result in data loss. Always backup before rolling back migrations.
              </p>
            </div>
          </div>

          {/* get_last_stable_version */}
          <div className="border-l-4 border-red-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-red-600">get_last_stable_version</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Retrieve information about the last known stable version for an environment.
            </p>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Parameters:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <code>environment</code> (required): Target environment</li>
              </ul>
            </div>
          </div>

          {/* create_snapshot */}
          <div className="border-l-4 border-red-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-red-600">create_snapshot</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Create a snapshot of the current deployment state for potential restoration.
            </p>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Parameters:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <code>environment</code> (required): Target environment</li>
              </ul>
            </div>
          </div>

          {/* restore_snapshot */}
          <div className="border-l-4 border-red-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              <code className="text-red-600">restore_snapshot</code>
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Restore a deployment from a previously created snapshot.
            </p>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Parameters:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <code>snapshotId</code> (required): ID of the snapshot to restore</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Common Usage Scenarios */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Common Usage Scenarios</h2>
        
        <div className="space-y-6">
          {/* Scenario 1 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Scenario 1: Full Production Deployment
            </h3>
            <p className="text-sm text-blue-800 mb-3">
              Deploy all components to production with full validation and automatic rollback.
            </p>
            <div className="bg-white rounded p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Steps:</p>
              <ol className="text-xs text-gray-700 space-y-2 list-decimal ml-4">
                <li>Verify secrets: <code className="bg-gray-100 px-1 rounded">verify_secrets</code></li>
                <li>Check for drift: <code className="bg-gray-100 px-1 rounded">detect_drift</code> (staging → production)</li>
                <li>Create snapshot: <code className="bg-gray-100 px-1 rounded">create_snapshot</code></li>
                <li>Deploy: <code className="bg-gray-100 px-1 rounded">deploy_full</code> with autoRollback=true</li>
                <li>Monitor health: <code className="bg-gray-100 px-1 rounded">check_health</code> (all tiers)</li>
              </ol>
            </div>
          </div>

          {/* Scenario 2 */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2 flex items-center">
              <GitBranch className="w-4 h-4 mr-2" />
              Scenario 2: Quick Hotfix Deployment
            </h3>
            <p className="text-sm text-green-800 mb-3">
              Deploy only changed components after a critical bug fix.
            </p>
            <div className="bg-white rounded p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Steps:</p>
              <ol className="text-xs text-gray-700 space-y-2 list-decimal ml-4">
                <li>Analyze changes: <code className="bg-gray-100 px-1 rounded">deploy_partial</code> with detectBreakingChanges=true</li>
                <li>Run smoke tests: <code className="bg-gray-100 px-1 rounded">run_smoke_tests</code></li>
                <li>Deploy if safe, rollback if issues detected</li>
              </ol>
            </div>
          </div>

          {/* Scenario 3 */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 mb-2 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Scenario 3: Troubleshooting Failed Deployment
            </h3>
            <p className="text-sm text-purple-800 mb-3">
              Diagnose and fix issues after a deployment failure.
            </p>
            <div className="bg-white rounded p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Steps:</p>
              <ol className="text-xs text-gray-700 space-y-2 list-decimal ml-4">
                <li>Analyze logs: <code className="bg-gray-100 px-1 rounded">analyze_logs</code> for all sources</li>
                <li>Check integrations: <code className="bg-gray-100 px-1 rounded">test_integrations</code></li>
                <li>Verify secrets: <code className="bg-gray-100 px-1 rounded">verify_secrets</code></li>
                <li>If unfixable, rollback: <code className="bg-gray-100 px-1 rounded">rollback</code></li>
              </ol>
            </div>
          </div>

          {/* Scenario 4 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2 flex items-center">
              <Server className="w-4 h-4 mr-2" />
              Scenario 4: Pre-Deployment Validation
            </h3>
            <p className="text-sm text-yellow-800 mb-3">
              Validate environment before deploying to catch issues early.
            </p>
            <div className="bg-white rounded p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Steps:</p>
              <ol className="text-xs text-gray-700 space-y-2 list-decimal ml-4">
                <li>Plan deployment: <code className="bg-gray-100 px-1 rounded">plan_deployment</code></li>
                <li>Simulate: <code className="bg-gray-100 px-1 rounded">simulate_deployment</code></li>
                <li>Verify secrets: <code className="bg-gray-100 px-1 rounded">verify_secrets</code></li>
                <li>Check dependencies: <code className="bg-gray-100 px-1 rounded">analyze_dependencies</code></li>
                <li>Audit scripts: <code className="bg-gray-100 px-1 rounded">audit_scripts</code></li>
                <li>Proceed with deployment if all checks pass</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Troubleshooting Guide */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Troubleshooting Guide</h2>
        
        <div className="space-y-4">
          {/* Issue 1 */}
          <div className="border-l-4 border-yellow-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-1">
              Health checks fail after deployment
            </h3>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Symptoms:</strong> Deployment completes but health checks timeout or fail
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Possible Causes:</strong>
            </p>
            <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc mb-2">
              <li>Services not fully started</li>
              <li>Database connection issues</li>
              <li>Missing environment variables</li>
              <li>Port conflicts</li>
            </ul>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Solutions:</strong>
            </p>
            <ol className="text-sm text-gray-700 space-y-1 ml-4 list-decimal">
              <li>Check service logs: <code className="bg-gray-100 px-1 rounded text-xs">analyze_logs</code></li>
              <li>Verify all secrets: <code className="bg-gray-100 px-1 rounded text-xs">verify_secrets</code></li>
              <li>Test integrations: <code className="bg-gray-100 px-1 rounded text-xs">test_integrations</code></li>
              <li>Increase HEALTH_CHECK_TIMEOUT if services are slow to start</li>
            </ol>
          </div>

          {/* Issue 2 */}
          <div className="border-l-4 border-yellow-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-1">
              Secrets verification fails
            </h3>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Symptoms:</strong> Pre-flight checks fail with missing or invalid secrets
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Solutions:</strong>
            </p>
            <ol className="text-sm text-gray-700 space-y-1 ml-4 list-decimal">
              <li>Compare .env.example with actual .env file</li>
              <li>Check for typos in environment variable names</li>
              <li>Verify API key formats (JWT structure, URL format)</li>
              <li>Ensure staging/production keys match the target environment</li>
              <li>Check for accidentally committed secrets in git history</li>
            </ol>
          </div>

          {/* Issue 3 */}
          <div className="border-l-4 border-yellow-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-1">
              Database migration fails
            </h3>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Symptoms:</strong> Deployment fails during migration step
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Solutions:</strong>
            </p>
            <ol className="text-sm text-gray-700 space-y-1 ml-4 list-decimal">
              <li>Check database connectivity</li>
              <li>Verify migration files are in correct order</li>
              <li>Check for conflicting schema changes</li>
              <li>Review migration logs for specific SQL errors</li>
              <li>If safe, rollback failed migration and fix issues</li>
            </ol>
          </div>

          {/* Issue 4 */}
          <div className="border-l-4 border-yellow-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-1">
              Configuration drift detected
            </h3>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Symptoms:</strong> Drift detector shows inconsistencies between environments
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Solutions:</strong>
            </p>
            <ol className="text-sm text-gray-700 space-y-1 ml-4 list-decimal">
              <li>Review drift report to identify specific differences</li>
              <li>Update target environment configuration to match source</li>
              <li>Document intentional differences (e.g., different API endpoints)</li>
              <li>Re-run drift detection to verify fixes</li>
            </ol>
          </div>

          {/* Issue 5 */}
          <div className="border-l-4 border-yellow-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-1">
              Integration tests fail
            </h3>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Symptoms:</strong> External service connectivity tests fail
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Solutions:</strong>
            </p>
            <ol className="text-sm text-gray-700 space-y-1 ml-4 list-decimal">
              <li>Verify API keys are valid and not expired</li>
              <li>Check for service outages or maintenance windows</li>
              <li>Verify network connectivity and firewall rules</li>
              <li>Check rate limits haven't been exceeded</li>
              <li>Test with curl/postman to isolate the issue</li>
            </ol>
          </div>

          {/* Issue 6 */}
          <div className="border-l-4 border-yellow-500 pl-4">
            <h3 className="font-semibold text-gray-900 mb-1">
              Rollback fails
            </h3>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Symptoms:</strong> Automatic rollback encounters errors
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Solutions:</strong>
            </p>
            <ol className="text-sm text-gray-700 space-y-1 ml-4 list-decimal">
              <li>Check if previous version is still available</li>
              <li>Verify git repository state</li>
              <li>If migration rollback fails, restore from database backup</li>
              <li>Use snapshot restore as last resort: <code className="bg-gray-100 px-1 rounded text-xs">restore_snapshot</code></li>
              <li>Contact development team if manual intervention needed</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Best Practices */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Best Practices</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2 flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Do
            </h3>
            <ul className="text-sm text-green-800 space-y-2">
              <li>✓ Always create snapshots before production deployments</li>
              <li>✓ Run full health checks (all tiers) after deployment</li>
              <li>✓ Enable automatic rollback for production</li>
              <li>✓ Verify secrets before every deployment</li>
              <li>✓ Check for drift between staging and production</li>
              <li>✓ Use partial deployments for quick fixes</li>
              <li>✓ Generate release notes for documentation</li>
              <li>✓ Monitor logs for 1 hour post-deployment</li>
              <li>✓ Test integrations after environment changes</li>
              <li>✓ Keep dependencies up to date</li>
            </ul>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-900 mb-2 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Don't
            </h3>
            <ul className="text-sm text-red-800 space-y-2">
              <li>✗ Deploy to production without testing in staging</li>
              <li>✗ Skip pre-flight checks to save time</li>
              <li>✗ Ignore drift detection warnings</li>
              <li>✗ Deploy during peak traffic hours</li>
              <li>✗ Rollback migrations without database backup</li>
              <li>✗ Use production secrets in staging</li>
              <li>✗ Deploy with known security vulnerabilities</li>
              <li>✗ Ignore failed smoke tests</li>
              <li>✗ Deploy without a rollback plan</li>
              <li>✗ Skip release notes generation</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Deployment Checklist</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal ml-4">
            <li>Review changes and generate release notes</li>
            <li>Test thoroughly in staging environment</li>
            <li>Verify all secrets and configuration</li>
            <li>Check for configuration drift</li>
            <li>Analyze dependencies for vulnerabilities</li>
            <li>Create deployment snapshot</li>
            <li>Plan deployment and review execution steps</li>
            <li>Deploy during low-traffic window</li>
            <li>Monitor health checks and logs</li>
            <li>Verify all integrations are working</li>
            <li>Document any issues or manual steps taken</li>
          </ol>
        </div>
      </section>

      {/* Related Resources */}
      <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-3">Related Resources</h2>
        <div className="space-y-2">
          <Link href="/guides/deployment" className="block text-sm text-blue-700 hover:text-blue-900 underline">
            → General Deployment Guide
          </Link>
          <Link href="/guides/security" className="block text-sm text-blue-700 hover:text-blue-900 underline">
            → Security & Secrets Management
          </Link>
          <Link href="/guides/database" className="block text-sm text-blue-700 hover:text-blue-900 underline">
            → Database Operations Guide
          </Link>
          <Link href="/guides/troubleshooting" className="block text-sm text-blue-700 hover:text-blue-900 underline">
            → Troubleshooting Guide
          </Link>
          <a 
            href="https://github.com/modelcontextprotocol/specification" 
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-blue-700 hover:text-blue-900 underline"
          >
            → Model Context Protocol Specification ↗
          </a>
        </div>
      </section>
    </div>
  );
}

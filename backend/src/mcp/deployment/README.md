# Deployment MCP Server

A Model Context Protocol server that provides intelligent, automated deployment capabilities for the Faxi application.

## Overview

The Deployment MCP orchestrates end-to-end deployments across multiple environments (development, staging, production), performs comprehensive health checks and smoke tests, provides AI-powered log analysis, manages rollbacks, and ensures deployment safety through secrets verification, drift detection, and integration testing.

## Primary Deployment Method

**The MCP uses and maintains the automated deployment script: `scripts/deploy-to-aws.sh`**

This script is the single source of truth for AWS deployments. The MCP's role is to:

1. **Execute** the script for deployments
2. **Monitor** execution and parse output for errors
3. **Maintain** the script when issues are discovered
4. **Update** the script with fixes from failed deployments
5. **Document** changes in the script comments

### Script-Based Deployment Flow

```bash
# The MCP executes this for full deployments
./scripts/deploy-to-aws.sh <environment>
```

When a deployment fails:
1. MCP analyzes the error from script output
2. MCP updates `scripts/deploy-to-aws.sh` with the fix
3. MCP adds comments explaining the fix
4. MCP re-runs the deployment
5. MCP validates the fix worked

This ensures all deployment knowledge is captured in the script, making future deployments reliable and repeatable.

## Features

- **Full Deployment Orchestration**: Deploy all components with a single command
- **Change-Based Partial Deployment**: Deploy only changed components
- **Multi-Tier Health Checks**: Tier 0 (system integrity), Tier 1 (smoke tests), Tier 2 (E2E tests)
- **AI-Powered Log Analysis**: Intelligent error categorization and fix suggestions
- **Intelligent Rollback**: Automatic rollback to last stable version on failure
- **Secrets Verification**: Validate environment variables and API keys
- **Drift Detection**: Identify configuration inconsistencies between environments
- **Integration Testing**: Validate external service connectivity
- **Dependency Analysis**: Scan for vulnerabilities and outdated packages
- **Script Auditing**: Maintain deployment script consistency
- **Release Notes Generation**: Auto-generate release notes from git history
- **Deployment Planning**: Preview and simulate deployments

## Installation

The Deployment MCP is registered in the Faxi MCP registry. To enable it:

### Option 1: Using Kiro MCP Configuration

The server is already configured in `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "faxi-deployment": {
      "command": "npx",
      "args": ["tsx", "backend/src/mcp/deployment/deploymentMcpServer.ts"],
      "env": {
        "DEPLOYMENT_ENVIRONMENTS": "development,staging,production",
        "DEPLOYMENT_STRATEGY": "rolling",
        "HEALTH_CHECK_TIMEOUT": "300",
        "ROLLBACK_ENABLED": "true",
        "LOG_ANALYSIS_MODEL": "gemini-2.0-flash-exp",
        "INTEGRATION_TEST_TIMEOUT": "600",
        "NODE_ENV": "development"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Option 2: Direct Import

```typescript
import { startDeploymentMcpServer } from './backend/src/mcp/deployment/deploymentMcpServer';

// Start the server
startDeploymentMcpServer();
```

## Configuration

Configure via environment variables:

```bash
# Deployment Configuration
DEPLOYMENT_ENVIRONMENTS=development,staging,production
DEPLOYMENT_STRATEGY=rolling  # Options: rolling, blue-green, canary
HEALTH_CHECK_TIMEOUT=300     # Seconds
ROLLBACK_ENABLED=true
LOG_ANALYSIS_MODEL=gemini-2.0-flash-exp
INTEGRATION_TEST_TIMEOUT=600 # Seconds

# Database Configuration (inherited from backend)
DATABASE_URL=postgresql://user:pass@localhost:5432/faxi
REDIS_URL=redis://localhost:6379

# AWS Configuration (for S3 and SES)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# External Services (for integration testing)
TELNYX_API_KEY=your_key
STRIPE_SECRET_KEY=your_key
GEMINI_API_KEY=your_key
```

## Available Tools

### Deployment Operations

#### `deploy_full`
Deploy all components to an environment.

**Parameters:**
```typescript
{
  environment: 'development' | 'staging' | 'production',
  components: ('backend' | 'admin-dashboard' | 'marketing-website')[],
  strategy: 'rolling' | 'blue-green' | 'canary',
  runMigrations: boolean,
  runTests: 'none' | 'smoke' | 'e2e' | 'full',
  autoRollback: boolean
}
```

**Example:**
```typescript
await deployFull({
  environment: 'staging',
  components: ['backend', 'admin-dashboard', 'marketing-website'],
  strategy: 'rolling',
  runMigrations: true,
  runTests: 'smoke',
  autoRollback: true
});
```

#### `deploy_partial`
Deploy only changed components based on git diff.

**Parameters:**
```typescript
{
  environment: string,
  fromCommit?: string,
  toCommit?: string,
  detectBreakingChanges: boolean,
  runTests: 'none' | 'smoke' | 'e2e' | 'full',
  autoRollback: boolean
}
```

**Example:**
```typescript
await deployPartial({
  environment: 'production',
  fromCommit: 'v1.0.0',
  toCommit: 'HEAD',
  detectBreakingChanges: true,
  runTests: 'e2e',
  autoRollback: true
});
```

#### `deploy_cross_environment`
Promote deployment from one environment to another.

**Parameters:**
```typescript
{
  sourceEnvironment: string,
  targetEnvironment: string,
  verifySecrets: boolean,
  createDiffReport: boolean
}
```

**Example:**
```typescript
await deployCrossEnvironment({
  sourceEnvironment: 'staging',
  targetEnvironment: 'production',
  verifySecrets: true,
  createDiffReport: true
});
```

#### `plan_deployment`
Generate a deployment plan without executing.

**Parameters:**
```typescript
{
  environment: string,
  components: string[],
  strategy: string
}
```

**Example:**
```typescript
const plan = await planDeployment({
  environment: 'production',
  components: ['backend'],
  strategy: 'rolling'
});
console.log(`Estimated duration: ${plan.estimatedDuration}s`);
console.log(`Estimated downtime: ${plan.estimatedDowntime}s`);
```

#### `simulate_deployment`
Dry-run deployment to validate without making changes.

**Parameters:**
```typescript
{
  plan: DeploymentPlan
}
```

### Health and Validation

#### `check_health`
Run multi-tier health checks.

**Parameters:**
```typescript
{
  tier: 0 | 1 | 2,  // 0=system, 1=smoke, 2=e2e
  environment: string
}
```

**Example:**
```typescript
// Tier 0: System integrity
await checkHealth({ tier: 0, environment: 'production' });

// Tier 1: Smoke tests
await checkHealth({ tier: 1, environment: 'production' });

// Tier 2: E2E tests
await checkHealth({ tier: 2, environment: 'production' });
```

#### `verify_secrets`
Validate all required secrets exist and are correctly formatted.

**Parameters:**
```typescript
{
  environment: string
}
```

**Example:**
```typescript
const result = await verifySecrets({ environment: 'production' });
if (!result.allSecretsPresent) {
  console.log('Missing secrets:', result.missingSecrets);
}
```

#### `detect_drift`
Detect configuration drift between environments.

**Parameters:**
```typescript
{
  sourceEnvironment: string,
  targetEnvironment: string
}
```

**Example:**
```typescript
const drift = await detectDrift({
  sourceEnvironment: 'staging',
  targetEnvironment: 'production'
});
if (drift.hasDrift) {
  console.log('Configuration differences:', drift.configDifferences);
}
```

### Analysis and Maintenance

#### `analyze_logs`
AI-powered log analysis with error categorization and fix suggestions.

**Parameters:**
```typescript
{
  sources: ('build' | 'deployment' | 'service' | 'docker' | 'systemd')[],
  timeRange?: { start: Date, end: Date },
  environment: string
}
```

**Example:**
```typescript
const analysis = await analyzeLogs({
  sources: ['build', 'deployment', 'service'],
  timeRange: {
    start: new Date('2024-01-01'),
    end: new Date()
  },
  environment: 'production'
});

console.log(`Found ${analysis.totalErrors} errors`);
for (const error of analysis.categorizedErrors) {
  console.log(`${error.type}: ${error.count} occurrences`);
}

for (const fix of analysis.suggestedFixes) {
  console.log(`Suggested fix: ${fix.description}`);
  console.log(`Commands: ${fix.commands.join(', ')}`);
}
```

#### `test_integrations`
Test connectivity to all external services.

**Parameters:**
```typescript
{
  environment: string
}
```

**Example:**
```typescript
const result = await testIntegrations({ environment: 'production' });
console.log(`Passed: ${result.summary.passed}/${result.summary.total}`);
for (const [service, status] of Object.entries(result.serviceResults)) {
  console.log(`${service}: ${status.connectivityOk ? '✓' : '✗'}`);
}
```

#### `audit_scripts`
Audit deployment scripts for inconsistencies and issues.

**Example:**
```typescript
const audit = await auditScripts();
console.log(`Found ${audit.issuesFound} issues in ${audit.totalScripts} scripts`);
if (audit.brokenPaths.length > 0) {
  console.log('Broken paths:', audit.brokenPaths);
}
```

#### `analyze_dependencies`
Scan for vulnerabilities and outdated packages.

**Example:**
```typescript
const analysis = await analyzeDependencies();
console.log(`Vulnerabilities: ${analysis.totalVulnerabilities}`);
console.log(`Critical: ${analysis.critical}, High: ${analysis.high}`);
```

#### `generate_release_notes`
Auto-generate release notes from git history.

**Parameters:**
```typescript
{
  fromVersion: string,
  toVersion: string,
  format: 'markdown' | 'html' | 'json',
  includeCommits: boolean
}
```

**Example:**
```typescript
const notes = await generateReleaseNotes({
  fromVersion: 'v1.0.0',
  toVersion: 'v1.1.0',
  format: 'markdown',
  includeCommits: true
});

console.log(notes.features);
console.log(notes.fixes);
console.log(notes.breakingChanges);
```

### Rollback and Recovery

#### `rollback`
Rollback to last stable version.

**Parameters:**
```typescript
{
  environment: string,
  targetVersion?: string,
  rollbackMigrations: boolean,
  verifyAfterRollback: boolean
}
```

**Example:**
```typescript
const result = await rollback({
  environment: 'production',
  rollbackMigrations: true,
  verifyAfterRollback: true
});

console.log(`Rolled back from ${result.previousVersion} to ${result.restoredVersion}`);
console.log(`Health check: ${result.healthCheckPassed ? 'passed' : 'failed'}`);
```

#### `get_last_stable_version`
Get information about the last stable deployment.

**Parameters:**
```typescript
{
  environment: string
}
```

**Example:**
```typescript
const version = await getLastStableVersion({ environment: 'production' });
console.log(`Last stable: ${version.version} (${version.commitHash})`);
console.log(`Deployed at: ${version.deployedAt}`);
console.log(`Health score: ${version.healthScore}`);
```

#### `create_snapshot`
Create a deployment snapshot for backup.

**Parameters:**
```typescript
{
  environment: string
}
```

**Example:**
```typescript
const snapshot = await createSnapshot({ environment: 'production' });
console.log(`Snapshot created: ${snapshot.id}`);
```

#### `restore_snapshot`
Restore from a deployment snapshot.

**Parameters:**
```typescript
{
  snapshotId: string
}
```

**Example:**
```typescript
await restoreSnapshot({ snapshotId: 'snapshot-123' });
```

## Common Workflows

### Standard Deployment Workflow

```typescript
// 1. Verify secrets
await verifySecrets({ environment: 'production' });

// 2. Check for drift
await detectDrift({
  sourceEnvironment: 'staging',
  targetEnvironment: 'production'
});

// 3. Create snapshot
await createSnapshot({ environment: 'production' });

// 4. Deploy
await deployFull({
  environment: 'production',
  components: ['backend', 'admin-dashboard', 'marketing-website'],
  strategy: 'rolling',
  runMigrations: true,
  runTests: 'smoke',
  autoRollback: true
});

// 5. Run comprehensive health checks
await checkHealth({ tier: 2, environment: 'production' });

// 6. Test integrations
await testIntegrations({ environment: 'production' });
```

### Emergency Rollback Workflow

```typescript
// 1. Analyze logs to understand the issue
const analysis = await analyzeLogs({
  sources: ['service', 'deployment'],
  environment: 'production'
});

// 2. Get last stable version
const stable = await getLastStableVersion({ environment: 'production' });

// 3. Rollback
await rollback({
  environment: 'production',
  targetVersion: stable.version,
  rollbackMigrations: true,
  verifyAfterRollback: true
});

// 4. Verify health
await checkHealth({ tier: 1, environment: 'production' });
```

### Maintenance Workflow

```typescript
// 1. Audit scripts
await auditScripts();

// 2. Analyze dependencies
await analyzeDependencies();

// 3. Check drift across environments
await detectDrift({
  sourceEnvironment: 'staging',
  targetEnvironment: 'production'
});

// 4. Test all integrations
await testIntegrations({ environment: 'production' });
```

## Architecture

The Deployment MCP consists of several specialized services:

- **DeploymentOrchestrator**: Coordinates deployment process
- **HealthCheckService**: Multi-tier health validation
- **LogAnalysisService**: AI-powered log interpretation
- **RollbackManager**: Intelligent rollback management
- **SecretsValidator**: Environment variable validation
- **DriftDetector**: Configuration drift detection
- **IntegrationTester**: External service testing
- **ScriptAuditor**: Deployment script maintenance
- **DependencyAnalyzer**: Dependency health monitoring
- **ReleaseNotesGenerator**: Auto-generate release notes
- **DeploymentPlanner**: Deployment planning and simulation

## Testing

The Deployment MCP includes comprehensive tests:

```bash
# Run all tests
npm test -- deployment

# Run property-based tests
npm test -- deploymentMcpServer.property.test.ts

# Run integration tests
npm test -- healthCheckService.integration.test.ts

# Run specific service tests
npm test -- secretsValidator.property.test.ts
```

## Development

To extend the Deployment MCP:

1. Add new services in `backend/src/mcp/deployment/services/`
2. Update types in `backend/src/mcp/deployment/types/`
3. Register new tools in `deploymentMcpServer.ts`
4. Add tests for new functionality
5. Update this README with new tool documentation

## Security

- Never logs secrets or sensitive information
- Validates all inputs to prevent command injection
- Requires confirmation for production rollbacks
- Maintains audit trail of all deployment actions
- Restricts file system access to project directory
- Validates API key formats before testing
- Uses masked values in output

## Monitoring

The Deployment MCP emits metrics:

- `deployment_duration_seconds`: Deployment time
- `deployment_success_rate`: Success percentage
- `health_check_duration_seconds`: Health check time
- `rollback_count`: Number of rollbacks
- `deployment_errors_total`: Errors by category

These metrics integrate with the existing monitoringService.

## Troubleshooting

### Deployment Fails

1. Check health checks: `check_health`
2. Analyze logs: `analyze_logs`
3. Verify secrets: `verify_secrets`
4. Check drift: `detect_drift`
5. Test integrations: `test_integrations`

### Rollback Needed

1. Get last stable version: `get_last_stable_version`
2. Initiate rollback: `rollback`
3. Verify health: `check_health`

### Configuration Issues

1. Detect drift: `detect_drift`
2. Verify secrets: `verify_secrets`
3. Audit scripts: `audit_scripts`

### Performance Issues

1. Check system resources in Tier 0 health checks
2. Analyze logs for bottlenecks
3. Review deployment duration metrics

## License

MIT

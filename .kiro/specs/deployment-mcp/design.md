# Design Document

## Overview

The Deployment MCP is a Model Context Protocol server that provides comprehensive deployment automation for the Faxi application. It orchestrates end-to-end deployments, performs multi-tier health checks, provides AI-powered log analysis, manages intelligent rollbacks, and ensures deployment safety through secrets verification, drift detection, and integration testing.

The system is designed to achieve:
- **Zero-downtime deployments**: Through health checks and gradual rollouts
- **Zero-fear deployments**: Through comprehensive validation and automatic rollback
- **Zero-surprise failures**: Through pre-flight checks and drift detection
- **Self-healing infrastructure**: Through intelligent error detection and automated fixes

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
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
│                                                               │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │   Release    │  │  Deployment  │                         │
│  │    Notes     │  │   Planner    │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Backend    │    │    Admin     │    │  Marketing   │
│  (Port 4000) │    │  Dashboard   │    │   Website    │
│              │    │ (Port 4001)  │    │ (Port 4003)  │
└──────────────┘    └──────────────┘    └──────────────┘
         │                    │                    │
         └────────────────────┴────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Infrastructure  │
                    │  - PostgreSQL    │
                    │  - Redis         │
                    │  - S3/MinIO      │
                    │  - Docker        │
                    └──────────────────┘
```

### Component Interaction Flow

1. **Deployment Request** → Orchestration Service
2. **Pre-flight Checks** → Secrets Validator, Drift Detector, Dependency Analyzer
3. **Change Detection** → Git analysis, affected components identification
4. **Build & Test** → Component builds, test execution
5. **Deployment** → Sequential component deployment with health checks
6. **Validation** → Multi-tier health checks, integration tests
7. **Monitoring** → Log analysis, error detection
8. **Rollback (if needed)** → Automatic revert to stable version

## Components and Interfaces

### 1. Deployment Orchestration Service

**Purpose**: Coordinates the entire deployment process from start to finish.

**Key Methods**:
```typescript
interface DeploymentOrchestrationService {
  // Full deployment of all components
  deployFull(options: FullDeploymentOptions): Promise<DeploymentResult>;
  
  // Partial deployment of changed components
  deployPartial(options: PartialDeploymentOptions): Promise<DeploymentResult>;
  
  // Cross-environment deployment
  deployCrossEnvironment(options: CrossEnvDeploymentOptions): Promise<DeploymentResult>;
  
  // Get deployment status
  getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus>;
}

interface FullDeploymentOptions {
  environment: 'development' | 'staging' | 'production';
  components: ('backend' | 'admin-dashboard' | 'marketing-website')[];
  strategy: 'rolling' | 'blue-green' | 'canary';
  runMigrations: boolean;
  runTests: 'none' | 'smoke' | 'e2e' | 'full';
  autoRollback: boolean;
}

interface PartialDeploymentOptions extends FullDeploymentOptions {
  fromCommit?: string;
  toCommit?: string;
  detectBreakingChanges: boolean;
}

interface CrossEnvDeploymentOptions {
  sourceEnvironment: string;
  targetEnvironment: string;
  verifySecrets: boolean;
  createDiffReport: boolean;
}

interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  componentsDeployed: string[];
  duration: number;
  healthChecksPassed: boolean;
  warnings: string[];
  errors: string[];
  rollbackPerformed: boolean;
}
```

### 2. Health Check Service

**Purpose**: Performs multi-tier health validation after deployment.

**Key Methods**:
```typescript
interface HealthCheckService {
  // Tier 0: System integrity checks
  checkSystemIntegrity(): Promise<SystemIntegrityResult>;
  
  // Tier 1: API-level smoke tests
  runSmokeTests(environment: string): Promise<SmokeTestResult>;
  
  // Tier 2: End-to-end functional tests
  runE2ETests(environment: string, scope: 'critical' | 'changed' | 'full'): Promise<E2ETestResult>;
  
  // Comprehensive health check
  performHealthCheck(tier: 0 | 1 | 2): Promise<HealthCheckResult>;
}

interface SystemIntegrityResult {
  servicesRunning: boolean;
  portsResponding: boolean;
  databaseReachable: boolean;
  queuesOperational: boolean;
  storageAccessible: boolean;
  resourcesAdequate: boolean;
  details: Record<string, any>;
}

interface SmokeTestResult {
  endpointsPassed: number;
  endpointsFailed: number;
  webhooksWorking: boolean;
  agentCallsSuccessful: boolean;
  coreFlowsWorking: boolean;
  failures: Array<{ endpoint: string; error: string }>;
}

interface E2ETestResult {
  testsPassed: number;
  testsFailed: number;
  criticalPathsWorking: boolean;
  faxPipelineWorking: boolean;
  failures: Array<{ test: string; error: string; trace?: string }>;
}
```

### 3. Log Analysis Service

**Purpose**: AI-powered log interpretation and error diagnosis.

**Key Methods**:
```typescript
interface LogAnalysisService {
  // Analyze logs from multiple sources
  analyzeLogs(options: LogAnalysisOptions): Promise<LogAnalysisResult>;
  
  // Categorize errors
  categorizeErrors(logs: string[]): Promise<ErrorCategory[]>;
  
  // Suggest fixes using AI
  suggestFixes(errors: ErrorCategory[]): Promise<FixSuggestion[]>;
  
  // Apply fix automatically
  applyFix(fix: FixSuggestion): Promise<FixApplicationResult>;
}

interface LogAnalysisOptions {
  sources: ('build' | 'deployment' | 'service' | 'docker' | 'systemd')[];
  timeRange?: { start: Date; end: Date };
  errorPatterns?: string[];
  environment: string;
}

interface LogAnalysisResult {
  totalErrors: number;
  categorizedErrors: ErrorCategory[];
  suggestedFixes: FixSuggestion[];
  criticalIssues: string[];
}

interface ErrorCategory {
  type: 'build' | 'runtime' | 'missing_variable' | 'permissions' | 'network' | 'dependency';
  count: number;
  examples: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedComponents: string[];
}

interface FixSuggestion {
  id: string;
  description: string;
  commands: string[];
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
}
```

### 4. Rollback Manager

**Purpose**: Manages intelligent rollback to previous stable versions.

**Key Methods**:
```typescript
interface RollbackManager {
  // Initiate rollback
  rollback(options: RollbackOptions): Promise<RollbackResult>;
  
  // Get last stable version
  getLastStableVersion(environment: string): Promise<VersionInfo>;
  
  // Create deployment snapshot
  createSnapshot(environment: string): Promise<SnapshotInfo>;
  
  // Restore from snapshot
  restoreSnapshot(snapshotId: string): Promise<RestoreResult>;
}

interface RollbackOptions {
  environment: string;
  targetVersion?: string;
  rollbackMigrations: boolean;
  verifyAfterRollback: boolean;
}

interface RollbackResult {
  success: boolean;
  previousVersion: string;
  restoredVersion: string;
  migrationsRolledBack: number;
  healthCheckPassed: boolean;
  duration: number;
}

interface VersionInfo {
  version: string;
  commitHash: string;
  deployedAt: Date;
  healthScore: number;
  components: Record<string, string>;
}
```

### 5. Secrets Validator

**Purpose**: Validates environment variables and secrets before deployment.

**Key Methods**:
```typescript
interface SecretsValidator {
  // Verify all required secrets exist
  verifySecrets(environment: string): Promise<SecretsValidationResult>;
  
  // Validate secret formats
  validateFormats(secrets: Record<string, string>): Promise<FormatValidationResult>;
  
  // Check for leaked secrets
  scanForLeaks(scope: 'logs' | 'commits' | 'both'): Promise<LeakScanResult>;
  
  // Verify environment matching
  verifyEnvironmentMatch(environment: string): Promise<EnvironmentMatchResult>;
}

interface SecretsValidationResult {
  allSecretsPresent: boolean;
  missingSecrets: string[];
  invalidFormats: Array<{ key: string; reason: string }>;
  environmentMismatches: Array<{ key: string; issue: string }>;
}
```

### 6. Drift Detector

**Purpose**: Detects configuration drift between environments.

**Key Methods**:
```typescript
interface DriftDetector {
  // Detect drift between environments
  detectDrift(source: string, target: string): Promise<DriftReport>;
  
  // Compare configurations
  compareConfigs(env1: string, env2: string): Promise<ConfigDiff>;
  
  // Check version consistency
  checkVersions(environment: string): Promise<VersionConsistencyReport>;
}

interface DriftReport {
  hasDrift: boolean;
  configDifferences: ConfigDiff[];
  versionMismatches: VersionMismatch[];
  serviceStateDifferences: ServiceStateDiff[];
  recommendations: string[];
}

interface ConfigDiff {
  key: string;
  sourceValue: string;
  targetValue: string;
  severity: 'critical' | 'warning' | 'info';
}
```

### 7. Integration Tester

**Purpose**: Tests connectivity to external services.

**Key Methods**:
```typescript
interface IntegrationTester {
  // Test all integrations
  testAllIntegrations(environment: string): Promise<IntegrationTestResult>;
  
  // Test specific service
  testService(service: ExternalService, environment: string): Promise<ServiceTestResult>;
  
  // Simulate edge cases
  simulateFailures(service: ExternalService): Promise<FailureSimulationResult>;
}

interface IntegrationTestResult {
  allPassed: boolean;
  serviceResults: Record<string, ServiceTestResult>;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

interface ServiceTestResult {
  service: string;
  apiKeyValid: boolean;
  connectivityOk: boolean;
  responseTime: number;
  rateLimitStatus: 'ok' | 'warning' | 'exceeded';
  errors: string[];
}

type ExternalService = 'telnyx' | 'stripe' | 'aws-ses' | 's3' | 'gemini';
```

### 8. Script Auditor

**Purpose**: Audits and maintains deployment scripts.

**Key Methods**:
```typescript
interface ScriptAuditor {
  // Audit all deployment scripts
  auditScripts(): Promise<ScriptAuditResult>;
  
  // Detect inconsistencies
  detectInconsistencies(): Promise<InconsistencyReport>;
  
  // Suggest improvements
  suggestImprovements(): Promise<ImprovementSuggestion[]>;
  
  // Auto-fix common issues
  autoFixScripts(dryRun: boolean): Promise<AutoFixResult>;
}

interface ScriptAuditResult {
  totalScripts: number;
  issuesFound: number;
  brokenPaths: string[];
  missingCommands: string[];
  outdatedReferences: string[];
  inconsistencies: InconsistencyReport;
}
```

### 9. Dependency Analyzer

**Purpose**: Analyzes and monitors project dependencies.

**Key Methods**:
```typescript
interface DependencyAnalyzer {
  // Scan for vulnerabilities
  scanVulnerabilities(): Promise<VulnerabilityReport>;
  
  // Check for outdated packages
  checkOutdated(): Promise<OutdatedPackagesReport>;
  
  // Verify lockfile consistency
  verifyLockfile(): Promise<LockfileConsistencyReport>;
  
  // Detect breaking changes
  detectBreakingChanges(): Promise<BreakingChangesReport>;
}

interface VulnerabilityReport {
  totalVulnerabilities: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  packages: Array<{
    name: string;
    version: string;
    severity: string;
    cve: string;
    fixAvailable: boolean;
  }>;
}
```

### 10. Release Notes Generator

**Purpose**: Automatically generates release notes from git history.

**Key Methods**:
```typescript
interface ReleaseNotesGenerator {
  // Generate release notes
  generateReleaseNotes(options: ReleaseNotesOptions): Promise<ReleaseNotes>;
  
  // Suggest semantic version
  suggestVersion(changes: ChangeSet): Promise<string>;
  
  // Extract breaking changes
  extractBreakingChanges(commits: GitCommit[]): Promise<BreakingChange[]>;
}

interface ReleaseNotesOptions {
  fromVersion: string;
  toVersion: string;
  format: 'markdown' | 'html' | 'json';
  includeCommits: boolean;
}

interface ReleaseNotes {
  version: string;
  date: string;
  features: string[];
  fixes: string[];
  breakingChanges: string[];
  newEnvVars: string[];
  deprecations: string[];
  contributors: string[];
}
```

### 11. Deployment Planner

**Purpose**: Plans and simulates deployments before execution.

**Key Methods**:
```typescript
interface DeploymentPlanner {
  // Create deployment plan
  planDeployment(options: DeploymentPlanOptions): Promise<DeploymentPlan>;
  
  // Simulate deployment
  simulateDeployment(plan: DeploymentPlan): Promise<SimulationResult>;
  
  // Estimate downtime
  estimateDowntime(plan: DeploymentPlan): Promise<DowntimeEstimate>;
}

interface DeploymentPlan {
  steps: DeploymentStep[];
  dependencies: DependencyGraph;
  estimatedDuration: number;
  estimatedDowntime: number;
  risks: Risk[];
}

interface DeploymentStep {
  order: number;
  action: string;
  component: string;
  duration: number;
  dependencies: string[];
  rollbackable: boolean;
}
```

## Data Models

### Deployment Record

```typescript
interface DeploymentRecord {
  id: string;
  environment: string;
  version: string;
  commitHash: string;
  components: string[];
  strategy: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  initiatedBy: string;
  healthCheckResults: HealthCheckResult[];
  errors: string[];
  warnings: string[];
  rollbackPerformed: boolean;
  metadata: Record<string, any>;
}
```

### Health Check Result

```typescript
interface HealthCheckResult {
  tier: 0 | 1 | 2;
  timestamp: Date;
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    duration: number;
    error?: string;
    details?: any;
  }>;
}
```

### Deployment Snapshot

```typescript
interface DeploymentSnapshot {
  id: string;
  environment: string;
  createdAt: Date;
  version: string;
  commitHash: string;
  components: Record<string, ComponentSnapshot>;
  databaseSchema: string;
  configuration: Record<string, string>;
  healthScore: number;
}

interface ComponentSnapshot {
  name: string;
  version: string;
  buildHash: string;
  configuration: Record<string, any>;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Deployment Atomicity
*For any* deployment operation, either all components deploy successfully or the system reverts to the previous state
**Validates: Requirements 1.1, 1.5**

### Property 2: Health Check Completeness
*For any* successful deployment, all three tiers of health checks must pass before declaring success
**Validates: Requirements 5.1, 5.2, 5.3, 5.5**

### Property 3: Change Detection Accuracy
*For any* git commit range, the change detection system correctly identifies all affected components
**Validates: Requirements 2.1, 2.2**

### Property 4: Breaking Change Detection
*For any* deployment with removed environment variables or API changes, the system highlights them as breaking changes
**Validates: Requirements 2.4**

### Property 5: Secrets Completeness
*For any* environment, all required secrets from .env.example exist in the target environment before deployment proceeds
**Validates: Requirements 7.1**

### Property 6: Secret Format Validation
*For any* API key or credential, the format validation correctly identifies invalid formats (JWT structure, URL format, key patterns)
**Validates: Requirements 7.2**

### Property 7: Environment Secret Matching
*For any* deployment to staging, no production secrets are used, and vice versa
**Validates: Requirements 7.3**

### Property 8: Migration Safety
*For any* database migration that risks data loss, the system prevents deployment without explicit confirmation
**Validates: Requirements 3.4**

### Property 9: Rollback Completeness
*For any* failed deployment, rollback restores the system to the last known stable version
**Validates: Requirements 6.1, 6.2, 6.5**

### Property 10: Log Categorization Accuracy
*For any* error log, the AI categorization assigns it to exactly one category (build, runtime, missing_variable, permissions, network, dependency)
**Validates: Requirements 4.2**

### Property 11: Drift Detection Completeness
*For any* two environments, drift detection identifies all configuration differences
**Validates: Requirements 8.1, 8.3**

### Property 12: Integration Test Coverage
*For any* external service (Telnyx, Stripe, S3, SES, Gemini), integration tests validate API key validity and connectivity
**Validates: Requirements 11.1, 11.2**

### Property 13: Dependency Vulnerability Detection
*For any* package with known vulnerabilities, the dependency analyzer detects and reports them
**Validates: Requirements 9.1**

### Property 14: Release Notes Completeness
*For any* version range, release notes include all commits categorized by type (features, fixes, breaking changes)
**Validates: Requirements 10.1, 10.2**

### Property 15: Deployment Plan Ordering
*For any* deployment plan, steps are ordered such that all dependencies are satisfied before execution
**Validates: Requirements 13.3**

### Property 16: Health Check Failure Detection
*For any* health check failure, the deployment is halted and detailed diagnostics are provided
**Validates: Requirements 5.4**

### Property 17: Script Inconsistency Detection
*For any* deployment script with broken paths or missing commands, the script auditor detects and reports them
**Validates: Requirements 12.2**

### Property 18: Lockfile Consistency
*For any* mismatch between package.json and package-lock.json, the dependency analyzer detects it
**Validates: Requirements 9.3**

### Property 19: Log Source Completeness
*For any* log analysis request, logs are read from all specified sources (build, deployment, service, docker, systemd)
**Validates: Requirements 4.1**

### Property 20: Fix Suggestion Safety
*For any* suggested fix with high risk level, the system requires explicit approval before application
**Validates: Requirements 4.4**

## Error Handling

### Error Categories

1. **Pre-flight Errors**: Detected before deployment starts
   - Missing secrets
   - Configuration drift
   - Dependency vulnerabilities
   - Script inconsistencies

2. **Build Errors**: Detected during build phase
   - Compilation failures
   - Test failures
   - Dependency resolution failures

3. **Deployment Errors**: Detected during deployment
   - Service startup failures
   - Migration failures
   - Network connectivity issues

4. **Post-deployment Errors**: Detected after deployment
   - Health check failures
   - Integration test failures
   - Performance degradation

### Error Handling Strategy

```typescript
interface ErrorHandler {
  // Handle error based on phase and severity
  handleError(error: DeploymentError): Promise<ErrorHandlingResult>;
  
  // Determine if rollback is needed
  shouldRollback(error: DeploymentError): boolean;
  
  // Attempt automatic recovery
  attemptRecovery(error: DeploymentError): Promise<RecoveryResult>;
}

interface DeploymentError {
  phase: 'preflight' | 'build' | 'deployment' | 'postdeployment';
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  component: string;
  recoverable: boolean;
  suggestedActions: string[];
}

interface ErrorHandlingResult {
  action: 'continue' | 'retry' | 'rollback' | 'abort';
  reason: string;
  recoveryAttempted: boolean;
  recoverySuccessful: boolean;
}
```

### Rollback Triggers

Automatic rollback is triggered when:
1. Any Tier 0 health check fails
2. More than 50% of Tier 1 smoke tests fail
3. Any critical path E2E test fails
4. Database migration fails
5. Service fails to start within timeout
6. Integration tests show all external services unreachable

## Testing Strategy

### Unit Testing

Unit tests will cover:
- Individual service methods (change detection, secret validation, drift detection)
- Error categorization logic
- Version comparison algorithms
- Configuration parsing and validation
- Script analysis functions

**Framework**: Vitest
**Coverage Target**: 80% for service layer

### Property-Based Testing

Property-based tests will validate universal properties using fast-check:
- Each property test runs 100 iterations minimum
- Tests generate random deployment scenarios, configurations, and error conditions
- Each test is tagged with the format: `**Feature: deployment-mcp, Property {number}: {property_text}**`

**Framework**: fast-check with Vitest
**Test Organization**: Co-located with services as `*.property.test.ts`

**Example Property Test Structure**:
```typescript
import * as fc from 'fast-check';

describe('deployment-mcp - Requirement 1', () => {
  /**
   * Feature: deployment-mcp, Property 1: Deployment Atomicity
   * Validates: Requirements 1.1, 1.5
   */
  it('property: deployment atomicity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          environment: fc.constantFrom('development', 'staging', 'production'),
          components: fc.array(fc.constantFrom('backend', 'admin-dashboard', 'marketing-website'), { minLength: 1 }),
          simulateFailure: fc.boolean(),
          failureComponent: fc.constantFrom('backend', 'admin-dashboard', 'marketing-website'),
        }),
        async (scenario) => {
          // Test that deployment is atomic
          const result = await deploymentOrchestrator.deploy(scenario);
          
          if (scenario.simulateFailure) {
            // If any component fails, all should be reverted
            expect(result.success).toBe(false);
            expect(result.rollbackPerformed).toBe(true);
            
            // Verify all components are at previous version
            const versions = await getComponentVersions(scenario.environment);
            for (const component of scenario.components) {
              expect(versions[component]).toBe(previousVersions[component]);
            }
          } else {
            // If all succeed, all should be at new version
            expect(result.success).toBe(true);
            expect(result.componentsDeployed).toEqual(scenario.components);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

Integration tests will validate:
- End-to-end deployment flows
- Interaction with git, docker, npm commands
- Database migration execution
- Health check execution against real services
- Log file reading and parsing
- External service connectivity (in test mode)

**Test Environment**: Isolated test environment with test database and Redis instance

### Smoke Tests

Smoke tests run after each deployment:
- All API endpoints respond with 200/401 (not 500)
- Database queries execute successfully
- Redis commands work
- S3 upload/download works
- Queue jobs can be enqueued

### E2E Tests

End-to-end tests validate critical user paths:
- Fax upload → processing → response generation
- Shopping flow → product lookup → order creation
- Email → fax conversion → delivery
- Admin dashboard → job monitoring → user management

## Implementation Notes

### Technology Stack

- **Language**: TypeScript
- **MCP SDK**: @modelcontextprotocol/sdk
- **Testing**: Vitest + fast-check
- **Process Execution**: child_process with proper error handling
- **Git Operations**: simple-git library
- **AI Integration**: Google Gemini API (reuse existing geminiAgentService)
- **File System**: fs/promises for async operations
- **Log Parsing**: Custom parsers + regex patterns

### Integration with Existing Faxi Infrastructure

The Deployment MCP will integrate with:
1. **Monitoring Service**: Extend existing monitoringService for health checks
2. **Database**: Use existing db connection for deployment records
3. **Redis**: Use existing redis connection for deployment state
4. **S3**: Use existing s3Storage for deployment artifacts
5. **Gemini**: Use existing geminiAgentService for log analysis

### File Structure

```
backend/src/mcp/deployment/
├── deploymentMcpServer.ts          # Main MCP server
├── services/
│   ├── deploymentOrchestrator.ts   # Orchestration service
│   ├── healthCheckService.ts       # Health checks
│   ├── logAnalysisService.ts       # AI log analysis
│   ├── rollbackManager.ts          # Rollback management
│   ├── secretsValidator.ts         # Secrets validation
│   ├── driftDetector.ts            # Drift detection
│   ├── integrationTester.ts        # Integration testing
│   ├── scriptAuditor.ts            # Script auditing
│   ├── dependencyAnalyzer.ts       # Dependency analysis
│   ├── releaseNotesGenerator.ts    # Release notes
│   └── deploymentPlanner.ts        # Deployment planning
├── types/
│   └── index.ts                    # Type definitions
└── tests/
    ├── *.test.ts                   # Unit tests
    └── *.property.test.ts          # Property-based tests
```

### Configuration

The MCP server will read configuration from environment variables:
- `DEPLOYMENT_ENVIRONMENTS`: Comma-separated list of environments
- `DEPLOYMENT_STRATEGY`: Default deployment strategy
- `HEALTH_CHECK_TIMEOUT`: Timeout for health checks (default: 300s)
- `ROLLBACK_ENABLED`: Enable automatic rollback (default: true)
- `LOG_ANALYSIS_MODEL`: Gemini model for log analysis (default: gemini-2.0-flash)
- `INTEGRATION_TEST_TIMEOUT`: Timeout for integration tests (default: 600s)

### Security Considerations

1. **Secret Handling**: Never log secrets, use masked values in output
2. **Command Injection**: Sanitize all inputs to shell commands
3. **File Access**: Restrict file system access to project directory
4. **API Keys**: Validate API key formats before testing
5. **Rollback Safety**: Require confirmation for production rollbacks
6. **Audit Trail**: Log all deployment actions to audit log

### Performance Considerations

1. **Parallel Execution**: Run independent health checks in parallel
2. **Caching**: Cache git analysis results, dependency scans
3. **Streaming**: Stream logs instead of loading entire files
4. **Timeouts**: Set reasonable timeouts for all operations
5. **Resource Limits**: Limit concurrent deployments per environment

### Monitoring and Observability

The Deployment MCP will emit metrics:
- `deployment_duration_seconds`: Time taken for deployment
- `deployment_success_rate`: Percentage of successful deployments
- `health_check_duration_seconds`: Time taken for health checks
- `rollback_count`: Number of rollbacks performed
- `deployment_errors_total`: Total deployment errors by category

These metrics will integrate with the existing monitoringService.

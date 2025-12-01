/**
 * Type definitions for Deployment MCP
 */

// ============================================================================
// Deployment Options and Results
// ============================================================================

export interface FullDeploymentOptions {
  environment: 'development' | 'staging' | 'production';
  components: ('backend' | 'admin-dashboard' | 'marketing-website')[];
  strategy: 'rolling' | 'blue-green' | 'canary';
  runMigrations: boolean;
  runTests: 'none' | 'smoke' | 'e2e' | 'full';
  autoRollback: boolean;
}

export interface PartialDeploymentOptions extends FullDeploymentOptions {
  fromCommit?: string;
  toCommit?: string;
  detectBreakingChanges: boolean;
}

export interface CrossEnvDeploymentOptions {
  sourceEnvironment: string;
  targetEnvironment: string;
  verifySecrets: boolean;
  createDiffReport: boolean;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  componentsDeployed: string[];
  duration: number;
  healthChecksPassed: boolean;
  warnings: string[];
  errors: string[];
  rollbackPerformed: boolean;
}

export interface DeploymentStatus {
  id: string;
  environment: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  progress: number;
  currentStep: string;
  startedAt: Date;
  estimatedCompletion?: Date;
}

// ============================================================================
// Health Check Types
// ============================================================================

export interface SystemIntegrityResult {
  servicesRunning: boolean;
  portsResponding: boolean;
  databaseReachable: boolean;
  queuesOperational: boolean;
  storageAccessible: boolean;
  resourcesAdequate: boolean;
  details: Record<string, any>;
}

export interface SmokeTestResult {
  endpointsPassed: number;
  endpointsFailed: number;
  webhooksWorking: boolean;
  agentCallsSuccessful: boolean;
  coreFlowsWorking: boolean;
  failures: Array<{ endpoint: string; error: string }>;
}

export interface E2ETestResult {
  testsPassed: number;
  testsFailed: number;
  criticalPathsWorking: boolean;
  faxPipelineWorking: boolean;
  failures: Array<{ test: string; error: string; trace?: string }>;
}

export interface HealthCheckResult {
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

// ============================================================================
// Log Analysis Types
// ============================================================================

export interface LogAnalysisOptions {
  sources: ('build' | 'deployment' | 'service' | 'docker' | 'systemd')[];
  timeRange?: { start: Date; end: Date };
  errorPatterns?: string[];
  environment: string;
}

export interface LogAnalysisResult {
  totalErrors: number;
  categorizedErrors: ErrorCategory[];
  suggestedFixes: FixSuggestion[];
  criticalIssues: string[];
}

export interface ErrorCategory {
  type: 'build' | 'runtime' | 'missing_variable' | 'permissions' | 'network' | 'dependency';
  count: number;
  examples: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedComponents: string[];
}

export interface FixSuggestion {
  id: string;
  description: string;
  commands: string[];
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
}

export interface FixApplicationResult {
  success: boolean;
  fixId: string;
  commandsExecuted: string[];
  output: string;
  errors: string[];
}

// ============================================================================
// Rollback Types
// ============================================================================

export interface RollbackOptions {
  environment: string;
  targetVersion?: string;
  rollbackMigrations: boolean;
  verifyAfterRollback: boolean;
}

export interface RollbackResult {
  success: boolean;
  previousVersion: string;
  restoredVersion: string;
  migrationsRolledBack: number;
  healthCheckPassed: boolean;
  duration: number;
}

export interface VersionInfo {
  version: string;
  commitHash: string;
  deployedAt: Date;
  healthScore: number;
  components: Record<string, string>;
}

export interface SnapshotInfo {
  id: string;
  environment: string;
  createdAt: Date;
  version: string;
  commitHash: string;
  components: Record<string, ComponentSnapshot>;
}

export interface ComponentSnapshot {
  name: string;
  version: string;
  buildHash: string;
  configuration: Record<string, any>;
}

export interface RestoreResult {
  success: boolean;
  snapshotId: string;
  restoredComponents: string[];
  duration: number;
  errors: string[];
}

// ============================================================================
// Secrets Validation Types
// ============================================================================

export interface SecretsValidationResult {
  allSecretsPresent: boolean;
  missingSecrets: string[];
  invalidFormats: Array<{ key: string; reason: string }>;
  environmentMismatches: Array<{ key: string; issue: string }>;
}

export interface FormatValidationResult {
  valid: boolean;
  invalidSecrets: Array<{ key: string; reason: string }>;
}

export interface LeakScanResult {
  leaksFound: boolean;
  leaks: Array<{
    location: string;
    secretKey: string;
    context: string;
  }>;
}

export interface EnvironmentMatchResult {
  matches: boolean;
  mismatches: Array<{ key: string; issue: string }>;
}

// ============================================================================
// Drift Detection Types
// ============================================================================

export interface DriftReport {
  hasDrift: boolean;
  configDifferences: ConfigDiff[];
  versionMismatches: VersionMismatch[];
  serviceStateDifferences: ServiceStateDiff[];
  recommendations: string[];
}

export interface ConfigDiff {
  key: string;
  sourceValue: string;
  targetValue: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface VersionMismatch {
  component: string;
  sourceVersion: string;
  targetVersion: string;
  type: 'nodejs' | 'package' | 'docker';
}

export interface ServiceStateDiff {
  service: string;
  sourceState: string;
  targetState: string;
  requiresAction: boolean;
}

export interface VersionConsistencyReport {
  consistent: boolean;
  mismatches: VersionMismatch[];
}

// ============================================================================
// Integration Testing Types
// ============================================================================

export type ExternalService = 'telnyx' | 'stripe' | 'aws-ses' | 's3' | 'gemini';

export interface IntegrationTestResult {
  allPassed: boolean;
  serviceResults: Record<string, ServiceTestResult>;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

export interface ServiceTestResult {
  service: string;
  apiKeyValid: boolean;
  connectivityOk: boolean;
  responseTime: number;
  rateLimitStatus: 'ok' | 'warning' | 'exceeded';
  errors: string[];
}

export interface FailureSimulationResult {
  service: string;
  simulatedFailures: string[];
  systemResponse: string;
  recoverySuccessful: boolean;
}

// ============================================================================
// Script Auditing Types
// ============================================================================

export interface ScriptAuditResult {
  totalScripts: number;
  issuesFound: number;
  brokenPaths: string[];
  missingCommands: string[];
  outdatedReferences: string[];
  inconsistencies: InconsistencyReport;
}

export interface InconsistencyReport {
  crossEnvironmentDifferences: Array<{
    script: string;
    environments: string[];
    difference: string;
  }>;
  bestPracticeViolations: Array<{
    script: string;
    violation: string;
    suggestion: string;
  }>;
}

export interface ImprovementSuggestion {
  script: string;
  currentIssue: string;
  suggestedFix: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AutoFixResult {
  scriptsFixed: number;
  fixesApplied: Array<{
    script: string;
    fix: string;
  }>;
  errors: string[];
}

// ============================================================================
// Dependency Analysis Types
// ============================================================================

export interface VulnerabilityReport {
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

export interface OutdatedPackagesReport {
  totalOutdated: number;
  packages: Array<{
    name: string;
    currentVersion: string;
    latestVersion: string;
    updateType: 'patch' | 'minor' | 'major';
  }>;
}

export interface LockfileConsistencyReport {
  consistent: boolean;
  mismatches: Array<{
    package: string;
    packageJsonVersion: string;
    lockfileVersion: string;
  }>;
}

export interface BreakingChangesReport {
  hasBreakingChanges: boolean;
  changes: Array<{
    package: string;
    fromVersion: string;
    toVersion: string;
    breakingChanges: string[];
  }>;
}

// ============================================================================
// Release Notes Types
// ============================================================================

export interface ReleaseNotesOptions {
  fromVersion: string;
  toVersion: string;
  format: 'markdown' | 'html' | 'json';
  includeCommits: boolean;
}

export interface ReleaseNotes {
  version: string;
  date: string;
  features: string[];
  fixes: string[];
  breakingChanges: string[];
  newEnvVars: string[];
  deprecations: string[];
  contributors: string[];
}

export interface ChangeSet {
  features: number;
  fixes: number;
  breakingChanges: number;
  chores: number;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: Date;
  type?: string;
}

export interface BreakingChange {
  commit: string;
  description: string;
  impact: string;
}

// ============================================================================
// Deployment Planning Types
// ============================================================================

export interface DeploymentPlanOptions {
  environment: string;
  components: string[];
  strategy: string;
  includeTests: boolean;
}

export interface DeploymentPlan {
  steps: DeploymentStep[];
  dependencies: DependencyGraph;
  estimatedDuration: number;
  estimatedDowntime: number;
  risks: Risk[];
}

export interface DeploymentStep {
  order: number;
  action: string;
  component: string;
  duration: number;
  dependencies: string[];
  rollbackable: boolean;
}

export interface DependencyGraph {
  nodes: string[];
  edges: Array<{ from: string; to: string }>;
}

export interface Risk {
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  mitigation: string;
}

export interface SimulationResult {
  success: boolean;
  stepsExecuted: number;
  stepsFailed: number;
  issues: string[];
  duration: number;
}

export interface DowntimeEstimate {
  estimatedMinutes: number;
  affectedServices: string[];
  mitigationStrategies: string[];
}

// ============================================================================
// Error Handling Types
// ============================================================================

export interface DeploymentError {
  phase: 'preflight' | 'build' | 'deployment' | 'postdeployment';
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  component: string;
  recoverable: boolean;
  suggestedActions: string[];
}

export interface ErrorHandlingResult {
  action: 'continue' | 'retry' | 'rollback' | 'abort';
  reason: string;
  recoveryAttempted: boolean;
  recoverySuccessful: boolean;
}

export interface RecoveryResult {
  success: boolean;
  method: string;
  duration: number;
  details: string;
}

// ============================================================================
// Deployment Record Types
// ============================================================================

export interface DeploymentRecord {
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

export interface DeploymentSnapshot {
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

// ============================================================================
// Configuration Types
// ============================================================================

export interface DeploymentConfig {
  environments: string[];
  defaultStrategy: string;
  healthCheckTimeout: number;
  rollbackEnabled: boolean;
  logAnalysisModel: string;
  integrationTestTimeout: number;
}

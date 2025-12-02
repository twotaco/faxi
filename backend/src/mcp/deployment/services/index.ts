/**
 * Service interfaces for Deployment MCP
 * These will be implemented in subsequent tasks
 */

// Export concrete implementations
export { SecretsValidator } from './secretsValidator.js';
export { HealthCheckService, healthCheckService } from './healthCheckService.js';
export { DeploymentOrchestrator, deploymentOrchestrator } from './deploymentOrchestrator.js';
export { LogAnalysisService, logAnalysisService } from './logAnalysisService.js';
export { InfrastructureProvisioner, infrastructureProvisioner } from './infrastructureProvisioner.js';
export type { SystemIntegrityResult as SystemIntegrityResultImpl, HealthCheckDetail, PortCheckConfig, ResourceThresholds } from './healthCheckService.js';

import {
  FullDeploymentOptions,
  PartialDeploymentOptions,
  CrossEnvDeploymentOptions,
  DeploymentResult,
  DeploymentStatus,
  SystemIntegrityResult,
  SmokeTestResult,
  E2ETestResult,
  HealthCheckResult,
  LogAnalysisOptions,
  LogAnalysisResult,
  ErrorCategory,
  FixSuggestion,
  FixApplicationResult,
  RollbackOptions,
  RollbackResult,
  VersionInfo,
  SnapshotInfo,
  RestoreResult,
  SecretsValidationResult,
  FormatValidationResult,
  LeakScanResult,
  EnvironmentMatchResult,
  DriftReport,
  ConfigDiff,
  VersionConsistencyReport,
  IntegrationTestResult,
  ServiceTestResult,
  FailureSimulationResult,
  ExternalService,
  ScriptAuditResult,
  InconsistencyReport,
  ImprovementSuggestion,
  AutoFixResult,
  VulnerabilityReport,
  OutdatedPackagesReport,
  LockfileConsistencyReport,
  BreakingChangesReport,
  ReleaseNotesOptions,
  ReleaseNotes,
  ChangeSet,
  GitCommit,
  BreakingChange,
  DeploymentPlanOptions,
  DeploymentPlan,
  SimulationResult,
  DowntimeEstimate,
} from '../types/index.js';

/**
 * Deployment Orchestration Service
 * Coordinates the entire deployment process
 */
export interface DeploymentOrchestrationService {
  deployFull(options: FullDeploymentOptions): Promise<DeploymentResult>;
  deployPartial(options: PartialDeploymentOptions): Promise<DeploymentResult>;
  deployCrossEnvironment(options: CrossEnvDeploymentOptions): Promise<DeploymentResult>;
  getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus>;
}

/**
 * Health Check Service
 * Performs multi-tier health validation
 */
export interface HealthCheckService {
  checkSystemIntegrity(): Promise<SystemIntegrityResult>;
  runSmokeTests(environment: string): Promise<SmokeTestResult>;
  runE2ETests(environment: string, scope: 'critical' | 'changed' | 'full'): Promise<E2ETestResult>;
  performHealthCheck(tier: 0 | 1 | 2): Promise<HealthCheckResult>;
}

/**
 * Log Analysis Service
 * AI-powered log interpretation and error diagnosis
 */
export interface LogAnalysisService {
  analyzeLogs(options: LogAnalysisOptions): Promise<LogAnalysisResult>;
  categorizeErrors(logs: string[]): Promise<ErrorCategory[]>;
  suggestFixes(errors: ErrorCategory[]): Promise<FixSuggestion[]>;
  applyFix(fix: FixSuggestion): Promise<FixApplicationResult>;
}

/**
 * Rollback Manager
 * Manages intelligent rollback to previous stable versions
 */
export interface RollbackManager {
  rollback(options: RollbackOptions): Promise<RollbackResult>;
  getLastStableVersion(environment: string): Promise<VersionInfo>;
  createSnapshot(environment: string): Promise<SnapshotInfo>;
  restoreSnapshot(snapshotId: string): Promise<RestoreResult>;
}

/**
 * Secrets Validator
 * Validates environment variables and secrets
 */
export interface SecretsValidator {
  verifySecrets(environment: string): Promise<SecretsValidationResult>;
  validateFormats(secrets: Record<string, string>): Promise<FormatValidationResult>;
  scanForLeaks(scope: 'logs' | 'commits' | 'both'): Promise<LeakScanResult>;
  verifyEnvironmentMatch(environment: string): Promise<EnvironmentMatchResult>;
}

/**
 * Drift Detector
 * Detects configuration drift between environments
 */
export interface DriftDetector {
  detectDrift(source: string, target: string): Promise<DriftReport>;
  compareConfigs(env1: string, env2: string): Promise<ConfigDiff[]>;
  checkVersions(environment: string): Promise<VersionConsistencyReport>;
}

/**
 * Integration Tester
 * Tests connectivity to external services
 */
export interface IntegrationTester {
  testAllIntegrations(environment: string): Promise<IntegrationTestResult>;
  testService(service: ExternalService, environment: string): Promise<ServiceTestResult>;
  simulateFailures(service: ExternalService): Promise<FailureSimulationResult>;
}

/**
 * Script Auditor
 * Audits and maintains deployment scripts
 */
export interface ScriptAuditor {
  auditScripts(): Promise<ScriptAuditResult>;
  detectInconsistencies(): Promise<InconsistencyReport>;
  suggestImprovements(): Promise<ImprovementSuggestion[]>;
  autoFixScripts(dryRun: boolean): Promise<AutoFixResult>;
}

/**
 * Dependency Analyzer
 * Analyzes and monitors project dependencies
 */
export interface DependencyAnalyzer {
  scanVulnerabilities(): Promise<VulnerabilityReport>;
  checkOutdated(): Promise<OutdatedPackagesReport>;
  verifyLockfile(): Promise<LockfileConsistencyReport>;
  detectBreakingChanges(): Promise<BreakingChangesReport>;
}

/**
 * Release Notes Generator
 * Automatically generates release notes from git history
 */
export interface ReleaseNotesGenerator {
  generateReleaseNotes(options: ReleaseNotesOptions): Promise<ReleaseNotes>;
  suggestVersion(changes: ChangeSet): Promise<string>;
  extractBreakingChanges(commits: GitCommit[]): Promise<BreakingChange[]>;
}

/**
 * Deployment Planner
 * Plans and simulates deployments before execution
 */
export interface DeploymentPlanner {
  planDeployment(options: DeploymentPlanOptions): Promise<DeploymentPlan>;
  simulateDeployment(plan: DeploymentPlan): Promise<SimulationResult>;
  estimateDowntime(plan: DeploymentPlan): Promise<DowntimeEstimate>;
}

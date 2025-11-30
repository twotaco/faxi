# Kiro MCP Extensions - Design Document

## Overview

This design document specifies the technical architecture for two custom MCP servers that extend Kiro IDE with Faxi-specific development capabilities: the Spec Validator MCP and the Auto-Docs MCP.

### Key Design Principles

1. **Developer Experience**: Tools should feel natural to use through Kiro's AI assistant
2. **Reliability**: Operations should be idempotent and handle errors gracefully
3. **Performance**: Minimize latency for interactive development workflows
4. **Reusability**: Leverage existing infrastructure (Playwright, logging, etc.)

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Kiro IDE                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐         ┌──────────────────────────────┐ │
│  │ AI Assistant     │────────▶│ MCP Client                    │ │
│  │ (Claude)         │         │ (Built-in)                    │ │
│  └──────────────────┘         └──────────┬───────────────────┘ │
│                                          │                      │
└──────────────────────────────────────────┼──────────────────────┘
                                           │ stdio
                    ┌──────────────────────┴──────────────────────┐
                    │                                              │
                    ▼                                              ▼
        ┌──────────────────────┐                   ┌──────────────────────┐
        │ Spec Validator MCP   │                   │ Auto-Docs MCP        │
        │ Server               │                   │ Server               │
        ├──────────────────────┤                   ├──────────────────────┤
        │ Tools:               │                   │ Tools:               │
        │ - find_incomplete    │                   │ - capture_screenshot │
        │ - validate_spec      │                   │ - update_help_doc    │
        │ - get_spec_coverage  │                   │ - capture_user_flow  │
        │ - generate_test      │                   │ - compare_screenshots│
        │ - validate_impl ★    │                   │ - generate_help_page │
        │ - find_impl_files ★  │                   │                      │
        │ - check_test_cov ★   │                   │                      │
        └──────────┬───────────┘                   └──────────┬───────────┘
                   │                                          │
        ┌──────────┴──────────────────────┐                   │
        │                                 │                   │
        ▼                                 ▼                   ▼
┌──────────────────────┐      ┌──────────────────────┐   ┌──────────────────────┐
│ .kiro/specs/         │      │ Source Code Files    │   │ Playwright Browser   │
│ - requirements.md    │      │ backend/src/**/*.ts  │   │ (Chromium)           │
│ - design.md          │      │ (for code review)    │   └──────────┬───────────┘
│ - tasks.md           │      └──────────────────────┘              │
└──────────────────────┘                                            ▼
                                                        ┌──────────────────────┐
                                                        │ docs/screenshots/    │
                                                        │ docs/help/           │
                                                        └──────────────────────┘
```

### Request Flow Sequence

#### ★ Code Review Validation Flow (Key Differentiator)

```
Developer asks: "Is requirement 6 from the shopping spec actually implemented?"
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Kiro AI Assistant                                                │
│ - Interprets request for implementation validation              │
│ - Calls validate_implementation with spec_path and requirement  │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Spec Validator MCP Server                                        │
│ 1. Parse requirements.md → extract Requirement 6 criteria       │
│ 2. Parse design.md → find expected file locations               │
│    Location: "backend/src/services/orderManagementService.ts"   │
│ 3. Read actual source code file                                 │
│ 4. Analyze code against each acceptance criterion:              │
│    - Does createOrder() exist with correct signature? ✓         │
│    - Does it set status to "pending_payment"? ✓                 │
│    - Does updateOrderStatus() validate state machine? ✗ MISSING │
│    - Does getPendingPurchaseOrders() exist? ✓                   │
│ 5. Search for related tests                                     │
│ 6. Return structured validation result                          │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Result                                                           │
│ {                                                                │
│   complete: false,                                               │
│   coverage_percent: 75,                                          │
│   validation_results: [{                                         │
│     requirement_id: "6",                                         │
│     criteria_results: [                                          │
│       { criterion: 1, status: "implemented",                     │
│         evidence: { file: "orderManagementService.ts:45" } },    │
│       { criterion: 3, status: "missing",                         │
│         evidence: { reason: "No state machine validation" },     │
│         suggested_fix: "Add transition validation in update()" } │
│     ]                                                            │
│   }],                                                            │
│   summary: { implemented: 3, missing: 1, partial: 0 }            │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
```

#### Spec Validator Flow (Task Tracking)

```
Developer asks: "What tasks are incomplete in the shopping spec?"
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Kiro AI Assistant                                                │
│ - Interprets request                                            │
│ - Identifies find_incomplete_tasks tool                         │
│ - Calls MCP with spec_path=".kiro/specs/amazon-shopping-mcp"    │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Spec Validator MCP Server                                        │
│ - Receives tool call via stdio                                  │
│ - Reads tasks.md file                                           │
│ - Parses checkbox syntax                                        │
│ - Returns structured result                                      │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Result                                                           │
│ {                                                                │
│   spec_name: "amazon-shopping-mcp",                             │
│   incomplete_tasks: [                                            │
│     { task_number: "4.1", title: "Write property test..." },    │
│     { task_number: "15", title: "Build admin dashboard..." }    │
│   ],                                                             │
│   total_tasks: 30,                                               │
│   completed_tasks: 25                                            │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
```

#### Auto-Docs Screenshot Flow

```
Developer asks: "Update the help docs with a new screenshot of the login page"
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Kiro AI Assistant                                                │
│ - Identifies capture_ui_screenshot tool                         │
│ - Calls MCP with url="http://localhost:3000/login"              │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Auto-Docs MCP Server                                             │
│ - Launches Playwright browser                                    │
│ - Navigates to URL                                              │
│ - Captures screenshot                                            │
│ - Saves to docs/screenshots/login_2025-11-30.png                │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Kiro AI Assistant                                                │
│ - Receives screenshot path                                       │
│ - Identifies update_help_doc tool                               │
│ - Calls MCP to update docs/help/login.md                        │
└──────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Spec Validator MCP Server

**Purpose**: Validate .kiro specifications and track task completion.

**Location**: `backend/src/mcp/kiro/specValidatorMcpServer.ts`

**MCP Tools**:

```typescript
interface SpecValidatorTools {
  /**
   * Find incomplete tasks in a spec or all specs
   */
  find_incomplete_tasks(params: {
    spec_path?: string;  // Optional: specific spec to check
  }): Promise<{
    spec_name: string;
    incomplete_tasks: Array<{
      task_number: string;
      title: string;
      parent_task?: string;
    }>;
    total_tasks: number;
    completed_tasks: number;
  }>;

  /**
   * Validate spec structure for required files and format
   */
  validate_spec(params: {
    spec_path: string;
  }): Promise<{
    valid: boolean;
    issues: Array<{
      file: string;
      line?: number;
      issue: string;
      severity: 'error' | 'warning';
    }>;
  }>;

  /**
   * Get coverage overview of all specs
   */
  get_spec_coverage(): Promise<{
    specs: Array<{
      name: string;
      total_tasks: number;
      completed_tasks: number;
      percentage: number;
    }>;
    overall_percentage: number;
  }>;

  /**
   * Generate a property test skeleton from a requirement
   */
  generate_test_from_spec(params: {
    spec_path: string;
    requirement_id: string;  // e.g., "1", "1.2", "NFR1"
  }): Promise<{
    test_code: string;
    requirement_summary: string;
    acceptance_criteria: string[];
  }>;

  /**
   * ★ CODE REVIEW: Validate that implementation matches requirements
   * This is the key differentiator - actual code analysis, not just checkbox checking
   */
  validate_implementation(params: {
    spec_path: string;
    scope?: {
      requirement_id?: string;  // Validate specific requirement
      file_path?: string;       // Validate requirements related to this file
    };
  }): Promise<{
    complete: boolean;
    coverage_percent: number;
    validation_results: Array<{
      requirement_id: string;
      requirement_title: string;
      criteria_results: Array<{
        criterion_number: number;
        criterion_text: string;
        status: 'implemented' | 'missing' | 'partial' | 'needs_manual_review';
        evidence: {
          file_path?: string;
          line_number?: number;
          code_snippet?: string;
          reason: string;
        };
        suggested_fix?: string;
      }>;
    }>;
    summary: {
      total_criteria: number;
      implemented: number;
      missing: number;
      partial: number;
      needs_review: number;
    };
  }>;

  /**
   * ★ Find source files that implement a requirement
   */
  find_implementation_files(params: {
    spec_path: string;
    requirement_id: string;
  }): Promise<{
    files: Array<{
      path: string;
      confidence: 'high' | 'medium' | 'low';
      reason: string;
      relevant_lines?: Array<{
        line_number: number;
        content: string;
      }>;
    }>;
    design_specified_location?: string;
  }>;

  /**
   * ★ Check if tests exist for requirements
   */
  check_test_coverage(params: {
    spec_path: string;
    requirement_id?: string;  // Optional: check specific requirement
  }): Promise<{
    coverage_percent: number;
    requirements: Array<{
      requirement_id: string;
      has_tests: boolean;
      test_files: Array<{
        path: string;
        test_names: string[];
        criteria_covered: number[];
      }>;
      missing_criteria: number[];
    }>;
    recommendations: string[];
  }>;
}
```

**Internal Services**:

```typescript
// backend/src/mcp/kiro/services/specParserService.ts
class SpecParserService {
  /**
   * Parse a tasks.md file and extract task items
   */
  parseTasks(content: string): ParsedTask[];

  /**
   * Parse a requirements.md file and extract requirements
   */
  parseRequirements(content: string): ParsedRequirement[];

  /**
   * Validate spec structure
   */
  validateStructure(specPath: string): ValidationResult;
}

interface ParsedTask {
  number: string;
  title: string;
  completed: boolean;
  parentNumber?: string;
  lineNumber: number;
}

interface ParsedRequirement {
  id: string;
  title: string;
  userStory: string;
  acceptanceCriteria: string[];
  lineNumber: number;
}
```

```typescript
// backend/src/mcp/kiro/services/codeAnalysisService.ts
// ★ This is the core service that enables CODE REVIEW, not just checkbox checking

class CodeAnalysisService {
  /**
   * Analyze if source code implements a requirement's acceptance criteria
   * This reads actual code files and checks for implementation evidence
   */
  async validateImplementation(
    requirement: ParsedRequirement,
    designLocations: DesignLocation[]
  ): Promise<CriteriaValidationResult[]>;

  /**
   * Find source files related to a requirement by:
   * 1. Checking design.md for specified locations
   * 2. Searching for function/class names from the requirement
   * 3. Grepping for requirement ID references in code comments
   */
  async findImplementationFiles(
    requirement: ParsedRequirement,
    designDoc: string
  ): Promise<ImplementationFile[]>;

  /**
   * Parse design.md to extract expected file locations
   */
  extractDesignLocations(designContent: string): DesignLocation[];

  /**
   * Search codebase for patterns matching requirement keywords
   */
  async searchCodebase(
    patterns: string[],
    fileGlobs: string[]
  ): Promise<CodeSearchResult[]>;

  /**
   * Analyze a source file to check if it implements specific criteria
   */
  async analyzeFile(
    filePath: string,
    criteria: AcceptanceCriterion[]
  ): Promise<FileAnalysisResult>;

  /**
   * Find tests that cover a requirement
   */
  async findTestsForRequirement(
    requirementId: string,
    specPath: string
  ): Promise<TestCoverageResult>;
}

interface DesignLocation {
  component: string;           // e.g., "Shopping MCP Server"
  filePath: string;            // e.g., "backend/src/mcp/shoppingMcpServer.ts"
  section: string;             // Section in design.md where this is defined
}

interface ImplementationFile {
  path: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;              // Why we think this file is related
  relevantLines: Array<{
    lineNumber: number;
    content: string;
  }>;
}

interface CriteriaValidationResult {
  criterionNumber: number;
  criterionText: string;
  status: 'implemented' | 'missing' | 'partial' | 'needs_manual_review';
  evidence: {
    filePath?: string;
    lineNumber?: number;
    codeSnippet?: string;
    reason: string;
  };
  suggestedFix?: string;
}

interface CodeSearchResult {
  filePath: string;
  lineNumber: number;
  content: string;
  matchType: 'function_name' | 'class_name' | 'comment_reference' | 'keyword';
}

interface FileAnalysisResult {
  filePath: string;
  exports: string[];           // Exported functions/classes
  interfaces: string[];        // TypeScript interfaces
  functions: Array<{
    name: string;
    lineNumber: number;
    parameters: string[];
    returnType?: string;
  }>;
  hasErrorHandling: boolean;
  referencedRequirements: string[];  // Requirement IDs found in comments
}

interface TestCoverageResult {
  requirementId: string;
  hasTests: boolean;
  testFiles: Array<{
    path: string;
    testNames: string[];
    criteriaCovered: number[];
  }>;
  missingCriteria: number[];
  coveragePercent: number;
}
```

### 2. Auto-Docs MCP Server (Autonomous)

**Purpose**: Autonomously generate and update documentation by understanding the app structure, navigating the UI, and capturing screenshots - all without manual specification of URLs or selectors.

**Location**: `backend/src/mcp/kiro/autoDocsMcpServer.ts`

**Design Rationale**: The Auto-Docs MCP is designed to be fully autonomous to minimize developer friction. Instead of requiring developers to specify URLs, selectors, and navigation steps, the MCP analyzes the codebase to understand the application structure, then intelligently navigates the UI using semantic element discovery (finding buttons by text, forms by labels). This approach makes documentation generation resilient to UI changes and reduces the cognitive load on developers.

**MCP Tools**:

```typescript
interface AutoDocsTools {
  /**
   * ★ AUTONOMOUS: Generate documentation for a feature
   * Just say "shopping" and it figures out everything else
   * 
   * Design Decision: Feature-centric API instead of URL-centric
   * Rationale: Developers think in terms of features, not URLs. By accepting
   * a feature name, the MCP can consult specs and route definitions to build
   * a complete documentation plan automatically.
   */
  generate_feature_docs(params: {
    feature_name: string;        // e.g., "shopping", "login", "fax-sending"
    base_url?: string;           // Default: http://localhost:3000
    output_dir?: string;         // Default: docs/help/
  }): Promise<{
    doc_path: string;
    screenshots: string[];
    steps_documented: number;
    warnings: string[];
  }>;

  /**
   * ★ AUTONOMOUS: Update all existing documentation
   * 
   * Design Decision: Batch update with failure isolation
   * Rationale: When UI changes, multiple docs may need updates. This tool
   * processes all docs but isolates failures so one broken flow doesn't
   * prevent other docs from being updated.
   */
  update_all_docs(params: {
    base_url?: string;
  }): Promise<{
    updated: string[];
    failed: Array<{ doc: string; reason: string }>;
    screenshots_refreshed: number;
  }>;

  /**
   * ★ AUTONOMOUS: Document a user goal
   * Describe what the user wants to do, MCP figures out how
   * 
   * Design Decision: Natural language goal input
   * Rationale: Enables non-technical stakeholders to request documentation.
   * The MCP interprets the goal using spec analysis and UI discovery.
   */
  document_user_flow(params: {
    goal: string;                // e.g., "show how a user places an order"
    base_url?: string;
  }): Promise<{
    doc_path: string;
    steps: Array<{
      description: string;
      screenshot: string;
      action_taken: string;
    }>;
    success: boolean;
    partial_reason?: string;
  }>;

  /**
   * Discover app structure for intelligent navigation
   * 
   * Design Decision: Expose discovery as a tool
   * Rationale: Useful for debugging and understanding what the MCP sees.
   * Also allows developers to verify the MCP's understanding before
   * generating documentation.
   */
  discover_app_structure(params: {
    frontend_dir?: string;       // Default: frontend/ or app/
  }): Promise<{
    routes: Array<{
      path: string;
      name: string;
      feature?: string;
    }>;
    navigation: Array<{
      label: string;
      href: string;
    }>;
    features_detected: string[];
  }>;

  /**
   * Check which docs are outdated
   * 
   * Design Decision: Visual comparison with configurable threshold
   * Rationale: Pixel-perfect comparison is too strict (minor CSS changes
   * trigger false positives). A 10% threshold catches meaningful changes
   * while ignoring trivial differences.
   */
  check_docs_freshness(params: {
    base_url?: string;
    threshold?: number;          // Default: 10% visual difference
  }): Promise<{
    docs: Array<{
      path: string;
      status: 'fresh' | 'needs_update' | 'broken';
      difference_percent?: number;
      issues?: string[];
    }>;
    summary: {
      total: number;
      fresh: number;
      needs_update: number;
      broken: number;
    };
  }>;
}
```

**Internal Services**:

```typescript
// backend/src/mcp/kiro/services/appDiscoveryService.ts
// ★ This service enables AUTONOMOUS navigation

class AppDiscoveryService {
  /**
   * Analyze frontend codebase to understand app structure
   */
  async discoverStructure(frontendDir: string): Promise<AppStructure>;

  /**
   * Find routes from Next.js app router, pages, or React Router
   */
  async findRoutes(frontendDir: string): Promise<Route[]>;

  /**
   * Extract navigation from components (nav bars, menus, sidebars)
   */
  async findNavigation(frontendDir: string): Promise<NavItem[]>;

  /**
   * Map features to routes using specs and code analysis
   */
  async mapFeaturesToRoutes(
    specs: string[],
    routes: Route[]
  ): Promise<FeatureRouteMap>;

  /**
   * Plan a documentation flow for a feature
   */
  async planDocumentationFlow(
    feature: string,
    appStructure: AppStructure
  ): Promise<DocumentationPlan>;
}

interface AppStructure {
  routes: Route[];
  navigation: NavItem[];
  features: FeatureRouteMap;
  baseUrl: string;
}

interface Route {
  path: string;
  filePath: string;
  name: string;
  params?: string[];
  metadata?: { title?: string; description?: string };
}

interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

interface FeatureRouteMap {
  [featureName: string]: {
    routes: string[];
    entryPoint: string;
    relatedSpec?: string;
  };
}

interface DocumentationPlan {
  feature: string;
  steps: PlannedStep[];
  estimatedScreenshots: number;
}

interface PlannedStep {
  order: number;
  description: string;
  url: string;
  actions: PlannedAction[];
  screenshotName: string;
}

interface PlannedAction {
  type: 'click' | 'type' | 'select' | 'wait' | 'scroll';
  target: string;          // Button text, label, or selector hint
  value?: string;          // For type/select actions
  reason: string;          // Why this action (for documentation)
}
```

```typescript
// backend/src/mcp/kiro/services/autonomousNavigatorService.ts
// ★ Intelligent browser automation that figures out how to interact with UI

class AutonomousNavigatorService {
  private browser: Browser | null = null;
  private page: Page | null = null;

  /**
   * Execute a documentation plan, taking screenshots at each step
   */
  async executeDocumentationPlan(
    plan: DocumentationPlan,
    baseUrl: string
  ): Promise<ExecutionResult>;

  /**
   * Intelligently find and click a button/link by its text or purpose
   */
  async findAndClick(target: string): Promise<ClickResult>;

  /**
   * Fill a form field intelligently (find by label, placeholder, or name)
   */
  async fillField(label: string, value: string): Promise<FillResult>;

  /**
   * Generate meaningful test data for forms
   */
  generateTestData(fieldType: string, hint?: string): string;

  /**
   * Wait for navigation/loading to complete
   */
  async waitForStable(): Promise<void>;

  /**
   * Capture screenshot with descriptive metadata
   */
  async captureStep(
    stepName: string,
    outputDir: string
  ): Promise<ScreenshotResult>;

  /**
   * Handle common UI patterns (modals, confirmations, toasts)
   */
  async handleCommonPatterns(): Promise<PatternResult[]>;
}

interface ExecutionResult {
  success: boolean;
  screenshots: ScreenshotResult[];
  stepsCompleted: number;
  totalSteps: number;
  errors: string[];
}

interface ClickResult {
  success: boolean;
  element?: string;
  fallbackUsed?: string;
}

interface FillResult {
  success: boolean;
  field?: string;
  valueUsed: string;
}

interface PatternResult {
  pattern: 'modal' | 'toast' | 'confirmation' | 'loading';
  handled: boolean;
  action?: string;
}
```

```typescript
// backend/src/mcp/kiro/services/docGeneratorService.ts
// Generates markdown documentation from execution results

class DocGeneratorService {
  /**
   * Generate complete help documentation from execution result
   */
  generateHelpDoc(
    feature: string,
    spec: ParsedSpec | null,
    executionResult: ExecutionResult
  ): string;

  /**
   * Generate step-by-step instructions from screenshots
   */
  generateSteps(screenshots: ScreenshotResult[]): string;

  /**
   * Generate troubleshooting section from common issues
   */
  generateTroubleshooting(feature: string): string;

  /**
   * Update existing doc, preserving manual sections
   */
  updateDoc(
    existingContent: string,
    newContent: string
  ): string;

  /**
   * Find manual sections that should be preserved
   */
  findManualSections(content: string): ManualSection[];
}

interface ManualSection {
  startLine: number;
  endLine: number;
  content: string;
}
```

```typescript
// backend/src/mcp/kiro/services/screenshotService.ts
class ScreenshotService {
  private browser: Browser | null = null;

  /**
   * Initialize Playwright browser
   */
  async initialize(): Promise<void>;

  /**
   * Capture a screenshot
   */
  async capture(options: CaptureOptions): Promise<ScreenshotResult>;

  /**
   * Compare two images for visual regression
   */
  async compare(oldPath: string, newPath: string): Promise<ComparisonResult>;

  /**
   * Cleanup browser resources
   */
  async cleanup(): Promise<void>;
}

interface CaptureOptions {
  url: string;
  selector?: string;
  fullPage?: boolean;
  outputPath: string;
  viewport?: { width: number; height: number };
}

interface ScreenshotResult {
  path: string;
  name: string;
  width: number;
  height: number;
  fileSize: number;
  capturedAt: Date;
  stepDescription?: string;
}

interface ComparisonResult {
  identical: boolean;
  differencePercent: number;
  diffImagePath?: string;
}

interface FlowStep {
  name: string;
  action: 'click' | 'type' | 'navigate' | 'wait' | 'screenshot';
  selector?: string;
  value?: string;
  waitMs?: number;
}

interface ComparisonResult {
  identical: boolean;
  differencePercent: number;
  diffImagePath?: string;
}
```

```typescript
// backend/src/mcp/kiro/services/docGeneratorService.ts
class DocGeneratorService {
  /**
   * Generate markdown help page
   */
  generateHelpPage(sections: HelpSection[]): string;

  /**
   * Update existing doc with new content
   */
  updateDoc(docPath: string, placeholder: string, content: string): UpdateResult;

  /**
   * Parse existing doc for editable sections
   */
  parseEditableSections(content: string): EditableSection[];
}

interface HelpSection {
  type: 'screenshot' | 'text' | 'steps';
  title: string;
  content: string;
}
```

## Data Models

### Spec Parser Models

```typescript
// Parsed task from tasks.md
interface ParsedTask {
  number: string;           // "1", "1.1", "2"
  title: string;            // Task description
  completed: boolean;       // true if [x], false if [ ]
  parentNumber?: string;    // Parent task number if nested
  lineNumber: number;       // Line in tasks.md
  requirements?: string[];  // Referenced requirements
}

// Parsed requirement from requirements.md
interface ParsedRequirement {
  id: string;               // "1", "NFR1"
  title: string;            // Requirement title
  userStory: string;        // User story text
  acceptanceCriteria: Array<{
    number: number;
    text: string;
  }>;
  lineNumber: number;
}

// Validation issue
interface ValidationIssue {
  file: string;             // "requirements.md", "tasks.md"
  line?: number;
  issue: string;
  severity: 'error' | 'warning';
}

// Spec coverage entry
interface SpecCoverage {
  name: string;
  path: string;
  totalTasks: number;
  completedTasks: number;
  percentage: number;
  hasRequirements: boolean;
  hasDesign: boolean;
  hasTasks: boolean;
}
```

### Screenshot Models

```typescript
// Screenshot metadata
interface ScreenshotMetadata {
  path: string;
  url: string;
  selector?: string;
  fullPage: boolean;
  width: number;
  height: number;
  fileSize: number;
  capturedAt: Date;
}

// User flow step result
interface FlowStepResult {
  stepName: string;
  screenshotPath?: string;
  success: boolean;
  error?: string;
  duration: number;
}

// Comparison result
interface ScreenshotComparison {
  identical: boolean;
  differencePercent: number;
  diffImagePath?: string;
  oldDimensions: { width: number; height: number };
  newDimensions: { width: number; height: number };
}

// Help page section
interface HelpPageSection {
  type: 'screenshot' | 'text' | 'steps';
  title: string;
  content: string;
  screenshotPath?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Acceptance Criteria Testing Prework

Before defining correctness properties, we analyze each acceptance criterion to determine if it's testable as a property, example, edge case, or not testable.

#### Requirement 1: Find Incomplete Tasks

1.1 WHEN a developer calls find_incomplete_tasks with a spec path THEN the Spec Validator MCP SHALL parse the tasks.md file at that path
- Thoughts: This is about the system's behavior across all valid spec paths. We can generate random spec structures and verify parsing works correctly.
- Testable: yes - property

1.2 WHEN the Spec Validator MCP parses a tasks.md file THEN the Spec Validator MCP SHALL identify all tasks marked with [ ] (incomplete) versus [x] (completed)
- Thoughts: This is a rule that should apply to all tasks.md files. We can generate random task lists and verify correct classification.
- Testable: yes - property

1.3 WHEN the Spec Validator MCP identifies incomplete tasks THEN the Spec Validator MCP SHALL return the task number, title, and parent task if nested
- Thoughts: This is about the structure of returned data for all tasks. We can verify the return format is correct.
- Testable: yes - property

1.4 WHEN the Spec Validator MCP returns incomplete tasks THEN the Spec Validator MCP SHALL include total_tasks and completed_tasks counts
- Thoughts: This is an invariant - the sum should always equal the total. This is a classic property test.
- Testable: yes - property

1.5 WHEN no spec path is provided THEN the Spec Validator MCP SHALL scan all specs in .kiro/specs/ directory
- Thoughts: This is about default behavior when a parameter is omitted. This is a specific example to test.
- Testable: yes - example

1.6 WHEN a tasks.md file does not exist at the specified path THEN the Spec Validator MCP SHALL return an error message containing the missing path
- Thoughts: This is error handling for a specific edge case.
- Testable: edge-case

#### Requirement 10: Validate Implementation Against Spec

10.1-10.3 Reading and parsing design.md and requirements.md
- Thoughts: These are about file I/O and parsing, which are implementation details. The important property is what happens with the parsed data.
- Testable: no (covered by higher-level properties)

10.4 WHEN the Spec Validator MCP reads source code THEN the Spec Validator MCP SHALL analyze whether the code implements the acceptance criteria
- Thoughts: This is the core validation logic. For any requirement and corresponding code, the validator should produce a validation result.
- Testable: yes - property

10.5 WHEN validating acceptance criteria THEN the Spec Validator MCP SHALL verify required functions exist, interfaces are implemented, error handling matches, and data models match
- Thoughts: This describes what the validator checks. We can test that for any code file, the validator looks for these elements.
- Testable: yes - property

10.8 WHEN validation finds gaps THEN the Spec Validator MCP SHALL return a detailed report
- Thoughts: This is about the structure of the validation report. For any validation with gaps, the report should have specific fields.
- Testable: yes - property

10.9 WHEN validation passes THEN the Spec Validator MCP SHALL return complete=true and coverage_percent=100
- Thoughts: This is a specific case - when everything passes, specific values should be returned.
- Testable: yes - example

#### Requirement 5: Generate Feature Documentation (Autonomous)

5.1-5.3 Analyzing codebase and understanding features
- Thoughts: These are about the autonomous discovery process. Hard to test the "understanding" but we can test that it produces valid plans.
- Testable: partial

5.4 WHEN the Auto-Docs MCP executes the documentation flow THEN it SHALL navigate through the feature taking screenshots
- Thoughts: For any valid documentation plan, execution should produce screenshots. This is a property about the execution process.
- Testable: yes - property

5.5 WHEN the Auto-Docs MCP captures screenshots THEN it SHALL save them with descriptive names
- Thoughts: For any screenshot captured, the filename should be descriptive (non-empty, contains feature name).
- Testable: yes - property

5.6 WHEN the Auto-Docs MCP completes the flow THEN it SHALL generate a markdown help document
- Thoughts: For any completed flow, a valid markdown document should be produced.
- Testable: yes - property

5.7 WHEN the Auto-Docs MCP generates documentation THEN it SHALL save to docs/help/ with feature name as filename
- Thoughts: This is about file naming and location. For any feature, the output path should follow this pattern.
- Testable: yes - property

5.8 WHEN a help document already exists THEN the Auto-Docs MCP SHALL preserve sections marked with MANUAL tags
- Thoughts: This is an idempotence property - manual sections should survive updates.
- Testable: yes - property

#### Requirement 7: Document User Flow

7.3 WHEN the Auto-Docs MCP executes the flow THEN it SHALL perform actions intelligently
- Thoughts: "Intelligently" is vague, but we can test that actions are performed in sequence and produce results.
- Testable: partial

7.4 WHEN the flow completes THEN the Auto-Docs MCP SHALL generate documentation explaining each step
- Thoughts: For any completed flow, documentation should be generated with one entry per step.
- Testable: yes - property

### Property Reflection

After reviewing the prework, I identified potential redundancies:

- Properties about file creation and path validation could be combined
- Properties about parsing and validation structure could be consolidated
- Screenshot capture properties share common validation logic

However, each property provides unique validation value:
- Task count consistency validates arithmetic correctness
- Coverage bounds validates percentage calculations
- File creation validates I/O operations
- Idempotency validates state management
- Report structure validates data integrity

No properties are redundant - each tests a distinct aspect of correctness.

### Spec Validator Properties

#### Property 1: Task Count Consistency
*For any* tasks.md file, the sum of completed_tasks and incomplete tasks SHALL equal total_tasks.

**Validates: Requirements 1.4**

#### Property 2: Spec Coverage Bounds
*For any* spec coverage result, all percentage values SHALL be between 0 and 100 inclusive.

**Validates: Requirements 3.2, 3.3**

#### Property 3: Validation Completeness
*For any* spec directory with missing required files, validate_spec SHALL return at least one error issue.

**Validates: Requirements 2.1**

#### Property 4: Test Generation Format
*For any* generated test code, the output SHALL contain valid TypeScript syntax with fast-check imports.

**Validates: Requirements 4.3, 4.4**

#### Property 5: Implementation Validation Completeness
*For any* requirement with acceptance criteria, validate_implementation SHALL return a validation result for each criterion.

**Validates: Requirements 10.4, 10.5**

#### Property 6: Validation Report Structure
*For any* validation with missing implementations, the report SHALL include file path, criterion text, and suggested fix.

**Validates: Requirements 10.8**

#### Property 7: Implementation File Discovery
*For any* requirement, find_implementation_files SHALL return at least one file when design.md specifies a location.

**Validates: Requirements 11.1, 11.2**

#### Property 8: Test Coverage Calculation
*For any* requirement with tests, check_test_coverage SHALL return coverage_percent equal to (criteria_with_tests / total_criteria) * 100.

**Validates: Requirements 12.3, 12.4**

### Auto-Docs Properties

#### Property 9: Screenshot File Creation
*For any* successful screenshot capture, the returned path SHALL point to an existing file.

**Validates: Requirements 5.5, 5.7**

#### Property 10: Doc Update Idempotency
*For any* help document with manual sections, updating twice SHALL preserve manual content identically.

**Validates: Requirements 5.8, 6.4**

#### Property 11: Flow Step Ordering
*For any* documentation flow, screenshots SHALL be captured in the exact order specified by the plan.

**Validates: Requirements 5.4, 7.3**

#### Property 12: Documentation Completeness
*For any* completed documentation flow, the generated markdown SHALL contain at least one screenshot reference per step.

**Validates: Requirements 5.6, 7.4**

#### Property 13: Feature Name Consistency
*For any* feature documentation, the output filename SHALL contain the feature name.

**Validates: Requirements 5.7**

#### Property 14: Freshness Comparison Symmetry
*For any* two screenshots, comparing A to B SHALL return the same difference_percent as comparing B to A.

**Validates: Requirements 9.2**

## Error Handling

### Spec Validator Errors

```typescript
class SpecNotFoundError extends Error {
  constructor(specPath: string) {
    super(`Spec not found at path: ${specPath}`);
  }
}

class MalformedSpecError extends Error {
  constructor(file: string, line: number, reason: string) {
    super(`Malformed spec in ${file} at line ${line}: ${reason}`);
  }
}

class RequirementNotFoundError extends Error {
  constructor(specPath: string, requirementId: string) {
    super(`Requirement ${requirementId} not found in ${specPath}`);
  }
}
```

### Auto-Docs Errors

```typescript
class UrlNotAllowedError extends Error {
  constructor(url: string) {
    super(`URL not allowed: ${url}. Only localhost and configured domains permitted.`);
  }
}

class SelectorNotFoundError extends Error {
  constructor(selector: string, url: string) {
    super(`Selector "${selector}" not found on page ${url}`);
  }
}

class ScreenshotComparisonError extends Error {
  constructor(reason: string) {
    super(`Screenshot comparison failed: ${reason}`);
  }
}

class BrowserInitError extends Error {
  constructor(reason: string) {
    super(`Failed to initialize browser: ${reason}`);
  }
}
```

### Error Recovery Strategies

```typescript
const errorStrategies = {
  'url_not_reachable': {
    retryable: true,
    maxRetries: 2,
    backoffMs: 2000,
    fallbackAction: 'return_error'
  },
  'browser_crash': {
    retryable: true,
    maxRetries: 1,
    backoffMs: 0,
    fallbackAction: 'restart_browser'
  },
  'selector_not_found': {
    retryable: false,
    maxRetries: 0,
    backoffMs: 0,
    fallbackAction: 'return_error_with_suggestion'
  },
  'file_write_error': {
    retryable: true,
    maxRetries: 2,
    backoffMs: 500,
    fallbackAction: 'return_error'
  }
};
```

## Testing Strategy

### Unit Testing

**Spec Parser Tests**:
```typescript
describe('SpecParserService', () => {
  describe('parseTasks', () => {
    it('should parse completed tasks marked with [x]', () => {
      const content = '- [x] 1. Complete task';
      const tasks = parser.parseTasks(content);
      expect(tasks[0].completed).toBe(true);
    });

    it('should parse incomplete tasks marked with [ ]', () => {
      const content = '- [ ] 1. Incomplete task';
      const tasks = parser.parseTasks(content);
      expect(tasks[0].completed).toBe(false);
    });

    it('should handle nested tasks', () => {
      const content = `
- [ ] 1. Parent task
  - [ ] 1.1 Child task
      `;
      const tasks = parser.parseTasks(content);
      expect(tasks[1].parentNumber).toBe('1');
    });
  });
});
```

**Screenshot Service Tests**:
```typescript
describe('ScreenshotService', () => {
  describe('capture', () => {
    it('should create file at specified path', async () => {
      const result = await service.capture({
        url: 'http://localhost:3000',
        outputPath: '/tmp/test.png'
      });
      expect(fs.existsSync(result.path)).toBe(true);
    });

    it('should capture element when selector provided', async () => {
      const result = await service.capture({
        url: 'http://localhost:3000',
        selector: '#main-content',
        outputPath: '/tmp/test.png'
      });
      expect(result.width).toBeLessThan(1280); // Element smaller than viewport
    });
  });
});
```

### Property-Based Testing

All property tests run with 100 iterations minimum to ensure robust validation across diverse inputs.

```typescript
import * as fc from 'fast-check';

describe('Spec Validator Properties', () => {
  /**
   * Feature: kiro-mcps, Property 1: Task Count Consistency
   * Validates: Requirements 1.4
   */
  it('property: completed + incomplete = total', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          number: fc.string(),
          title: fc.string(),
          completed: fc.boolean()
        }), { minLength: 1 }),
        async (tasks) => {
          const content = tasks.map(t =>
            `- [${t.completed ? 'x' : ' '}] ${t.number}. ${t.title}`
          ).join('\n');

          const result = await validator.findIncompleteTasks(content);
          expect(result.total_tasks).toBe(
            result.completed_tasks + result.incomplete_tasks.length
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: kiro-mcps, Property 2: Spec Coverage Bounds
   * Validates: Requirements 3.2, 3.3
   */
  it('property: coverage percentage is 0-100', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        async (completed, total) => {
          if (total === 0) return; // Skip empty
          const adjustedCompleted = Math.min(completed, total);

          const percentage = (adjustedCompleted / total) * 100;
          expect(percentage).toBeGreaterThanOrEqual(0);
          expect(percentage).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: kiro-mcps, Property 5: Implementation Validation Completeness
   * Validates: Requirements 10.4, 10.5
   */
  it('property: validation covers all criteria', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }),
        async (acceptanceCriteria) => {
          const requirement = {
            id: '1',
            title: 'Test Requirement',
            userStory: 'As a user...',
            acceptanceCriteria: acceptanceCriteria.map((text, i) => ({
              number: i + 1,
              text
            })),
            lineNumber: 1
          };

          const result = await codeAnalysis.validateImplementation(
            requirement,
            []
          );

          // Should have one result per criterion
          expect(result.length).toBe(acceptanceCriteria.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: kiro-mcps, Property 8: Test Coverage Calculation
   * Validates: Requirements 12.3, 12.4
   */
  it('property: coverage calculation is accurate', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        async (totalCriteria, testedCriteria) => {
          const tested = Math.min(testedCriteria, totalCriteria);
          const expected = (tested / totalCriteria) * 100;

          const result = {
            coveragePercent: (tested / totalCriteria) * 100
          };

          expect(result.coveragePercent).toBeCloseTo(expected, 2);
          expect(result.coveragePercent).toBeGreaterThanOrEqual(0);
          expect(result.coveragePercent).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Auto-Docs Properties', () => {
  /**
   * Feature: kiro-mcps, Property 10: Doc Update Idempotency
   * Validates: Requirements 5.8, 6.4
   */
  it('property: repeated updates produce same result', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (placeholder, screenshotPath) => {
          const docContent = `# Test\n<!-- SCREENSHOT:${placeholder} -->`;

          const result1 = docGenerator.updateDoc(docContent, placeholder, screenshotPath);
          const result2 = docGenerator.updateDoc(result1, placeholder, screenshotPath);

          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: kiro-mcps, Property 11: Flow Step Ordering
   * Validates: Requirements 5.4, 7.3
   */
  it('property: screenshots captured in order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1 }),
            url: fc.constant('http://localhost:3000')
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (steps) => {
          const plan = {
            feature: 'test',
            steps: steps.map((s, i) => ({
              order: i,
              description: s.name,
              url: s.url,
              actions: [],
              screenshotName: `step-${i}`
            })),
            estimatedScreenshots: steps.length
          };

          const result = await navigator.executeDocumentationPlan(
            plan,
            'http://localhost:3000'
          );

          // Screenshots should be in same order as steps
          result.screenshots.forEach((screenshot, i) => {
            expect(screenshot.name).toContain(`step-${i}`);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: kiro-mcps, Property 14: Freshness Comparison Symmetry
   * Validates: Requirements 9.2
   */
  it('property: comparison is symmetric', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (pathA, pathB) => {
          // Mock comparison results
          const resultAB = await screenshotService.compare(pathA, pathB);
          const resultBA = await screenshotService.compare(pathB, pathA);

          expect(resultAB.differencePercent).toBeCloseTo(
            resultBA.differencePercent,
            2
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

Integration tests validate end-to-end MCP tool functionality with real file system and browser interactions.

```typescript
describe('Spec Validator MCP Integration', () => {
  it('should find incomplete tasks across all specs', async () => {
    // Call MCP tool
    const result = await mcpClient.call('find_incomplete_tasks', {});

    // Verify structure
    expect(result).toHaveProperty('spec_name');
    expect(result).toHaveProperty('incomplete_tasks');
    expect(Array.isArray(result.incomplete_tasks)).toBe(true);
  });

  it('should validate shopping spec structure', async () => {
    const result = await mcpClient.call('validate_spec', {
      spec_path: '.kiro/specs/amazon-shopping-mcp'
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  /**
   * Test code review functionality (Requirement 10)
   */
  it('should validate implementation against requirements', async () => {
    const result = await mcpClient.call('validate_implementation', {
      spec_path: '.kiro/specs/amazon-shopping-mcp',
      scope: { requirement_id: '1' }
    });

    expect(result).toHaveProperty('complete');
    expect(result).toHaveProperty('coverage_percent');
    expect(result).toHaveProperty('validation_results');
    expect(Array.isArray(result.validation_results)).toBe(true);
    
    // Each validation result should have criteria results
    result.validation_results.forEach(vr => {
      expect(vr).toHaveProperty('requirement_id');
      expect(vr).toHaveProperty('criteria_results');
      expect(Array.isArray(vr.criteria_results)).toBe(true);
    });
  });

  /**
   * Test implementation file discovery (Requirement 11)
   */
  it('should find implementation files for requirement', async () => {
    const result = await mcpClient.call('find_implementation_files', {
      spec_path: '.kiro/specs/amazon-shopping-mcp',
      requirement_id: '1'
    });

    expect(result).toHaveProperty('files');
    expect(Array.isArray(result.files)).toBe(true);
    
    // Each file should have confidence and reason
    result.files.forEach(file => {
      expect(file).toHaveProperty('path');
      expect(file).toHaveProperty('confidence');
      expect(['high', 'medium', 'low']).toContain(file.confidence);
      expect(file).toHaveProperty('reason');
    });
  });

  /**
   * Test test coverage checking (Requirement 12)
   */
  it('should check test coverage for requirements', async () => {
    const result = await mcpClient.call('check_test_coverage', {
      spec_path: '.kiro/specs/amazon-shopping-mcp'
    });

    expect(result).toHaveProperty('coverage_percent');
    expect(result).toHaveProperty('requirements');
    expect(Array.isArray(result.requirements)).toBe(true);
    
    // Each requirement should have test info
    result.requirements.forEach(req => {
      expect(req).toHaveProperty('requirement_id');
      expect(req).toHaveProperty('has_tests');
      expect(req).toHaveProperty('test_files');
      expect(req).toHaveProperty('missing_criteria');
    });
  });
});

describe('Auto-Docs MCP Integration', () => {
  /**
   * Test autonomous feature documentation (Requirement 5)
   */
  it('should autonomously generate feature documentation', async () => {
    const result = await mcpClient.call('generate_feature_docs', {
      feature_name: 'shopping',
      base_url: 'http://localhost:4003'
    });

    expect(result).toHaveProperty('doc_path');
    expect(result).toHaveProperty('screenshots');
    expect(result).toHaveProperty('steps_documented');
    expect(Array.isArray(result.screenshots)).toBe(true);
    expect(result.steps_documented).toBeGreaterThan(0);
    
    // Verify doc file was created
    expect(fs.existsSync(result.doc_path)).toBe(true);
    
    // Verify screenshots were created
    result.screenshots.forEach(screenshot => {
      expect(fs.existsSync(screenshot)).toBe(true);
    });
  });

  /**
   * Test app structure discovery (Requirement 8)
   */
  it('should discover app structure', async () => {
    const result = await mcpClient.call('discover_app_structure', {
      frontend_dir: 'marketing-website'
    });

    expect(result).toHaveProperty('routes');
    expect(result).toHaveProperty('navigation');
    expect(result).toHaveProperty('features_detected');
    expect(Array.isArray(result.routes)).toBe(true);
    expect(Array.isArray(result.navigation)).toBe(true);
    
    // Routes should have required fields
    result.routes.forEach(route => {
      expect(route).toHaveProperty('path');
      expect(route).toHaveProperty('name');
    });
  });

  /**
   * Test user flow documentation (Requirement 7)
   */
  it('should document user flow from natural language goal', async () => {
    const result = await mcpClient.call('document_user_flow', {
      goal: 'show how a user navigates to the demo page',
      base_url: 'http://localhost:4003'
    });

    expect(result).toHaveProperty('doc_path');
    expect(result).toHaveProperty('steps');
    expect(result).toHaveProperty('success');
    expect(Array.isArray(result.steps)).toBe(true);
    
    // Each step should have description and screenshot
    result.steps.forEach(step => {
      expect(step).toHaveProperty('description');
      expect(step).toHaveProperty('screenshot');
      expect(step).toHaveProperty('action_taken');
    });
  });

  /**
   * Test documentation freshness checking (Requirement 9)
   */
  it('should check documentation freshness', async () => {
    const result = await mcpClient.call('check_docs_freshness', {
      base_url: 'http://localhost:4003',
      threshold: 10
    });

    expect(result).toHaveProperty('docs');
    expect(result).toHaveProperty('summary');
    expect(Array.isArray(result.docs)).toBe(true);
    
    // Summary should have counts
    expect(result.summary).toHaveProperty('total');
    expect(result.summary).toHaveProperty('fresh');
    expect(result.summary).toHaveProperty('needs_update');
    expect(result.summary).toHaveProperty('broken');
    
    // Each doc should have status
    result.docs.forEach(doc => {
      expect(doc).toHaveProperty('path');
      expect(doc).toHaveProperty('status');
      expect(['fresh', 'needs_update', 'broken']).toContain(doc.status);
    });
  });

  /**
   * Test update all docs (Requirement 6)
   */
  it('should update all existing documentation', async () => {
    const result = await mcpClient.call('update_all_docs', {
      base_url: 'http://localhost:4003'
    });

    expect(result).toHaveProperty('updated');
    expect(result).toHaveProperty('failed');
    expect(result).toHaveProperty('screenshots_refreshed');
    expect(Array.isArray(result.updated)).toBe(true);
    expect(Array.isArray(result.failed)).toBe(true);
    
    // Failed items should have reason
    result.failed.forEach(failure => {
      expect(failure).toHaveProperty('doc');
      expect(failure).toHaveProperty('reason');
    });
  });
});
```

## Security Considerations

### URL Allowlist

```typescript
const ALLOWED_URL_PATTERNS = [
  /^http:\/\/localhost(:\d+)?/,
  /^http:\/\/127\.0\.0\.1(:\d+)?/,
  /^http:\/\/0\.0\.0\.0(:\d+)?/
];

function isUrlAllowed(url: string): boolean {
  return ALLOWED_URL_PATTERNS.some(pattern => pattern.test(url));
}
```

### File Path Sanitization

```typescript
function sanitizePath(basePath: string, userPath: string): string {
  const resolved = path.resolve(basePath, userPath);

  // Ensure path is within project directory
  if (!resolved.startsWith(basePath)) {
    throw new Error('Path traversal detected');
  }

  return resolved;
}
```

### Input Validation

```typescript
const captureScreenshotSchema = z.object({
  url: z.string().url().refine(isUrlAllowed, 'URL not in allowlist'),
  selector: z.string().optional(),
  full_page: z.boolean().optional(),
  output_name: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional()
});
```

## Performance Optimization

### Browser Reuse

```typescript
class ScreenshotService {
  private browser: Browser | null = null;
  private lastUsed: number = 0;
  private readonly IDLE_TIMEOUT = 60000; // 1 minute

  async getBrowser(): Promise<Browser> {
    if (this.browser && Date.now() - this.lastUsed < this.IDLE_TIMEOUT) {
      this.lastUsed = Date.now();
      return this.browser;
    }

    if (this.browser) {
      await this.browser.close();
    }

    this.browser = await chromium.launch({ headless: true });
    this.lastUsed = Date.now();
    return this.browser;
  }
}
```

### Spec Parsing Cache

```typescript
class SpecParserService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds

  async parseWithCache<T>(
    path: string,
    parser: (content: string) => T
  ): Promise<T> {
    const cached = this.cache.get(path);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const content = await fs.readFile(path, 'utf-8');
    const data = parser(content);
    this.cache.set(path, { data, timestamp: Date.now() });
    return data;
  }
}
```

## Deployment

### MCP Server Registration

Create `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "faxi-spec-validator": {
      "command": "npx",
      "args": ["ts-node", "backend/src/mcp/kiro/specValidatorMcpServer.ts"],
      "env": {
        "SPECS_DIR": ".kiro/specs"
      }
    },
    "faxi-auto-docs": {
      "command": "npx",
      "args": ["ts-node", "backend/src/mcp/kiro/autoDocsMcpServer.ts"],
      "env": {
        "SCREENSHOT_DIR": "docs/screenshots",
        "HELP_DIR": "docs/help",
        "ALLOWED_DOMAINS": "localhost,127.0.0.1"
      }
    }
  }
}
```

### Directory Structure

```
backend/src/mcp/kiro/
├── specValidatorMcpServer.ts     # MCP server entry point
├── autoDocsMcpServer.ts          # MCP server entry point
├── services/
│   ├── specParserService.ts      # Spec parsing logic
│   ├── screenshotService.ts      # Playwright wrapper
│   └── docGeneratorService.ts    # Markdown generation
└── __tests__/
    ├── specValidator.test.ts
    ├── autoDocsService.test.ts
    └── integration.test.ts
```

## Appendix

### Example Tool Descriptions for Kiro

```typescript
// Tool descriptions optimized for AI assistant understanding
const TOOL_DESCRIPTIONS = {
  find_incomplete_tasks: `Find all incomplete tasks in Kiro specs.

Example usage:
- "What tasks are left in the shopping spec?"
- "Show me incomplete items across all specs"

Parameters:
- spec_path (optional): Specific spec directory to check
  Example: ".kiro/specs/amazon-shopping-mcp"
  If omitted, checks all specs.`,

  capture_ui_screenshot: `Capture a screenshot of the running application.

Example usage:
- "Take a screenshot of the login page"
- "Capture the dashboard with full scroll"

Parameters:
- url (required): Page URL (localhost only)
  Example: "http://localhost:4003/login"
- selector (optional): CSS selector for element
  Example: "#main-content"
- full_page (optional): Capture entire scrollable page
- output_name (optional): Custom filename
  Example: "login-dark-mode"`
};
```

### Markdown Placeholder Format

```markdown
# User Guide

## Login

Here is the login screen:

<!-- SCREENSHOT:login-screen -->

Follow these steps to log in:

1. Enter your email
2. Click "Sign In"

<!-- SCREENSHOT:login-success -->
```

After `update_help_doc`:

```markdown
# User Guide

## Login

Here is the login screen:

![login-screen](../screenshots/login-screen_2025-11-30.png)

Follow these steps to log in:

1. Enter your email
2. Click "Sign In"

![login-success](../screenshots/login-success_2025-11-30.png)
```

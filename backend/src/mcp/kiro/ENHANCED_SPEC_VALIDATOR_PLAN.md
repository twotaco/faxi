# Enhanced Spec Validator MCP - Implementation Plan

## Overview

Extend the Spec Validator MCP to create a complete validation loop:
1. **Validate Requirements** - Check specs are complete
2. **Validate Implementation** - Check code matches requirements
3. **Run Tests** - Execute Playwright tests for acceptance criteria
4. **Analyze Results** - Compare test results against requirements
5. **Propose Fixes** - Generate executable plans to close gaps
6. **Document Gaps** - Create actionable reports

## New Features

### 1. Test Execution Service
**Purpose:** Run Playwright tests and capture results

**Capabilities:**
- Execute existing Playwright tests
- Run tests for specific requirements
- Capture test results (pass/fail/error)
- Record screenshots and traces on failure
- Parse test output for detailed error information

### 2. Gap Analysis Service
**Purpose:** Compare requirements vs implementation vs test results

**Capabilities:**
- Identify untested acceptance criteria
- Find failing tests and map to requirements
- Detect missing implementation for requirements
- Calculate coverage gaps (requirement → code → tests)
- Prioritize gaps by severity

### 3. Fix Proposal Service
**Purpose:** Generate actionable fix proposals

**Capabilities:**
- Analyze test failures and suggest code fixes
- Propose new tests for untested criteria
- Generate implementation stubs for missing features
- Create executable task lists for gaps
- Estimate effort for each fix

### 4. Validation Report Service
**Purpose:** Generate comprehensive validation reports

**Capabilities:**
- Create markdown reports with all findings
- Include test results, screenshots, and traces
- Show requirement → code → test traceability
- Provide fix proposals with code examples
- Generate executable plans

## New MCP Tools

### 1. `run_acceptance_tests`
**Description:** Run Playwright tests for acceptance criteria

**Input:**
```typescript
{
  spec_path: string;           // Path to spec
  requirement_id?: string;     // Optional: test specific requirement
  capture_traces?: boolean;    // Capture Playwright traces
}
```

**Output:**
```typescript
{
  tests_run: number;
  tests_passed: number;
  tests_failed: number;
  test_results: Array<{
    requirement_id: string;
    criterion_number: number;
    test_name: string;
    status: 'passed' | 'failed' | 'error';
    duration_ms: number;
    error_message?: string;
    screenshot_path?: string;
    trace_path?: string;
  }>;
  summary: {
    coverage_percent: number;
    untested_criteria: number[];
  };
}
```

### 2. `analyze_validation_gaps`
**Description:** Analyze gaps between requirements, implementation, and tests

**Input:**
```typescript
{
  spec_path: string;
  include_test_results?: boolean;  // Run tests as part of analysis
}
```

**Output:**
```typescript
{
  gaps: Array<{
    type: 'missing_implementation' | 'missing_tests' | 'failing_tests' | 'untested_criteria';
    requirement_id: string;
    criterion_number: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    evidence: {
      code_status?: 'implemented' | 'missing' | 'partial';
      test_status?: 'passed' | 'failed' | 'missing';
      test_error?: string;
    };
  }>;
  summary: {
    total_gaps: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  traceability_matrix: Array<{
    requirement_id: string;
    criterion_number: number;
    has_code: boolean;
    has_tests: boolean;
    tests_passing: boolean;
  }>;
}
```

### 3. `propose_fixes`
**Description:** Generate fix proposals for validation gaps

**Input:**
```typescript
{
  spec_path: string;
  gap_types?: string[];  // Filter by gap type
  max_proposals?: number;  // Limit number of proposals
}
```

**Output:**
```typescript
{
  proposals: Array<{
    id: string;
    gap_type: string;
    requirement_id: string;
    criterion_number: number;
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    proposed_fix: {
      type: 'code_change' | 'new_test' | 'fix_test' | 'update_requirement';
      file_path?: string;
      code_snippet?: string;
      test_code?: string;
      explanation: string;
    };
    estimated_effort: string;  // e.g., "15 minutes", "1 hour"
  }>;
  executable_plan: string;  // Markdown task list
}
```

### 4. `generate_validation_report`
**Description:** Generate comprehensive validation report

**Input:**
```typescript
{
  spec_path: string;
  include_test_results?: boolean;
  include_fix_proposals?: boolean;
  output_path?: string;
}
```

**Output:**
```typescript
{
  report_path: string;
  summary: {
    total_requirements: number;
    implemented: number;
    tested: number;
    passing: number;
    gaps: number;
    proposals: number;
  };
}
```

## Implementation Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Spec Validator MCP                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Existing Tools:                                             │
│  - validate_spec                                             │
│  - validate_implementation                                   │
│  - check_test_coverage                                       │
│                                                              │
│  New Tools:                                                  │
│  - run_acceptance_tests         ← NEW                       │
│  - analyze_validation_gaps      ← NEW                       │
│  - propose_fixes                ← NEW                       │
│  - generate_validation_report   ← NEW                       │
│                                                              │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┬──────────────┬────────────────┐
        │                     │              │                │
        ▼                     ▼              ▼                ▼
┌──────────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
│ Test Execution   │  │ Gap Analysis │  │ Fix Proposal│  │ Report Gen   │
│ Service          │  │ Service      │  │ Service     │  │ Service      │
├──────────────────┤  ├──────────────┤  ├─────────────┤  ├──────────────┤
│ - Run Playwright │  │ - Compare    │  │ - Analyze   │  │ - Generate   │
│ - Capture traces │  │   req vs code│  │   failures  │  │   markdown   │
│ - Parse results  │  │ - Compare    │  │ - Suggest   │  │ - Include    │
│ - Map to reqs    │  │   code vs test│  │   fixes     │  │   traces     │
└──────────────────┘  └──────────────┘  └─────────────┘  └──────────────┘
```

## Service Details

### Test Execution Service

```typescript
class TestExecutionService {
  /**
   * Run Playwright tests for a spec
   */
  async runAcceptanceTests(
    specPath: string,
    requirementId?: string
  ): Promise<TestExecutionResult>;

  /**
   * Find test files related to requirements
   */
  async findTestFiles(specPath: string): Promise<string[]>;

  /**
   * Execute specific test file
   */
  async executeTest(
    testFile: string,
    options: TestOptions
  ): Promise<TestResult>;

  /**
   * Parse Playwright test output
   */
  parseTestOutput(output: string): ParsedTestResult[];

  /**
   * Map test results to requirements
   */
  mapTestsToRequirements(
    testResults: TestResult[],
    requirements: ParsedRequirement[]
  ): MappedTestResult[];
}
```

### Gap Analysis Service

```typescript
class GapAnalysisService {
  /**
   * Analyze all validation gaps
   */
  async analyzeGaps(
    specPath: string,
    includeTestResults: boolean
  ): Promise<GapAnalysisResult>;

  /**
   * Build traceability matrix
   */
  buildTraceabilityMatrix(
    requirements: ParsedRequirement[],
    implementationStatus: ImplementationStatus[],
    testResults: TestResult[]
  ): TraceabilityMatrix;

  /**
   * Calculate gap severity
   */
  calculateSeverity(gap: Gap): 'critical' | 'high' | 'medium' | 'low';

  /**
   * Prioritize gaps
   */
  prioritizeGaps(gaps: Gap[]): Gap[];
}
```

### Fix Proposal Service

```typescript
class FixProposalService {
  /**
   * Generate fix proposals for gaps
   */
  async generateProposals(
    gaps: Gap[],
    specPath: string
  ): Promise<FixProposal[]>;

  /**
   * Propose code fix for failing test
   */
  proposeCodeFix(
    gap: Gap,
    testError: string,
    codeContext: string
  ): CodeFixProposal;

  /**
   * Propose new test for untested criterion
   */
  proposeNewTest(
    gap: Gap,
    requirement: ParsedRequirement
  ): TestProposal;

  /**
   * Generate executable plan
   */
  generateExecutablePlan(proposals: FixProposal[]): string;

  /**
   * Estimate effort for fix
   */
  estimateEffort(proposal: FixProposal): string;
}
```

### Validation Report Service

```typescript
class ValidationReportService {
  /**
   * Generate comprehensive validation report
   */
  async generateReport(
    specPath: string,
    options: ReportOptions
  ): Promise<ValidationReport>;

  /**
   * Create traceability section
   */
  createTraceabilitySection(matrix: TraceabilityMatrix): string;

  /**
   * Create test results section
   */
  createTestResultsSection(results: TestResult[]): string;

  /**
   * Create gap analysis section
   */
  createGapAnalysisSection(gaps: Gap[]): string;

  /**
   * Create fix proposals section
   */
  createFixProposalsSection(proposals: FixProposal[]): string;
}
```

## Example Workflow

### User: "Validate the shopping spec completely"

1. **Run validation tools:**
   ```
   - validate_spec (check structure)
   - validate_implementation (check code)
   - run_acceptance_tests (run Playwright tests)
   - analyze_validation_gaps (find gaps)
   - propose_fixes (generate proposals)
   - generate_validation_report (create report)
   ```

2. **Output:**
   ```markdown
   # Validation Report: Shopping Spec
   
   ## Summary
   - Requirements: 10
   - Implemented: 8 (80%)
   - Tested: 7 (70%)
   - Passing: 5 (50%)
   - Gaps: 5
   
   ## Traceability Matrix
   | Req | Criterion | Code | Tests | Status |
   |-----|-----------|------|-------|--------|
   | 1   | 1.1       | ✅   | ✅    | ✅ Pass |
   | 1   | 1.2       | ✅   | ✅    | ❌ Fail |
   | 1   | 1.3       | ✅   | ❌    | ⚠️ No Test |
   | 2   | 2.1       | ❌   | ❌    | ⚠️ Not Impl |
   
   ## Test Results
   ### Passed (5)
   - ✅ Requirement 1.1: User can add items to cart
   
   ### Failed (2)
   - ❌ Requirement 1.2: Cart total calculates correctly
     Error: Expected 29.99, got 30.00
     Screenshot: test-results/cart-total-fail.png
     
   ### Missing (3)
   - ⚠️ Requirement 1.3: No test found
   
   ## Gap Analysis
   ### Critical Gaps (1)
   1. **Requirement 2.1 not implemented**
      - Missing: Payment processing function
      - Impact: Users cannot complete checkout
      
   ### High Gaps (2)
   2. **Requirement 1.2 test failing**
      - Test: Cart total calculation
      - Error: Rounding error in price calculation
      
   ## Fix Proposals
   ### Proposal 1: Fix cart total calculation
   **Priority:** High
   **Effort:** 15 minutes
   
   **Problem:** Rounding error causing $0.01 difference
   
   **Proposed Fix:**
   ```typescript
   // File: src/services/cartService.ts
   calculateTotal(items: CartItem[]): number {
     const total = items.reduce((sum, item) => sum + item.price, 0);
     return Math.round(total * 100) / 100; // Fix: Round to 2 decimals
   }
   ```
   
   ### Proposal 2: Implement payment processing
   **Priority:** Critical
   **Effort:** 2 hours
   
   **Problem:** Requirement 2.1 not implemented
   
   **Proposed Implementation:**
   ```typescript
   // File: src/services/paymentService.ts
   async processPayment(orderId: string, amount: number): Promise<PaymentResult> {
     // TODO: Implement Stripe integration
     // 1. Create payment intent
     // 2. Process payment
     // 3. Update order status
   }
   ```
   
   ## Executable Plan
   - [ ] 1. Fix cart total rounding (15 min)
     - Update calculateTotal() in cartService.ts
     - Run test: npm test cart.test.ts
   - [ ] 2. Implement payment processing (2 hours)
     - Create paymentService.ts
     - Add Stripe integration
     - Write tests for payment flow
   - [ ] 3. Add test for requirement 1.3 (30 min)
     - Write Playwright test for cart persistence
   ```

## Benefits

1. **Complete Validation Loop** - Requirements → Code → Tests → Gaps → Fixes
2. **Automated Gap Detection** - No manual checking needed
3. **Actionable Proposals** - Specific code fixes with examples
4. **Traceability** - Clear mapping from requirements to tests
5. **Prioritization** - Focus on critical gaps first
6. **Executable Plans** - Ready-to-implement task lists

## Implementation Priority

1. **Phase 1:** Test Execution Service (run tests, capture results)
2. **Phase 2:** Gap Analysis Service (compare req/code/tests)
3. **Phase 3:** Fix Proposal Service (generate proposals)
4. **Phase 4:** Validation Report Service (create reports)
5. **Phase 5:** Integration (wire up new tools to MCP server)

## Estimated Effort

- Test Execution Service: 3-4 hours
- Gap Analysis Service: 2-3 hours
- Fix Proposal Service: 3-4 hours
- Validation Report Service: 2-3 hours
- Integration & Testing: 2-3 hours
- **Total: 12-17 hours**

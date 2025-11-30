# Kiro MCP Extensions - Implementation Tasks

## Task Overview

This implementation plan breaks down the Kiro MCP extensions into discrete coding tasks. The plan prioritizes getting working MCPs quickly, then adding robustness and polish. Both MCPs can be developed in parallel since they share no dependencies.

## Implementation Tasks

### Phase 1: Spec Validator MCP Core

- [ ] 1. Set up MCP server boilerplate
  - Create `backend/src/mcp/kiro/` directory structure
  - Create `specValidatorMcpServer.ts` with MCP SDK imports
  - Configure server with name "faxi-spec-validator" and version
  - Implement stdio transport setup
  - Add basic error handling and logging
  - _Requirements: All Spec Validator_

- [ ] 2. Implement spec parser service
  - Create `backend/src/mcp/kiro/services/specParserService.ts`
  - Implement `parseTasks()` to extract task items from tasks.md
  - Handle checkbox syntax `- [ ]` and `- [x]`
  - Parse nested tasks and track parent relationships
  - Extract task numbers and titles
  - Handle malformed markdown gracefully
  - _Requirements: 1.2, 1.3_

- [ ] 3. Implement `find_incomplete_tasks` tool
  - Register tool with MCP server
  - Accept optional `spec_path` parameter
  - If no path provided, scan all specs in `.kiro/specs/`
  - Return structured result with incomplete tasks array
  - Include total_tasks and completed_tasks counts
  - Handle missing tasks.md with appropriate error
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 4. Implement `validate_spec` tool
  - Check for required files (requirements.md, design.md, tasks.md)
  - Validate requirements.md has numbered requirements
  - Validate design.md has architecture sections
  - Validate tasks.md has proper checkbox syntax
  - Return issues array with file, line, and description
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ] 5. Implement `get_spec_coverage` tool
  - Scan all directories in `.kiro/specs/`
  - Calculate completion percentage per spec
  - Calculate overall project percentage
  - Handle specs without tasks.md
  - Return structured coverage report
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 6. Implement `generate_test_from_spec` tool
  - Parse requirements.md to find requirement by ID
  - Extract user story and acceptance criteria
  - Generate fast-check property test skeleton
  - Include comments referencing requirement
  - Handle missing requirement ID with helpful error
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

### Phase 1b: ★ Code Review Tools (Key Differentiator)

These tools provide actual code analysis, not just checkbox checking. This is what makes the Spec Validator MCP truly useful - it can validate that your implementation actually matches the requirements.

- [ ] 6a. Implement Code Analysis Service
  - Create `backend/src/mcp/kiro/services/codeAnalysisService.ts`
  - Implement `extractDesignLocations()` to parse design.md for file paths
  - Implement `searchCodebase()` using glob and grep patterns
  - Implement `analyzeFile()` to extract functions, interfaces, exports
  - Parse TypeScript files to find function signatures and return types
  - _Requirements: 10.2, 10.3, 11.4_

- [ ] 6b. Implement `validate_implementation` tool ★
  - Register tool with MCP server
  - Parse requirements.md to get acceptance criteria
  - Parse design.md to find expected file locations
  - Read actual source code files at those locations
  - For each acceptance criterion, check if code implements it:
    - Look for required functions/methods with correct signatures
    - Verify interfaces are implemented
    - Check for error handling patterns
    - Verify data models match design.md schemas
  - Return detailed validation report with evidence
  - Mark uncertain criteria as "needs_manual_review"
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10_

- [ ] 6c. Implement `find_implementation_files` tool
  - Parse design.md for component locations (e.g., "Location: backend/src/...")
  - Verify files exist at specified locations
  - If not in design.md, search codebase using:
    - Function/class names from requirement text
    - Import patterns matching module names
    - Comments referencing requirement ID (e.g., "Requirement 6", "Req 6")
  - Return files with confidence levels and relevant line numbers
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 6d. Implement `check_test_coverage` tool
  - Search for test files in `__tests__/`, `*.test.ts`, `*.spec.ts`
  - Look for property test comments referencing requirements:
    - Pattern: `Property X:`, `Validates: Requirements X.Y`
    - Pattern: `Feature: spec-name, Property X:`
  - Look for unit tests that test functions from design.md
  - Analyze if tests cover acceptance criteria
  - Return coverage percentage and missing criteria
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

### Phase 2: Auto-Docs MCP Core (Autonomous)

The Auto-Docs MCP is **autonomous** - you just say "document the shopping flow" and it figures out everything: URLs, navigation, screenshots, and documentation text.

- [ ] 7. Set up Auto-Docs MCP server boilerplate
  - Create `autoDocsMcpServer.ts` with MCP SDK imports
  - Configure server with name "faxi-auto-docs" and version
  - Implement stdio transport setup
  - Read environment variables for BASE_URL, DOCS_DIR
  - _Requirements: All Auto-Docs_

- [ ] 8. Implement App Discovery Service ★
  - Create `backend/src/mcp/kiro/services/appDiscoveryService.ts`
  - Implement `findRoutes()` to parse Next.js app router structure
  - Look for `page.tsx`, `layout.tsx` in `app/` or `pages/` directory
  - Extract route metadata (titles, descriptions)
  - Implement `findNavigation()` to find nav components and extract links
  - Implement `mapFeaturesToRoutes()` using spec names and route paths
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 9. Implement Autonomous Navigator Service ★
  - Create `backend/src/mcp/kiro/services/autonomousNavigatorService.ts`
  - Implement `findAndClick()` - find buttons/links by text content, not selectors
  - Implement `fillField()` - find form fields by label, placeholder, or aria-label
  - Implement `generateTestData()` - create meaningful sample data for forms
  - Implement `waitForStable()` - wait for network idle and animations
  - Implement `handleCommonPatterns()` - handle modals, toasts, loading states
  - _Requirements: 5.4, 7.3, 7.4_

- [ ] 10. Implement `generate_feature_docs` tool ★
  - Register tool with MCP server
  - When called with just a feature name (e.g., "shopping"):
    1. Read spec from `.kiro/specs/{feature}/` if exists
    2. Call App Discovery Service to find related routes
    3. Plan documentation flow (which pages, what order)
    4. Execute flow with Autonomous Navigator
    5. Generate markdown with screenshots
  - Save to `docs/help/{feature}.md`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [ ] 11. Implement Doc Generator Service
  - Create `backend/src/mcp/kiro/services/docGeneratorService.ts`
  - Generate feature overview from spec
  - Generate step-by-step instructions with screenshots
  - Generate troubleshooting section
  - Preserve manual sections marked `<!-- MANUAL -->...<!-- /MANUAL -->`
  - _Requirements: 5.6_

- [ ] 12. Implement `document_user_flow` tool ★
  - Accept a natural language goal (e.g., "show how a user places an order")
  - Parse goal to understand starting point and end state
  - Use specs to understand the user journey
  - Navigate through the flow, taking screenshots at key moments
  - Generate documentation explaining each step
  - Handle partial completion gracefully
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

### Phase 3: Auto-Docs Advanced Features

- [ ] 13. Implement `update_all_docs` tool
  - Scan `docs/help/` for existing documentation
  - For each doc, identify the feature it documents
  - Re-execute the documentation flow to capture fresh screenshots
  - Update docs while preserving manual sections
  - Report which docs were updated and any failures
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 14. Implement `check_docs_freshness` tool
  - Compare existing screenshots to current UI
  - Use pixelmatch for visual comparison
  - Flag docs where difference exceeds threshold
  - Check that referenced screenshots exist
  - Verify navigation paths still work
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 14a. Implement `discover_app_structure` tool
  - Expose app discovery as a standalone tool
  - Return routes, navigation, and detected features
  - Useful for debugging and understanding what the MCP sees
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

### Phase 4: Configuration and Integration

- [ ] 15. Create MCP configuration file
  - Create `.kiro/settings/mcp.json`
  - Register both MCP servers with command and args
  - Configure environment variables
  - Test MCP discovery in Kiro IDE
  - _Requirements: All_

- [ ] 16. Add caching for spec parsing
  - Implement 30-second TTL cache for parsed specs
  - Invalidate cache on file changes
  - Add cache hit/miss logging
  - _Requirements: NFR1.4_

- [ ] 17. Implement retry logic for screenshots
  - Add retry with 2-second delay for failed captures
  - Implement 30-second page load timeout
  - Add browser restart on crash
  - Log retry attempts
  - _Requirements: NFR2.1, NFR2.2_

### Phase 5: Testing

- [ ] 18. Write unit tests for spec parser
  - Test parsing completed tasks
  - Test parsing incomplete tasks
  - Test nested task handling
  - Test malformed markdown handling
  - _Requirements: 1, 2_

- [ ] 19. Write unit tests for autonomous navigation
  - Test App Discovery finds Next.js routes
  - Test findAndClick finds buttons by text
  - Test fillField finds inputs by label
  - Test generateTestData creates meaningful data
  - Test handleCommonPatterns detects modals
  - _Requirements: 5, 7, 8_

- [ ] 20. Write property tests for spec validator
  - Property 1: Task count consistency
  - Property 2: Coverage bounds (0-100%)
  - Property 3: Validation completeness
  - Property 4: Test generation format
  - _Requirements: All Spec Validator_

- [ ] 21. Write property tests for auto-docs
  - Property 5: Screenshot file creation
  - Property 6: Doc update idempotency
  - Property 7: Flow step ordering
  - Property 8: Comparison symmetry
  - _Requirements: All Auto-Docs_

- [ ] 22. Write integration tests
  - Test MCP tool discovery
  - Test find_incomplete_tasks on real specs
  - Test validate_spec on shopping spec
  - Test screenshot capture on localhost app
  - Test user flow execution
  - _Requirements: All_

### Phase 6: Documentation and Polish

- [ ] 23. Create usage documentation
  - Document tool descriptions for Kiro AI
  - Add examples for each tool
  - Document environment variables
  - Create troubleshooting guide
  - _Requirements: NFR4.2_

- [ ] 24. Add helpful error messages
  - Include suggested fixes in errors
  - Reference documentation in errors
  - Provide context-specific guidance
  - _Requirements: NFR4.1_

- [ ] 25. Create demo screenshots
  - Capture screenshots of MCP in action
  - Document workflow examples
  - Create short demo video
  - _Requirements: Hackathon submission_

- [ ] 26. Final testing and bug fixes
  - Manual testing with Kiro IDE
  - Fix any discovered issues
  - Performance optimization if needed
  - _Requirements: All_

## Task Dependencies

```
Phase 1 (Spec Validator - Basic):
1 → 2 → 3 → 4 → 5 → 6

Phase 1b (Code Review - KEY FEATURE):
2 → 6a → 6b → 6c → 6d
       ↓
       Requires spec parser to extract requirements/criteria

Phase 2 (Auto-Docs):
7 → 8 → 9 → 10 → 11 → 12

Phase 3 (Advanced):
9 → 13
11 → 14

Phase 4 (Config):
6d, 12 → 15
3 → 16
9 → 17

Phase 5 (Testing):
2 → 18
8 → 19
6d → 20   (includes code review testing)
12 → 21
15 → 22

Phase 6 (Docs):
22 → 23 → 24 → 25 → 26
```

## Estimated Effort

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1: Spec Validator Core | 1-6 | 4-5 hours |
| Phase 1b: Code Review Tools ★ | 6a-6d | 6-8 hours |
| Phase 2: Auto-Docs Core | 7-12 | 5-6 hours |
| Phase 3: Advanced Features | 13-14 | 2-3 hours |
| Phase 4: Configuration | 15-17 | 1-2 hours |
| Phase 5: Testing | 18-22 | 3-4 hours |
| Phase 6: Documentation | 23-26 | 2-3 hours |
| **Total** | 30 tasks | **23-31 hours** |

## Priority Order for Hackathon

For maximum impact at Kiroween, implement in this order:

**Phase A - Two WOW Demos:**
1. **Tasks 1-2**: Basic MCP setup and spec parser (foundation)
2. **Tasks 6a-6b**: Code Analysis Service + `validate_implementation` ★ (WOW #1)
3. **Tasks 7-10**: App Discovery + Autonomous Navigator + `generate_feature_docs` ★ (WOW #2)
4. **Task 15**: MCP configuration (make it work in Kiro)

**Phase B - Polish:**
5. **Tasks 11-12**: Doc generator + `document_user_flow`
6. **Remaining tasks**: Testing, docs, demo video

**The Two Key Differentiators:**
- `validate_implementation` - Kiro does actual code review, not checkbox counting
- `generate_feature_docs` - Say "document shopping" and Kiro autonomously navigates the app, takes screenshots, and writes the help guide

## Notes

- **Two WOW Features for Judges:**
  - Code Review (`validate_implementation`) - Shows Kiro analyzing actual code
  - Autonomous Docs (`generate_feature_docs`) - Shows Kiro navigating and screenshotting without human guidance
- The Code Analysis Service enables true spec-to-code validation
- The App Discovery + Autonomous Navigator enables zero-configuration documentation
- Phases 1 and 2 can be developed in parallel by different agents
- Property tests (tasks 20-21) validate correctness properties from design.md
- Integration tests (task 22) require the app to be running on localhost
- Demo video should showcase both WOW features
- Reuse existing Playwright infrastructure from `playwrightScrapingService.ts`

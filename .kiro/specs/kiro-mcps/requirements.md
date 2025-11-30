# Kiro MCP Extensions - Requirements

## Introduction

This document specifies requirements for two custom MCP (Model Context Protocol) servers that extend Kiro IDE with Faxi-specific development capabilities. These MCPs demonstrate how the Faxi project leverages Kiro's MCP integration to enhance the development workflow beyond simple prompting.

### Purpose

Unlike application MCPs that serve end-users (e.g., Shopping MCP for fax orders), these Kiro MCPs are developer-facing tools that:
1. Provide structured tool access with type safety and real execution
2. Enable automated development workflows that prompting alone cannot achieve
3. Integrate deeply with the .kiro specification system

### MCPs Overview

1. **Spec Validator MCP**: Validates .kiro specifications, tracks task completion, and generates tests from requirements
2. **Auto-Docs MCP**: Uses Playwright to capture screenshots and automatically generate/update documentation

## Glossary

- **MCP**: Model Context Protocol - an open standard for AI-tool integrations
- **Kiro IDE**: An AI-native IDE that uses specs, steering docs, hooks, and MCP servers
- **Spec**: A .kiro specification file containing requirements, design, or tasks
- **Spec Validator MCP**: The MCP server that validates .kiro specifications and tracks task completion
- **Auto-Docs MCP**: The MCP server that autonomously generates documentation using browser automation
- **Property Test**: A test that validates invariants across many random inputs using fast-check
- **Playwright**: Browser automation library for headless screenshot capture
- **Help Page**: User-facing documentation with screenshots and instructions
- **Screenshot Placeholder**: A markdown image reference to be replaced with actual screenshot
- **Acceptance Criterion**: A specific, testable condition that must be met for a requirement to be satisfied
- **Task Item**: A checkbox-formatted work item in a tasks.md file
- **Code Analysis**: The process of examining source code to verify implementation of requirements

## Requirements

### Spec Validator MCP

#### Requirement 1: Find Incomplete Tasks

**User Story:** As a developer using Kiro, I want to quickly identify incomplete tasks across all specs, so that I know what work remains.

##### Acceptance Criteria

1. WHEN a developer calls find_incomplete_tasks with a spec path THEN the Spec Validator MCP SHALL parse the tasks.md file at that path
2. WHEN the Spec Validator MCP parses a tasks.md file THEN the Spec Validator MCP SHALL identify all tasks marked with [ ] (incomplete) versus [x] (completed)
3. WHEN the Spec Validator MCP identifies incomplete tasks THEN the Spec Validator MCP SHALL return the task number, title, and parent task if nested
4. WHEN the Spec Validator MCP returns incomplete tasks THEN the Spec Validator MCP SHALL include total_tasks and completed_tasks counts
5. WHEN no spec path is provided THEN the Spec Validator MCP SHALL scan all specs in .kiro/specs/ directory
6. WHEN a tasks.md file does not exist at the specified path THEN the Spec Validator MCP SHALL return an error message containing the missing path

#### Requirement 2: Validate Spec Structure

**User Story:** As a developer using Kiro, I want to validate that my specs follow the correct structure, so that I can catch formatting errors early.

##### Acceptance Criteria

1. WHEN a developer calls validate_spec with a spec path THEN the Spec Validator MCP SHALL check for required files requirements.md, design.md, and tasks.md
2. WHEN the Spec Validator MCP validates requirements.md THEN the Spec Validator MCP SHALL verify the file contains numbered requirements with acceptance criteria
3. WHEN the Spec Validator MCP validates design.md THEN the Spec Validator MCP SHALL verify the file contains architecture sections and TypeScript interfaces
4. WHEN the Spec Validator MCP validates tasks.md THEN the Spec Validator MCP SHALL verify the file contains task items with checkbox syntax
5. WHEN validation finds issues THEN the Spec Validator MCP SHALL return a list of issues with file path, line number, and description
6. WHEN validation passes THEN the Spec Validator MCP SHALL return a result with valid set to true and an empty issues array

#### Requirement 3: Get Spec Coverage

**User Story:** As a developer using Kiro, I want to see an overview of all specs and their completion status, so that I can track overall project progress.

##### Acceptance Criteria

1. WHEN a developer calls get_spec_coverage THEN the Spec Validator MCP SHALL scan all specs in .kiro/specs/ directory
2. WHEN the Spec Validator MCP scans specs THEN the Spec Validator MCP SHALL calculate completion percentage for each spec using completed tasks divided by total tasks
3. WHEN the Spec Validator MCP returns coverage THEN the Spec Validator MCP SHALL include spec name, total tasks, completed tasks, and percentage for each spec
4. WHEN the Spec Validator MCP returns coverage THEN the Spec Validator MCP SHALL include an overall project completion percentage
5. WHEN a spec has no tasks.md file THEN the Spec Validator MCP SHALL mark that spec as having no tasks defined

#### Requirement 4: Generate Test from Spec

**User Story:** As a developer using Kiro, I want to auto-generate property test skeletons from requirements, so that I can ensure test coverage of specs.

##### Acceptance Criteria

1. WHEN a developer calls generate_test_from_spec with spec path and requirement ID THEN the Spec Validator MCP SHALL parse the requirement from requirements.md
2. WHEN the Spec Validator MCP parses a requirement THEN the Spec Validator MCP SHALL extract the user story and acceptance criteria
3. WHEN the Spec Validator MCP generates a test THEN the Spec Validator MCP SHALL create a property-based test skeleton using fast-check syntax
4. WHEN the Spec Validator MCP generates a test THEN the Spec Validator MCP SHALL include comments referencing the requirement ID and acceptance criteria
5. WHEN the Spec Validator MCP generates a test THEN the Spec Validator MCP SHALL use the property format from design.md if the design file is available
6. WHEN the requirement ID is not found THEN the Spec Validator MCP SHALL return an error message containing available requirement IDs

#### Requirement 10: Validate Implementation Against Spec (Code Review)

**User Story:** As a developer using Kiro, I want to validate that my code actually implements the requirements, so that I can catch missing functionality before marking tasks complete.

##### Acceptance Criteria

1. WHEN a developer calls validate_implementation with a spec path and optional scope THEN the Spec Validator MCP SHALL read the requirements.md and design.md files
2. WHEN the Spec Validator MCP reads design.md THEN the Spec Validator MCP SHALL extract expected file paths, TypeScript interfaces, and component locations
3. WHEN the Spec Validator MCP has expected file paths THEN the Spec Validator MCP SHALL read the actual source code files at those locations
4. WHEN the Spec Validator MCP reads source code THEN the Spec Validator MCP SHALL analyze whether the code implements the acceptance criteria from requirements.md
5. WHEN validating acceptance criteria THEN the Spec Validator MCP SHALL verify that required functions and methods exist with correct signatures, required interfaces are implemented, error handling matches specified behavior, and data models match the design.md schemas
6. WHEN the scope parameter specifies a requirement ID THEN the Spec Validator MCP SHALL validate only that specific requirement
7. WHEN the scope parameter specifies a file path THEN the Spec Validator MCP SHALL validate only requirements related to that file
8. WHEN validation finds gaps THEN the Spec Validator MCP SHALL return a detailed report containing the requirement ID, the unimplemented acceptance criterion, the expected code location from design.md, what was found or not found in the actual code, and suggested implementation guidance
9. WHEN validation passes THEN the Spec Validator MCP SHALL return a result with complete set to true and coverage_percent set to 100
10. WHEN the Spec Validator MCP cannot determine implementation status THEN the Spec Validator MCP SHALL mark that criterion as needs_manual_review with a reason

#### Requirement 11: Find Implementation Files

**User Story:** As a developer using Kiro, I want to discover which code files relate to a requirement, so that I know where to look or make changes.

##### Acceptance Criteria

1. WHEN a developer calls find_implementation_files with a spec path and requirement ID THEN the Spec Validator MCP SHALL parse design.md for file locations
2. WHEN design.md specifies a component location THEN the Spec Validator MCP SHALL verify the file exists at that location
3. WHEN the Spec Validator MCP finds related files THEN the Spec Validator MCP SHALL return file paths with line numbers of relevant code sections
4. WHEN design.md does not specify locations THEN the Spec Validator MCP SHALL search the codebase using function names, class names, import patterns, and test file references to the requirement ID
5. WHEN the Spec Validator MCP returns results THEN the Spec Validator MCP SHALL include a confidence level of high, medium, or low for each file match

#### Requirement 12: Check Test Coverage for Requirement

**User Story:** As a developer using Kiro, I want to verify that tests exist for my requirements, so that I can ensure proper test coverage.

##### Acceptance Criteria

1. WHEN a developer calls check_test_coverage with spec path and optional requirement ID THEN the Spec Validator MCP SHALL search for test files
2. WHEN searching for tests THEN the Spec Validator MCP SHALL look for property tests referencing the requirement ID in comments, unit tests in test directories that test the related functions, and integration tests that exercise the requirement acceptance criteria
3. WHEN the Spec Validator MCP finds tests THEN the Spec Validator MCP SHALL analyze if the tests cover the acceptance criteria
4. WHEN tests are missing THEN the Spec Validator MCP SHALL return which acceptance criteria lack test coverage
5. WHEN the Spec Validator MCP returns results THEN the Spec Validator MCP SHALL include a list of found test files with test names, coverage percentage calculated as criteria with tests divided by total criteria, and missing test recommendations

### Auto-Docs MCP

The Auto-Docs MCP is **autonomous** - you tell it what feature to document, and it figures out everything else: URLs, navigation, screenshots, and documentation text.

#### Requirement 5: Generate Feature Documentation (Autonomous)

**User Story:** As a developer using Kiro, I want to say "document the shopping flow" and have the MCP autonomously navigate the app, take screenshots, and write the help guide.

##### Acceptance Criteria

1. WHEN a developer calls generate_feature_docs with a feature name THEN the Auto-Docs MCP SHALL analyze the codebase to understand the feature
2. WHEN the Auto-Docs MCP analyzes the feature THEN the Auto-Docs MCP SHALL read the relevant spec from .kiro/specs/ to understand the feature purpose and flows, parse frontend routes to find relevant pages, and identify UI components related to the feature
3. WHEN the Auto-Docs MCP understands the feature THEN the Auto-Docs MCP SHALL plan a documentation flow by determining the logical order of screens to visit, identifying key UI elements to highlight, and planning what actions to perform to demonstrate the feature
4. WHEN the Auto-Docs MCP executes the documentation flow THEN the Auto-Docs MCP SHALL launch Playwright, navigate to the app base URL, navigate through the feature taking screenshots at each key step, use meaningful test data when filling forms, and capture both the action and the result
5. WHEN the Auto-Docs MCP captures screenshots THEN the Auto-Docs MCP SHALL save the screenshots with descriptive names
6. WHEN the Auto-Docs MCP completes the flow THEN the Auto-Docs MCP SHALL generate a markdown help document with feature overview derived from spec, step-by-step instructions with screenshots, tips and notes for users, and a troubleshooting section for common issues
7. WHEN the Auto-Docs MCP generates documentation THEN the Auto-Docs MCP SHALL save the document to docs/help/ with the feature name as the filename
8. WHEN a help document already exists THEN the Auto-Docs MCP SHALL update the document while preserving sections marked with MANUAL comment tags

#### Requirement 6: Update All Documentation

**User Story:** As a developer using Kiro, I want to refresh all help documentation after UI changes, so that docs stay in sync with the app.

##### Acceptance Criteria

1. WHEN a developer calls update_all_docs THEN the Auto-Docs MCP SHALL scan docs/help/ for existing documentation
2. WHEN the Auto-Docs MCP finds existing docs THEN the Auto-Docs MCP SHALL re-execute each feature documentation flow
3. WHEN re-executing flows THEN the Auto-Docs MCP SHALL capture fresh screenshots
4. WHEN updating docs THEN the Auto-Docs MCP SHALL preserve manual sections and update auto-generated content
5. WHEN a flow fails THEN the Auto-Docs MCP SHALL log the failure and continue with other docs
6. WHEN the update completes THEN the Auto-Docs MCP SHALL return a summary of updated docs and any failures

#### Requirement 7: Document User Flow

**User Story:** As a developer using Kiro, I want to describe a user goal and have the MCP figure out how to demonstrate it.

##### Acceptance Criteria

1. WHEN a developer calls document_user_flow with a goal description THEN the Auto-Docs MCP SHALL interpret the goal
2. WHEN interpreting the goal THEN the Auto-Docs MCP SHALL search specs for related requirements and acceptance criteria, identify the starting point, and plan the sequence of actions to achieve the goal
3. WHEN the Auto-Docs MCP executes the flow THEN the Auto-Docs MCP SHALL navigate to the starting point, perform actions intelligently by finding buttons by text and filling forms with sample data, take screenshots before and after key actions, and handle common patterns such as modals, confirmations, and loading states
4. WHEN the flow completes THEN the Auto-Docs MCP SHALL generate documentation explaining each step
5. WHEN the Auto-Docs MCP cannot complete a flow THEN the Auto-Docs MCP SHALL return partial results with explanation of what failed

#### Requirement 8: Discover App Structure

**User Story:** As a developer using Kiro, I want the MCP to understand my app's structure so it can navigate intelligently.

##### Acceptance Criteria

1. WHEN a developer calls discover_app_structure THEN the Auto-Docs MCP SHALL analyze the frontend codebase
2. WHEN analyzing the codebase THEN the Auto-Docs MCP SHALL find route definitions, extract page titles and descriptions from metadata, identify navigation components and menu structures, and map URL paths to feature names
3. WHEN the Auto-Docs MCP discovers structure THEN the Auto-Docs MCP SHALL cache the structure for future documentation runs
4. WHEN the structure changes THEN the Auto-Docs MCP SHALL detect changes and update its understanding
5. WHEN discovery completes THEN the Auto-Docs MCP SHALL return the app map with routes, features, and navigation paths

#### Requirement 9: Compare Documentation Freshness

**User Story:** As a developer using Kiro, I want to know which help docs are outdated compared to the current UI.

##### Acceptance Criteria

1. WHEN a developer calls check_docs_freshness THEN the Auto-Docs MCP SHALL compare existing docs against current UI
2. WHEN comparing THEN the Auto-Docs MCP SHALL capture current screenshots of each documented feature, compare against screenshots referenced in existing docs, and calculate visual difference percentage
3. WHEN differences exceed threshold of 10 percent THEN the Auto-Docs MCP SHALL flag the doc as needs update
4. WHEN checking freshness THEN the Auto-Docs MCP SHALL verify that all referenced screenshots still exist, navigation paths in docs still work, and UI elements mentioned in text still exist
5. WHEN the check completes THEN the Auto-Docs MCP SHALL return a freshness report with recommended updates

## Non-Functional Requirements

### NFR1: Performance

1. THE Spec Validator MCP SHALL complete get_spec_coverage within 2 seconds for up to 50 specs
2. THE Auto-Docs MCP SHALL capture a single screenshot within 5 seconds excluding page load time
3. THE Auto-Docs MCP SHALL support concurrent screenshot captures up to 3 parallel captures
4. THE Spec Validator MCP and Auto-Docs MCP SHALL cache parsed spec data for 30 seconds to avoid redundant file reads

### NFR2: Reliability

1. THE Auto-Docs MCP SHALL retry failed screenshot captures once with a 2 second delay
2. THE Auto-Docs MCP SHALL timeout page loads after 30 seconds
3. THE Spec Validator MCP SHALL handle malformed markdown gracefully by returning partial results
4. THE Spec Validator MCP and Auto-Docs MCP SHALL log all operations for debugging purposes

### NFR3: Security

1. THE Auto-Docs MCP SHALL navigate only to localhost URLs or explicitly allowed domains
2. THE Auto-Docs MCP SHALL execute only click and type actions and not execute arbitrary JavaScript
3. THE Spec Validator MCP and Auto-Docs MCP SHALL expose only file system paths within the project directory
4. THE Spec Validator MCP and Auto-Docs MCP SHALL validate all input parameters before execution

### NFR4: Usability

1. THE Spec Validator MCP and Auto-Docs MCP SHALL provide helpful error messages with suggested fixes
2. THE Spec Validator MCP and Auto-Docs MCP SHALL include examples in tool descriptions for Kiro AI assistant
3. THE Spec Validator MCP and Auto-Docs MCP SHALL support both absolute and relative paths for spec references
4. THE Auto-Docs MCP SHALL create directories automatically if the directories do not exist

## Technical Approach

### MCP Architecture

Both MCPs follow the standard MCP server pattern using `@modelcontextprotocol/sdk`:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({
  name: "faxi-spec-validator",
  version: "1.0.0"
}, {
  capabilities: { tools: {} }
});

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [/* tool definitions */]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Handle tool calls
});
```

### Playwright Integration

The Auto-Docs MCP reuses the existing Playwright infrastructure from `playwrightScrapingService.ts`:

```typescript
import { chromium, Browser, Page } from 'playwright';

class ScreenshotService {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--disable-gpu', '--no-sandbox']
    });
  }

  async captureScreenshot(url: string, options: CaptureOptions): Promise<ScreenshotResult> {
    const context = await this.browser!.newContext({
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });

    const screenshot = await page.screenshot({
      path: options.outputPath,
      fullPage: options.fullPage
    });

    await context.close();
    return { path: options.outputPath, size: screenshot.length };
  }
}
```

### Kiro MCP Configuration

MCPs are registered in `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "faxi-spec-validator": {
      "command": "npx",
      "args": ["ts-node", "backend/src/mcp/kiro/specValidatorMcpServer.ts"],
      "env": {}
    },
    "faxi-auto-docs": {
      "command": "npx",
      "args": ["ts-node", "backend/src/mcp/kiro/autoDocsMcpServer.ts"],
      "env": {
        "SCREENSHOT_DIR": "docs/screenshots",
        "ALLOWED_DOMAINS": "localhost,127.0.0.1"
      }
    }
  }
}
```

## Success Metrics

- **Spec Validation Accuracy**: 100% of structural issues detected
- **Screenshot Capture Success Rate**: ≥95% of captures succeed on first try
- **Documentation Freshness**: Screenshots updated within 24 hours of UI changes
- **Developer Adoption**: MCPs used in ≥80% of spec-related development sessions

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Playwright browser crashes | Medium | Low | Implement browser restart on failure |
| UI changes break selectors | Medium | Medium | Use stable data-testid attributes |
| Large screenshots consume storage | Low | Medium | Implement compression and cleanup |
| MCP startup time too slow | Medium | Low | Lazy-load Playwright only when needed |

## Dependencies

### External
- `@modelcontextprotocol/sdk`: MCP server framework
- `playwright`: Browser automation for screenshots
- `pixelmatch`: Image comparison for visual regression

### Internal
- `.kiro/specs/`: Specification files to validate
- `docs/`: Documentation directory for screenshots
- Existing Playwright configuration from `playwrightScrapingService.ts`

## Out of Scope

- CI/CD integration for automated screenshot updates
- Multi-browser screenshot comparison (Chrome only)
- Video recording of user flows
- Automated spec generation from code
- Integration with external documentation platforms

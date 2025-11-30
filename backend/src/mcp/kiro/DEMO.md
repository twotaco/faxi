# Kiro MCP Extensions - Demo Guide

## Overview

This document provides a demo guide for the two custom MCP servers that extend Kiro IDE with Faxi-specific development capabilities.

## Two WOW Features

### 1. ✅ Spec Validator MCP - Code Review & Validation

**What it does:** Validates that your code actually implements the requirements, not just checkbox tracking.

**Demo Flow:**

1. **Find Incomplete Tasks**
   ```
   Ask Kiro: "What tasks are incomplete in the kiro-mcps spec?"
   Tool: find_incomplete_tasks
   Result: Shows all incomplete tasks across specs
   ```

2. **Validate Implementation** ★
   ```
   Ask Kiro: "Is requirement 1 from kiro-mcps actually implemented?"
   Tool: validate_implementation
   Result: Analyzes actual code files and checks if each acceptance criterion is implemented
   Shows: file paths, line numbers, what's implemented, what's missing
   ```

3. **Find Implementation Files**
   ```
   Ask Kiro: "Where is requirement 10 implemented?"
   Tool: find_implementation_files
   Result: Discovers files using design.md, keyword search, and comment references
   Shows: confidence levels (high/medium/low) and relevant code sections
   ```

4. **Check Test Coverage**
   ```
   Ask Kiro: "Do we have tests for requirement 1?"
   Tool: check_test_coverage
   Result: Finds property tests and unit tests that cover acceptance criteria
   Shows: coverage percentage, missing criteria, recommendations
   ```

### 2. ✅ Auto-Docs MCP - Autonomous Documentation

**What it does:** Say "document shopping" and it autonomously navigates the app, takes screenshots, and writes the help guide.

**Demo Flow:**

1. **Discover App Structure**
   ```
   Ask Kiro: "What routes exist in the marketing website?"
   Tool: discover_app_structure
   Result: Analyzes codebase and finds all Next.js routes, navigation, and features
   ```

2. **Generate Feature Documentation** ★
   ```
   Ask Kiro: "Document the shopping feature"
   Tool: generate_feature_docs
   What happens:
   - Reads spec from .kiro/specs/shopping/
   - Discovers related routes automatically
   - Launches browser and navigates through the feature
   - Takes screenshots at each step
   - Generates markdown documentation with screenshots
   Result: Complete help guide at docs/help/shopping.md
   ```

3. **Document User Flow**
   ```
   Ask Kiro: "Show how a user places an order"
   Tool: document_user_flow
   What happens:
   - Parses the natural language goal
   - Figures out the starting point and flow
   - Navigates through the UI autonomously
   - Captures screenshots at key moments
   - Generates step-by-step documentation
   ```

4. **Check Documentation Freshness**
   ```
   Ask Kiro: "Is our documentation up to date?"
   Tool: check_docs_freshness
   Result: Checks if screenshots exist and identifies outdated docs
   ```

5. **Update All Documentation**
   ```
   Ask Kiro: "Refresh all help documentation"
   Tool: update_all_docs
   What happens:
   - Scans docs/help/ for existing documentation
   - Re-executes each documentation flow
   - Captures fresh screenshots
   - Updates docs while preserving manual sections
   ```

## Key Differentiators

### Spec Validator MCP
- **Not just checkbox tracking** - Analyzes actual source code
- **Multi-strategy file discovery** - design.md + keyword search + comment references
- **Detailed validation reports** - Shows exactly what's implemented and what's missing
- **Test coverage analysis** - Finds property tests and unit tests automatically

### Auto-Docs MCP
- **Zero configuration** - No need to specify URLs or selectors
- **Autonomous navigation** - Finds buttons by text, forms by labels
- **Intelligent element discovery** - Multiple strategies to find UI elements
- **Preserves manual sections** - Marked with `<!-- MANUAL -->` tags
- **Natural language goals** - Describe what you want, it figures out how

## Technical Highlights

### Spec Validator
- 7 tools implemented
- Code analysis service with AST parsing
- Multi-file discovery algorithms
- Comprehensive error messages with suggested fixes

### Auto-Docs
- 5 tools implemented
- App discovery service (Next.js App Router & Pages Router)
- Autonomous navigator with retry logic
- Screenshot capture with 30-second timeout
- Browser restart on crash

## Setup

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **MCP Configuration**
   The MCPs are already configured in `.kiro/settings/mcp.json`

3. **Restart Kiro IDE**
   Restart Kiro to load the MCP configuration

4. **Test the MCPs**
   Try asking Kiro:
   - "What tasks are incomplete in kiro-mcps?"
   - "Is requirement 10 implemented?"
   - "Discover the app structure"

## Demo Script for Judges

### Part 1: Code Review (2 minutes)

1. Show the kiro-mcps spec in Kiro IDE
2. Ask: "Is requirement 10 from kiro-mcps actually implemented?"
3. Watch as Kiro:
   - Reads requirements.md and design.md
   - Finds the actual source code files
   - Analyzes each acceptance criterion
   - Shows detailed validation report
4. Highlight: "This is actual code review, not checkbox counting"

### Part 2: Autonomous Documentation (3 minutes)

1. Show the marketing website running on localhost
2. Ask: "Document the demo feature"
3. Watch as Kiro:
   - Discovers routes automatically
   - Launches browser
   - Navigates through the feature
   - Takes screenshots
   - Generates markdown documentation
4. Show the generated docs/help/demo.md file
5. Highlight: "Zero configuration - just say what feature to document"

### Part 3: Natural Language Flow (1 minute)

1. Ask: "Show how a user navigates to the about page"
2. Watch as Kiro:
   - Parses the goal
   - Figures out the navigation
   - Captures the flow
   - Generates documentation
3. Highlight: "Natural language understanding - no technical details needed"

## Success Metrics

- ✅ Both MCPs fully functional
- ✅ 12 tools implemented (7 Spec Validator + 5 Auto-Docs)
- ✅ Comprehensive test coverage (unit + property + integration)
- ✅ Zero-configuration autonomous operation
- ✅ Intelligent error handling and retry logic
- ✅ Production-ready code quality

## Next Steps

1. **Test with Real Specs** - Use on actual Faxi specs
2. **Capture Demo Video** - Record the demo flow
3. **Performance Optimization** - Profile and optimize if needed
4. **User Feedback** - Get feedback from team members

---

*This demo guide was created for the Kiroween hackathon submission.*

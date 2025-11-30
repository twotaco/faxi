# Kiro MCP Extensions

This directory contains MCP (Model Context Protocol) servers designed specifically for Kiro IDE integration. These are developer-facing tools that help manage .kiro specifications and automate documentation.

## MCP Servers

### Spec Validator MCP (`specValidatorMcpServer.ts`)

Validates .kiro specifications, tracks task completion, and performs code review.

**Status**: Boilerplate complete (Task 1 ✓)

**Tools**:
- `find_incomplete_tasks` - Find incomplete tasks in specs (Task 3)
- `validate_spec` - Validate spec structure and format (Task 4)
- `get_spec_coverage` - Get coverage overview of all specs (Task 5)
- `generate_test_from_spec` - Generate property test skeletons (Task 6)
- `validate_implementation` - CODE REVIEW: Validate code against requirements (Task 6b) ★
- `find_implementation_files` - Find source files for requirements (Task 6c) ★
- `check_test_coverage` - Check test coverage for requirements (Task 6d) ★

**Key Features**:
- ★ **Code Review**: Actually analyzes source code to verify implementation, not just checkbox tracking
- Property-based test generation from requirements
- Comprehensive spec validation

### Auto-Docs MCP (`autoDocsMcpServer.ts`)

Autonomously generates and updates documentation using browser automation.

**Status**: Not yet implemented (Task 7+)

**Tools**:
- `generate_feature_docs` - Autonomously document a feature (Task 10) ★
- `update_all_docs` - Refresh all documentation (Task 13)
- `document_user_flow` - Document from natural language goal (Task 12) ★
- `discover_app_structure` - Discover app routes and navigation (Task 14a)
- `check_docs_freshness` - Check which docs are outdated (Task 14)

**Key Features**:
- ★ **Autonomous Navigation**: Just say "document shopping" and it figures out everything
- Intelligent UI interaction without manual selectors
- Screenshot capture and markdown generation

## Services

### `services/specParserService.ts`

Parses .kiro specification files and extracts structured data.

**Status**: Interface defined (Task 1 ✓), Implementation pending (Task 2)

**Functions**:
- `parseTasks()` - Extract tasks from tasks.md
- `parseRequirements()` - Extract requirements from requirements.md
- `validateStructure()` - Validate spec file structure

### `services/codeAnalysisService.ts`

Analyzes source code to validate implementation against requirements.

**Status**: Interface defined (Task 1 ✓), Implementation pending (Task 6a)

**Functions**:
- `validateImplementation()` - Check if code implements acceptance criteria
- `findImplementationFiles()` - Find source files for requirements
- `extractDesignLocations()` - Parse design.md for file locations
- `searchCodebase()` - Search for requirement-related code
- `analyzeFile()` - Analyze a file for implementation evidence
- `findTestsForRequirement()` - Find tests covering a requirement

## Running the MCP Servers

### Development

Test the Spec Validator MCP server:

```bash
cd backend
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npx tsx src/mcp/kiro/specValidatorMcpServer.ts
```

### Kiro IDE Integration

Register the MCP servers in `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "faxi-spec-validator": {
      "command": "npx",
      "args": ["tsx", "backend/src/mcp/kiro/specValidatorMcpServer.ts"],
      "env": {
        "SPECS_DIR": ".kiro/specs"
      }
    },
    "faxi-auto-docs": {
      "command": "npx",
      "args": ["tsx", "backend/src/mcp/kiro/autoDocsMcpServer.ts"],
      "env": {
        "SCREENSHOT_DIR": "docs/screenshots",
        "HELP_DIR": "docs/help",
        "ALLOWED_DOMAINS": "localhost,127.0.0.1"
      }
    }
  }
}
```

## Architecture

### MCP Protocol

These servers use the standard MCP SDK (`@modelcontextprotocol/sdk`) with stdio transport for communication with Kiro IDE. This is different from the application MCP servers (shopping, email, etc.) which use the internal MCPServer interface.

### Error Handling

- All errors are logged to stderr (stdout is reserved for MCP protocol)
- Tool calls return structured error responses
- Graceful shutdown on SIGINT/SIGTERM

### Logging

Logs are written to stderr in JSON format:

```json
{
  "timestamp": "2025-11-30T15:04:52.916Z",
  "level": "info",
  "message": "Spec Validator MCP Server initialized",
  "data": { "version": "1.0.0" }
}
```

## Development Workflow

1. **Task 1** ✓: Set up MCP server boilerplate
2. **Task 2**: Implement spec parser service
3. **Tasks 3-6**: Implement basic spec validation tools
4. **Tasks 6a-6d**: Implement code review tools ★
5. **Tasks 7-12**: Implement Auto-Docs MCP ★
6. **Tasks 13-17**: Advanced features and configuration
7. **Tasks 18-22**: Testing (unit, property-based, integration)
8. **Tasks 23-26**: Documentation and polish

## Testing

### Unit Tests

```bash
cd backend
npm test src/mcp/kiro
```

### Integration Tests

```bash
cd backend
npm run test:integration
```

### Property-Based Tests

Property tests validate correctness properties from the design document:

```bash
cd backend
npm test -- --grep "property:"
```

## References

- [MCP Specification](https://modelcontextprotocol.io/)
- [Kiro Specs Documentation](.kiro/specs/kiro-mcps/)
- [Design Document](.kiro/specs/kiro-mcps/design.md)
- [Requirements Document](.kiro/specs/kiro-mcps/requirements.md)
- [Task List](.kiro/specs/kiro-mcps/tasks.md)

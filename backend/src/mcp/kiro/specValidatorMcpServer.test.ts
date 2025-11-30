/**
 * Integration tests for Spec Validator MCP Server - validate_spec tool
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Spec Validator MCP Server - validate_spec tool', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for test specs
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-mcp-test-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('validate_spec tool', () => {
    it('should validate a complete, well-formed spec', async () => {
      // Create a complete, valid spec
      fs.writeFileSync(
        path.join(tempDir, 'requirements.md'),
        `# Requirements

## Introduction

This is a test spec.

## Requirements

### Requirement 1

**User Story:** As a user, I want to do something.

#### Acceptance Criteria

1. WHEN condition THEN the system SHALL do something
`
      );

      fs.writeFileSync(
        path.join(tempDir, 'design.md'),
        `# Design Document

## Overview

This is the design overview.

## Architecture

System architecture description.

## Components and Interfaces

Component descriptions.

## Data Models

Data model definitions.
`
      );

      fs.writeFileSync(
        path.join(tempDir, 'tasks.md'),
        `# Implementation Tasks

- [ ] 1. First task
- [x] 2. Completed task
`
      );

      // Import and test the handler directly
      const { specParserService } = await import('./services/specParserService.js');
      const result = specParserService.validateStructure(tempDir);

      expect(result.valid).toBe(true);
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
    });

    it('should detect missing required files', async () => {
      // Create only requirements.md
      fs.writeFileSync(
        path.join(tempDir, 'requirements.md'),
        '# Requirements\n\n### Requirement 1\n\n#### Acceptance Criteria\n\n1. Test'
      );

      const { specParserService } = await import('./services/specParserService.js');
      const result = specParserService.validateStructure(tempDir);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.file === 'design.md' && i.issue.includes('missing'))).toBe(true);
      expect(result.issues.some(i => i.file === 'tasks.md' && i.issue.includes('missing'))).toBe(true);
    });

    it('should detect invalid requirements.md format', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'requirements.md'),
        '# Requirements\n\nNo numbered requirements here'
      );
      fs.writeFileSync(
        path.join(tempDir, 'design.md'),
        '# Design\n\n## Architecture\n\nTest\n\n## Components\n\nTest\n\n## Data Models\n\nTest'
      );
      fs.writeFileSync(
        path.join(tempDir, 'tasks.md'),
        '# Tasks\n\n- [ ] Task 1'
      );

      const { specParserService } = await import('./services/specParserService.js');
      const result = specParserService.validateStructure(tempDir);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => 
        i.file === 'requirements.md' && 
        i.severity === 'error' &&
        i.issue.includes('No numbered requirements')
      )).toBe(true);
    });

    it('should detect invalid tasks.md format', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'requirements.md'),
        '# Requirements\n\n### Requirement 1\n\n#### Acceptance Criteria\n\n1. Test'
      );
      fs.writeFileSync(
        path.join(tempDir, 'design.md'),
        '# Design\n\n## Architecture\n\nTest\n\n## Components\n\nTest\n\n## Data Models\n\nTest'
      );
      fs.writeFileSync(
        path.join(tempDir, 'tasks.md'),
        '# Tasks\n\n- [invalid] Task with invalid checkbox'
      );

      const { specParserService } = await import('./services/specParserService.js');
      const result = specParserService.validateStructure(tempDir);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => 
        i.file === 'tasks.md' && 
        i.severity === 'error' &&
        i.issue.includes('Invalid checkbox syntax')
      )).toBe(true);
    });

    it('should provide helpful summary information', async () => {
      // Create spec with some warnings
      fs.writeFileSync(
        path.join(tempDir, 'requirements.md'),
        '# Requirements\n\n### Requirement 1\n\n#### Acceptance Criteria\n\n1. Test'
      );
      fs.writeFileSync(
        path.join(tempDir, 'design.md'),
        '# Design\n\n## Some Section\n\nMissing expected architecture sections but has enough content to not be empty.'
      );
      fs.writeFileSync(
        path.join(tempDir, 'tasks.md'),
        '# Tasks\n\n- [ ] Task 1\n- Task without checkbox'
      );

      const { specParserService } = await import('./services/specParserService.js');
      const result = specParserService.validateStructure(tempDir);

      // Should be valid (only warnings, no errors)
      expect(result.valid).toBe(true);
      
      // Should have warnings
      const warnings = result.issues.filter(i => i.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Real spec validation', () => {
    it('should validate the kiro-mcps spec itself', async () => {
      const kiroMcpsPath = path.resolve(__dirname, '../../../.kiro/specs/kiro-mcps');
      
      // Only run if the spec exists
      if (fs.existsSync(kiroMcpsPath)) {
        const { specParserService } = await import('./services/specParserService.js');
        const result = specParserService.validateStructure(kiroMcpsPath);

        // The kiro-mcps spec should be valid
        expect(result.valid).toBe(true);
        
        // Log any warnings for informational purposes
        if (result.issues.length > 0) {
          console.log('Kiro MCPs spec validation warnings:', result.issues);
        }
      }
    });
  });
});

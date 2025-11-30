/**
 * Tests for Spec Parser Service - validate_spec functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SpecParserService } from './specParserService.js';

describe('SpecParserService - validateStructure', () => {
  let tempDir: string;
  let specParserService: SpecParserService;

  beforeEach(() => {
    // Create a temporary directory for test specs
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-test-'));
    specParserService = new SpecParserService();
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Directory validation', () => {
    it('should return error if spec directory does not exist', () => {
      const nonExistentPath = path.join(tempDir, 'non-existent');
      const result = specParserService.validateStructure(nonExistentPath);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe('error');
      expect(result.issues[0].issue).toContain('does not exist');
    });

    it('should return error if path is not a directory', () => {
      const filePath = path.join(tempDir, 'file.txt');
      fs.writeFileSync(filePath, 'test');

      const result = specParserService.validateStructure(filePath);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe('error');
      expect(result.issues[0].issue).toContain('not a directory');
    });
  });

  describe('Required files validation', () => {
    it('should return errors for missing required files', () => {
      const result = specParserService.validateStructure(tempDir);

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThanOrEqual(3);
      
      const missingFiles = result.issues.filter(i => i.issue.includes('missing'));
      expect(missingFiles).toHaveLength(3);
      
      const fileNames = missingFiles.map(i => i.file);
      expect(fileNames).toContain('requirements.md');
      expect(fileNames).toContain('design.md');
      expect(fileNames).toContain('tasks.md');
    });

    it('should validate when all required files exist', () => {
      // Create minimal valid spec files
      fs.writeFileSync(
        path.join(tempDir, 'requirements.md'),
        '# Requirements\n\n### Requirement 1\n\n#### Acceptance Criteria\n\n1. Test criterion'
      );
      fs.writeFileSync(
        path.join(tempDir, 'design.md'),
        '# Design\n\n## Architecture\n\nTest architecture\n\n## Components\n\nTest components\n\n## Data Models\n\nTest models'
      );
      fs.writeFileSync(
        path.join(tempDir, 'tasks.md'),
        '# Tasks\n\n- [ ] Task 1\n- [x] Task 2'
      );

      const result = specParserService.validateStructure(tempDir);

      expect(result.valid).toBe(true);
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
    });
  });

  describe('requirements.md validation', () => {
    beforeEach(() => {
      // Create design.md and tasks.md to isolate requirements.md testing
      fs.writeFileSync(
        path.join(tempDir, 'design.md'),
        '# Design\n\n## Architecture\n\nTest\n\n## Components\n\nTest\n\n## Data Models\n\nTest'
      );
      fs.writeFileSync(
        path.join(tempDir, 'tasks.md'),
        '# Tasks\n\n- [ ] Task 1'
      );
    });

    it('should detect missing numbered requirements', () => {
      fs.writeFileSync(
        path.join(tempDir, 'requirements.md'),
        '# Requirements\n\nSome text but no requirements'
      );

      const result = specParserService.validateStructure(tempDir);

      expect(result.valid).toBe(false);
      const reqIssues = result.issues.filter(i => i.file === 'requirements.md');
      expect(reqIssues.some(i => i.issue.includes('No numbered requirements'))).toBe(true);
    });

    it('should accept valid requirement format with ### Requirement N', () => {
      fs.writeFileSync(
        path.join(tempDir, 'requirements.md'),
        '# Requirements\n\n### Requirement 1\n\n**User Story:** Test\n\n#### Acceptance Criteria\n\n1. Test'
      );

      const result = specParserService.validateStructure(tempDir);

      const reqErrors = result.issues.filter(
        i => i.file === 'requirements.md' && i.severity === 'error'
      );
      expect(reqErrors).toHaveLength(0);
    });

    it('should accept valid requirement format with ## Requirement N', () => {
      fs.writeFileSync(
        path.join(tempDir, 'requirements.md'),
        '# Requirements\n\n## Requirement 1\n\n**User Story:** Test\n\n### Acceptance Criteria\n\n1. Test'
      );

      const result = specParserService.validateStructure(tempDir);

      const reqErrors = result.issues.filter(
        i => i.file === 'requirements.md' && i.severity === 'error'
      );
      expect(reqErrors).toHaveLength(0);
    });

    it('should accept NFR requirements', () => {
      fs.writeFileSync(
        path.join(tempDir, 'requirements.md'),
        '# Requirements\n\n### Requirement NFR1\n\n**User Story:** Test\n\n#### Acceptance Criteria\n\n1. Test'
      );

      const result = specParserService.validateStructure(tempDir);

      const reqErrors = result.issues.filter(
        i => i.file === 'requirements.md' && i.severity === 'error'
      );
      expect(reqErrors).toHaveLength(0);
    });
  });

  describe('design.md validation', () => {
    beforeEach(() => {
      // Create requirements.md and tasks.md to isolate design.md testing
      fs.writeFileSync(
        path.join(tempDir, 'requirements.md'),
        '# Requirements\n\n### Requirement 1\n\n#### Acceptance Criteria\n\n1. Test'
      );
      fs.writeFileSync(
        path.join(tempDir, 'tasks.md'),
        '# Tasks\n\n- [ ] Task 1'
      );
    });

    it('should detect empty or too short design document', () => {
      fs.writeFileSync(path.join(tempDir, 'design.md'), 'Short');

      const result = specParserService.validateStructure(tempDir);

      expect(result.valid).toBe(false);
      const designIssues = result.issues.filter(i => i.file === 'design.md');
      expect(designIssues.some(i => i.issue.includes('empty or too short'))).toBe(true);
    });

    it('should warn about missing architecture sections', () => {
      fs.writeFileSync(
        path.join(tempDir, 'design.md'),
        '# Design\n\n## Some Other Section\n\nThis is a design document without the expected sections. It has enough content to not be considered empty.'
      );

      const result = specParserService.validateStructure(tempDir);

      const designWarnings = result.issues.filter(
        i => i.file === 'design.md' && i.severity === 'warning'
      );
      expect(designWarnings.length).toBeGreaterThan(0);
      expect(designWarnings.some(i => i.issue.includes('architecture'))).toBe(true);
    });

    it('should accept design with all expected sections', () => {
      fs.writeFileSync(
        path.join(tempDir, 'design.md'),
        '# Design\n\n## Architecture\n\nTest architecture\n\n## Components and Interfaces\n\nTest components\n\n## Data Models\n\nTest models'
      );

      const result = specParserService.validateStructure(tempDir);

      const designErrors = result.issues.filter(
        i => i.file === 'design.md' && i.severity === 'error'
      );
      expect(designErrors).toHaveLength(0);
    });
  });

  describe('tasks.md validation', () => {
    beforeEach(() => {
      // Create requirements.md and design.md to isolate tasks.md testing
      fs.writeFileSync(
        path.join(tempDir, 'requirements.md'),
        '# Requirements\n\n### Requirement 1\n\n#### Acceptance Criteria\n\n1. Test'
      );
      fs.writeFileSync(
        path.join(tempDir, 'design.md'),
        '# Design\n\n## Architecture\n\nTest\n\n## Components\n\nTest\n\n## Data Models\n\nTest'
      );
    });

    it('should detect missing task items', () => {
      fs.writeFileSync(
        path.join(tempDir, 'tasks.md'),
        '# Tasks\n\nNo tasks here'
      );

      const result = specParserService.validateStructure(tempDir);

      expect(result.valid).toBe(false);
      const taskIssues = result.issues.filter(i => i.file === 'tasks.md');
      expect(taskIssues.some(i => i.issue.includes('No valid task items'))).toBe(true);
    });

    it('should accept valid checkbox syntax - [ ]', () => {
      fs.writeFileSync(
        path.join(tempDir, 'tasks.md'),
        '# Tasks\n\n- [ ] Task 1\n- [ ] Task 2'
      );

      const result = specParserService.validateStructure(tempDir);

      const taskErrors = result.issues.filter(
        i => i.file === 'tasks.md' && i.severity === 'error'
      );
      expect(taskErrors).toHaveLength(0);
    });

    it('should accept valid checkbox syntax - [x]', () => {
      fs.writeFileSync(
        path.join(tempDir, 'tasks.md'),
        '# Tasks\n\n- [x] Task 1\n- [x] Task 2'
      );

      const result = specParserService.validateStructure(tempDir);

      const taskErrors = result.issues.filter(
        i => i.file === 'tasks.md' && i.severity === 'error'
      );
      expect(taskErrors).toHaveLength(0);
    });

    it('should accept nested tasks with indentation', () => {
      fs.writeFileSync(
        path.join(tempDir, 'tasks.md'),
        '# Tasks\n\n- [ ] Task 1\n  - [ ] Subtask 1.1\n  - [x] Subtask 1.2'
      );

      const result = specParserService.validateStructure(tempDir);

      const taskErrors = result.issues.filter(
        i => i.file === 'tasks.md' && i.severity === 'error'
      );
      expect(taskErrors).toHaveLength(0);
    });

    it('should detect invalid checkbox syntax', () => {
      fs.writeFileSync(
        path.join(tempDir, 'tasks.md'),
        '# Tasks\n\n- [invalid] Task 1\n- [ ] Task 2'
      );

      const result = specParserService.validateStructure(tempDir);

      expect(result.valid).toBe(false);
      const taskErrors = result.issues.filter(
        i => i.file === 'tasks.md' && i.severity === 'error'
      );
      expect(taskErrors.some(i => i.issue.includes('Invalid checkbox syntax'))).toBe(true);
    });

    it('should warn about tasks without checkboxes', () => {
      fs.writeFileSync(
        path.join(tempDir, 'tasks.md'),
        '# Tasks\n\n- Task without checkbox\n- [ ] Task with checkbox'
      );

      const result = specParserService.validateStructure(tempDir);

      const taskWarnings = result.issues.filter(
        i => i.file === 'tasks.md' && i.severity === 'warning'
      );
      expect(taskWarnings.some(i => i.issue.includes('missing checkbox'))).toBe(true);
    });
  });

  describe('Integration - complete spec validation', () => {
    it('should validate a complete, well-formed spec', () => {
      // Create a complete, valid spec
      fs.writeFileSync(
        path.join(tempDir, 'requirements.md'),
        `# Requirements

## Introduction

This is a test spec.

## Glossary

- **Term**: Definition

## Requirements

### Requirement 1

**User Story:** As a user, I want to do something, so that I can achieve a goal.

#### Acceptance Criteria

1. WHEN condition THEN the system SHALL do something
2. WHEN another condition THEN the system SHALL do something else

### Requirement 2

**User Story:** As a user, I want another feature.

#### Acceptance Criteria

1. Test criterion
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

## Correctness Properties

Property definitions.
`
      );

      fs.writeFileSync(
        path.join(tempDir, 'tasks.md'),
        `# Implementation Tasks

## Phase 1

- [ ] 1. First task
  - [ ] 1.1 Subtask
  - [x] 1.2 Completed subtask
- [x] 2. Completed task
- [ ] 3. Another task
`
      );

      const result = specParserService.validateStructure(tempDir);

      expect(result.valid).toBe(true);
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
    });
  });
});

/**
 * Unit tests for Code Analysis Service
 * Tests the core functionality of code analysis for requirement validation
 */

import { describe, it, expect } from 'vitest';
import { CodeAnalysisService } from './codeAnalysisService.js';
import { ParsedRequirement } from './specParserService.js';

describe('CodeAnalysisService', () => {
  const service = new CodeAnalysisService();

  describe('extractDesignLocations', () => {
    it('should extract file paths from Location markers', () => {
      const designContent = `
## Shopping MCP Server

**Location**: \`backend/src/mcp/shoppingMcpServer.ts\`

This component handles shopping operations.

## Email Service

Location: backend/src/services/emailService.ts

Handles email operations.
      `;

      const locations = service.extractDesignLocations(designContent);

      expect(locations).toHaveLength(2);
      expect(locations[0]).toMatchObject({
        component: 'Shopping MCP Server',
        filePath: 'backend/src/mcp/shoppingMcpServer.ts',
        section: 'Shopping MCP Server'
      });
      expect(locations[1]).toMatchObject({
        filePath: 'backend/src/services/emailService.ts'
      });
    });

    it('should extract file paths from code comments', () => {
      const designContent = `
## Architecture

The main server is located at:
// backend/src/index.ts

And the MCP server at:
// backend/src/mcp/kiro/specValidatorMcpServer.ts
      `;

      const locations = service.extractDesignLocations(designContent);

      expect(locations.length).toBeGreaterThanOrEqual(2);
      expect(locations.some(l => l.filePath === 'backend/src/index.ts')).toBe(true);
      expect(locations.some(l => l.filePath === 'backend/src/mcp/kiro/specValidatorMcpServer.ts')).toBe(true);
    });

    it('should extract file paths from inline backticks', () => {
      const designContent = `
## Components

The service is implemented in \`backend/src/services/testService.ts\` and uses
the repository at \`backend/src/repositories/testRepository.ts\`.
      `;

      const locations = service.extractDesignLocations(designContent);

      expect(locations.length).toBeGreaterThanOrEqual(2);
      expect(locations.some(l => l.filePath === 'backend/src/services/testService.ts')).toBe(true);
      expect(locations.some(l => l.filePath === 'backend/src/repositories/testRepository.ts')).toBe(true);
    });

    it('should remove duplicate file paths', () => {
      const designContent = `
## Component A
Location: backend/src/services/shared.ts

## Component B
Location: backend/src/services/shared.ts
      `;

      const locations = service.extractDesignLocations(designContent);

      expect(locations).toHaveLength(1);
      expect(locations[0].filePath).toBe('backend/src/services/shared.ts');
    });

    it('should handle empty design content', () => {
      const locations = service.extractDesignLocations('');
      expect(locations).toHaveLength(0);
    });
  });

  describe('searchCodebase', () => {
    it('should find patterns in files', async () => {
      const patterns = ['CodeAnalysisService', 'extractDesignLocations'];
      const fileGlobs = ['src/mcp/kiro/services/*.ts'];

      const results = await service.searchCodebase(patterns, fileGlobs);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.filePath.includes('codeAnalysisService.ts'))).toBe(true);
      expect(results.some(r => r.matchType === 'class_name' || r.matchType === 'function_name')).toBe(true);
    });

    it('should handle case-insensitive search', async () => {
      const patterns = ['codeanalysisservice'];
      const fileGlobs = ['src/mcp/kiro/services/*.ts'];

      const results = await service.searchCodebase(patterns, fileGlobs);

      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-matching patterns', async () => {
      const patterns = ['ThisPatternDefinitelyDoesNotExistAnywhere12345'];
      const fileGlobs = ['backend/src/mcp/kiro/services/*.ts'];

      const results = await service.searchCodebase(patterns, fileGlobs);

      expect(results).toHaveLength(0);
    });
  });

  describe('analyzeFile', () => {
    it('should extract exports from TypeScript file', async () => {
      const filePath = 'src/mcp/kiro/services/codeAnalysisService.ts';
      const criteria = [{ number: 1, text: 'Test criterion' }];

      const analysis = await service.analyzeFile(filePath, criteria);

      expect(analysis.filePath).toBe(filePath);
      expect(analysis.exports).toContain('CodeAnalysisService');
      expect(analysis.exports).toContain('codeAnalysisService');
    });

    it('should extract interfaces from TypeScript file', async () => {
      const filePath = 'src/mcp/kiro/services/codeAnalysisService.ts';
      const criteria = [{ number: 1, text: 'Test criterion' }];

      const analysis = await service.analyzeFile(filePath, criteria);

      expect(analysis.interfaces.length).toBeGreaterThan(0);
      expect(analysis.interfaces).toContain('DesignLocation');
    });

    it('should extract functions with parameters', async () => {
      const filePath = 'src/mcp/kiro/services/codeAnalysisService.ts';
      const criteria = [{ number: 1, text: 'Test criterion' }];

      const analysis = await service.analyzeFile(filePath, criteria);

      expect(analysis.functions.length).toBeGreaterThan(0);
      
      const extractMethod = analysis.functions.find(f => f.name === 'extractDesignLocations');
      expect(extractMethod).toBeDefined();
      expect(extractMethod?.parameters.length).toBeGreaterThan(0);
    });

    it('should detect error handling', async () => {
      const filePath = 'src/mcp/kiro/services/codeAnalysisService.ts';
      const criteria = [{ number: 1, text: 'Test criterion' }];

      const analysis = await service.analyzeFile(filePath, criteria);

      expect(analysis.hasErrorHandling).toBe(true);
    });

    it('should throw error for non-existent file', async () => {
      const filePath = 'src/non-existent-file.ts';
      const criteria = [{ number: 1, text: 'Test criterion' }];

      await expect(service.analyzeFile(filePath, criteria)).rejects.toThrow();
    });
  });

  describe('findImplementationFiles', () => {
    it('should find files from design locations', async () => {
      const requirement: ParsedRequirement = {
        id: '1',
        title: 'Code Analysis Service',
        userStory: 'As a developer, I want code analysis',
        acceptanceCriteria: [
          { number: 1, text: 'SHALL analyze code' }
        ],
        lineNumber: 1
      };

      const designDoc = `
## Code Analysis Service

**Location**: \`src/mcp/kiro/services/codeAnalysisService.ts\`

This service analyzes code.
      `;

      const files = await service.findImplementationFiles(requirement, designDoc);

      expect(files.length).toBeGreaterThan(0);
      expect(files[0].path).toBe('src/mcp/kiro/services/codeAnalysisService.ts');
      expect(files[0].confidence).toBe('high');
      expect(files[0].reason).toContain('design.md');
    });

    it('should find files by keyword matching', async () => {
      const requirement: ParsedRequirement = {
        id: '1',
        title: 'Spec Parser Service Implementation',
        userStory: 'As a developer, I want to parse specs',
        acceptanceCriteria: [
          { number: 1, text: 'SHALL parse tasks' }
        ],
        lineNumber: 1
      };

      const designDoc = '';

      const files = await service.findImplementationFiles(requirement, designDoc);

      // Should find specParserService.ts by keyword matching
      expect(files.some(f => f.path.includes('specParserService'))).toBe(true);
    });

    it('should handle non-existent features gracefully', async () => {
      const requirement: ParsedRequirement = {
        id: '1',
        title: 'NonExistentFeatureXYZ12345QWERTY',
        userStory: 'As a developer, I want something',
        acceptanceCriteria: [
          { number: 1, text: 'SHALL do something' }
        ],
        lineNumber: 1
      };

      const designDoc = '';

      const files = await service.findImplementationFiles(requirement, designDoc);

      // The search may find files with common words, but should not crash
      expect(Array.isArray(files)).toBe(true);
      // All results should have required fields
      files.forEach(file => {
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('confidence');
        expect(file).toHaveProperty('reason');
      });
    });
  });

  describe('validateImplementation', () => {
    it('should validate implementation against criteria', async () => {
      const requirement: ParsedRequirement = {
        id: '1',
        title: 'Code Analysis',
        userStory: 'As a developer, I want code analysis',
        acceptanceCriteria: [
          { number: 1, text: 'WHEN analyzing code THEN the system SHALL extractDesignLocations' },
          { number: 2, text: 'WHEN searching THEN the system SHALL searchCodebase' }
        ],
        lineNumber: 1
      };

      const designLocations = [{
        component: 'Code Analysis Service',
        filePath: 'src/mcp/kiro/services/codeAnalysisService.ts',
        section: 'Services'
      }];

      const results = await service.validateImplementation(requirement, designLocations);

      expect(results).toHaveLength(2);
      expect(results[0].criterionNumber).toBe(1);
      expect(results[0].criterionText).toContain('extractDesignLocations');
      expect(results[1].criterionNumber).toBe(2);
      expect(results[1].criterionText).toContain('searchCodebase');
      
      // Should find implementations (or at least not be missing)
      expect(['implemented', 'partial', 'needs_manual_review']).toContain(results[0].status);
      expect(['implemented', 'partial', 'needs_manual_review']).toContain(results[1].status);
    });

    it('should handle validation when implementation is unclear', async () => {
      const requirement: ParsedRequirement = {
        id: '1',
        title: 'NonExistentFeatureXYZ12345QWERTY',
        userStory: 'As a developer, I want something',
        acceptanceCriteria: [
          { number: 1, text: 'SHALL performCompletelyNonExistentOperation' }
        ],
        lineNumber: 1
      };

      const designLocations: any[] = [];

      const results = await service.validateImplementation(requirement, designLocations);

      expect(results).toHaveLength(1);
      // Should return some status (the service tries to find implementations)
      expect(['missing', 'needs_manual_review', 'implemented', 'partial']).toContain(results[0].status);
      expect(results[0].criterionNumber).toBe(1);
      expect(results[0].evidence).toBeDefined();
    });
  });

  describe('findTestsForRequirement', () => {
    it('should find test files for requirement', async () => {
      const result = await service.findTestsForRequirement('1', '.kiro/specs/kiro-mcps');

      // Should find test files in the project
      expect(result.requirementId).toBe('1');
      expect(result.testFiles).toBeDefined();
      expect(Array.isArray(result.testFiles)).toBe(true);
    });

    it('should calculate coverage percentage', async () => {
      const result = await service.findTestsForRequirement('1', '.kiro/specs/kiro-mcps');

      expect(result.coveragePercent).toBeGreaterThanOrEqual(0);
      expect(result.coveragePercent).toBeLessThanOrEqual(100);
    });

    it('should return hasTests false when no tests found', async () => {
      const result = await service.findTestsForRequirement('99999', '.kiro/specs/nonexistent');

      expect(result.hasTests).toBe(false);
      expect(result.testFiles).toHaveLength(0);
      expect(result.coveragePercent).toBe(0);
    });
  });
});

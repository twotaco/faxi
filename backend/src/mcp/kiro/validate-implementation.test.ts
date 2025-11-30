/**
 * Tests for validate_implementation tool
 * 
 * This tests the CODE REVIEW functionality - validating that actual code
 * implements the requirements from the spec.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { specParserService } from './services/specParserService.js';
import { codeAnalysisService } from './services/codeAnalysisService.js';

describe('validate_implementation tool', () => {
  const testSpecPath = path.resolve('../.kiro/specs/kiro-mcps');

  beforeAll(() => {
    // Verify test spec exists
    if (!fs.existsSync(testSpecPath)) {
      throw new Error(`Test spec not found at ${testSpecPath}`);
    }
  });

  describe('basic validation', () => {
    it('should validate implementation for a spec', async () => {
      // Read requirements
      const requirementsPath = path.join(testSpecPath, 'requirements.md');
      const requirementsContent = fs.readFileSync(requirementsPath, 'utf-8');
      const requirements = specParserService.parseRequirements(requirementsContent);

      expect(requirements.length).toBeGreaterThan(0);

      // Read design
      const designPath = path.join(testSpecPath, 'design.md');
      const designContent = fs.readFileSync(designPath, 'utf-8');
      const designLocations = codeAnalysisService.extractDesignLocations(designContent);

      // Validate first requirement
      const requirement = requirements[0];
      const results = await codeAnalysisService.validateImplementation(
        requirement,
        designLocations
      );

      // Should return results for each acceptance criterion
      expect(results.length).toBe(requirement.acceptanceCriteria.length);

      // Each result should have required fields
      for (const result of results) {
        expect(result).toHaveProperty('criterionNumber');
        expect(result).toHaveProperty('criterionText');
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('evidence');
        expect(['implemented', 'missing', 'partial', 'needs_manual_review']).toContain(result.status);
      }
    });

    it('should extract design locations from design.md', () => {
      const designPath = path.join(testSpecPath, 'design.md');
      const designContent = fs.readFileSync(designPath, 'utf-8');
      const locations = codeAnalysisService.extractDesignLocations(designContent);

      // Should find at least some locations
      expect(locations.length).toBeGreaterThan(0);

      // Each location should have required fields
      for (const location of locations) {
        expect(location).toHaveProperty('component');
        expect(location).toHaveProperty('filePath');
        expect(location).toHaveProperty('section');
        expect(location.filePath).toMatch(/\.ts$/);
      }
    });

    it('should find implementation files for a requirement', async () => {
      // Read requirements
      const requirementsPath = path.join(testSpecPath, 'requirements.md');
      const requirementsContent = fs.readFileSync(requirementsPath, 'utf-8');
      const requirements = specParserService.parseRequirements(requirementsContent);

      // Read design
      const designPath = path.join(testSpecPath, 'design.md');
      const designContent = fs.readFileSync(designPath, 'utf-8');

      // Find implementation files for first requirement
      const requirement = requirements[0];
      const files = await codeAnalysisService.findImplementationFiles(
        requirement,
        designContent
      );

      // Should find at least some files
      expect(files.length).toBeGreaterThan(0);

      // Each file should have required fields
      for (const file of files) {
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('confidence');
        expect(file).toHaveProperty('reason');
        expect(['high', 'medium', 'low']).toContain(file.confidence);
      }
    });
  });

  describe('validation results structure', () => {
    it('should return complete validation report', async () => {
      // Read requirements
      const requirementsPath = path.join(testSpecPath, 'requirements.md');
      const requirementsContent = fs.readFileSync(requirementsPath, 'utf-8');
      const requirements = specParserService.parseRequirements(requirementsContent);

      // Read design
      const designPath = path.join(testSpecPath, 'design.md');
      const designContent = fs.readFileSync(designPath, 'utf-8');
      const designLocations = codeAnalysisService.extractDesignLocations(designContent);

      // Validate all requirements
      const allResults = [];
      for (const requirement of requirements.slice(0, 3)) { // Test first 3 requirements
        const results = await codeAnalysisService.validateImplementation(
          requirement,
          designLocations
        );
        allResults.push({
          requirement_id: requirement.id,
          requirement_title: requirement.title,
          criteria_results: results,
        });
      }

      // Calculate summary
      let totalCriteria = 0;
      let implemented = 0;
      let missing = 0;
      let partial = 0;
      let needsReview = 0;

      for (const reqResult of allResults) {
        for (const cr of reqResult.criteria_results) {
          totalCriteria++;
          switch (cr.status) {
            case 'implemented':
              implemented++;
              break;
            case 'missing':
              missing++;
              break;
            case 'partial':
              partial++;
              break;
            case 'needs_manual_review':
              needsReview++;
              break;
          }
        }
      }

      const coveragePercent = totalCriteria > 0
        ? Math.round((implemented / totalCriteria) * 100)
        : 0;

      // Verify summary structure
      expect(totalCriteria).toBeGreaterThan(0);
      expect(implemented + missing + partial + needsReview).toBe(totalCriteria);
      expect(coveragePercent).toBeGreaterThanOrEqual(0);
      expect(coveragePercent).toBeLessThanOrEqual(100);
    });

    it('should provide evidence for each criterion', async () => {
      // Read requirements
      const requirementsPath = path.join(testSpecPath, 'requirements.md');
      const requirementsContent = fs.readFileSync(requirementsPath, 'utf-8');
      const requirements = specParserService.parseRequirements(requirementsContent);

      // Read design
      const designPath = path.join(testSpecPath, 'design.md');
      const designContent = fs.readFileSync(designPath, 'utf-8');
      const designLocations = codeAnalysisService.extractDesignLocations(designContent);

      // Validate first requirement
      const requirement = requirements[0];
      const results = await codeAnalysisService.validateImplementation(
        requirement,
        designLocations
      );

      // Each result should have evidence
      for (const result of results) {
        expect(result.evidence).toBeDefined();
        expect(result.evidence.reason).toBeDefined();
        expect(typeof result.evidence.reason).toBe('string');
        expect(result.evidence.reason.length).toBeGreaterThan(0);

        // If status is missing, should have suggested fix
        if (result.status === 'missing') {
          expect(result.suggestedFix).toBeDefined();
          expect(typeof result.suggestedFix).toBe('string');
        }
      }
    });
  });

  describe('scope filtering', () => {
    it('should validate specific requirement when scope.requirement_id provided', async () => {
      // Read requirements
      const requirementsPath = path.join(testSpecPath, 'requirements.md');
      const requirementsContent = fs.readFileSync(requirementsPath, 'utf-8');
      const requirements = specParserService.parseRequirements(requirementsContent);

      // Read design
      const designPath = path.join(testSpecPath, 'design.md');
      const designContent = fs.readFileSync(designPath, 'utf-8');
      const designLocations = codeAnalysisService.extractDesignLocations(designContent);

      // Pick a specific requirement
      const targetRequirement = requirements[1]; // Second requirement
      
      // Validate only that requirement
      const results = await codeAnalysisService.validateImplementation(
        targetRequirement,
        designLocations
      );

      // Should only return results for that requirement's criteria
      expect(results.length).toBe(targetRequirement.acceptanceCriteria.length);
    });
  });

  describe('error handling', () => {
    it('should handle missing design.md gracefully', async () => {
      // Read requirements
      const requirementsPath = path.join(testSpecPath, 'requirements.md');
      const requirementsContent = fs.readFileSync(requirementsPath, 'utf-8');
      const requirements = specParserService.parseRequirements(requirementsContent);

      // Validate without design locations
      const requirement = requirements[0];
      const results = await codeAnalysisService.validateImplementation(
        requirement,
        [] // No design locations
      );

      // Should still return results, but likely marked as needs_manual_review or missing
      expect(results.length).toBe(requirement.acceptanceCriteria.length);
      
      // Most should be missing or needs review since we have no design guidance
      const missingOrReview = results.filter(r => 
        r.status === 'missing' || r.status === 'needs_manual_review'
      );
      expect(missingOrReview.length).toBeGreaterThan(0);
    });

    it('should handle requirement with no acceptance criteria', async () => {
      const emptyRequirement = {
        id: 'TEST',
        title: 'Test Requirement',
        userStory: 'As a test...',
        acceptanceCriteria: [],
        lineNumber: 1,
      };

      const results = await codeAnalysisService.validateImplementation(
        emptyRequirement,
        []
      );

      // Should return empty array
      expect(results).toEqual([]);
    });
  });

  describe('Property 5: Implementation Validation Completeness', () => {
    /**
     * Feature: kiro-mcps, Property 5: Implementation Validation Completeness
     * Validates: Requirements 10.4, 10.5
     * 
     * For any requirement with acceptance criteria, validate_implementation
     * SHALL return a validation result for each criterion.
     */
    it('property: validation covers all criteria', async () => {
      // Read requirements
      const requirementsPath = path.join(testSpecPath, 'requirements.md');
      const requirementsContent = fs.readFileSync(requirementsPath, 'utf-8');
      const requirements = specParserService.parseRequirements(requirementsContent);

      // Read design
      const designPath = path.join(testSpecPath, 'design.md');
      const designContent = fs.readFileSync(designPath, 'utf-8');
      const designLocations = codeAnalysisService.extractDesignLocations(designContent);

      // Test each requirement
      for (const requirement of requirements.slice(0, 5)) { // Test first 5
        const results = await codeAnalysisService.validateImplementation(
          requirement,
          designLocations
        );

        // Should have one result per criterion
        expect(results.length).toBe(requirement.acceptanceCriteria.length);

        // Each result should correspond to a criterion
        for (let i = 0; i < results.length; i++) {
          expect(results[i].criterionNumber).toBe(requirement.acceptanceCriteria[i].number);
          expect(results[i].criterionText).toBe(requirement.acceptanceCriteria[i].text);
        }
      }
    });
  });

  describe('Property 6: Validation Report Structure', () => {
    /**
     * Feature: kiro-mcps, Property 6: Validation Report Structure
     * Validates: Requirements 10.8
     * 
     * For any validation with missing implementations, the report SHALL include
     * file path, criterion text, and suggested fix.
     */
    it('property: missing implementations have complete reports', async () => {
      // Read requirements
      const requirementsPath = path.join(testSpecPath, 'requirements.md');
      const requirementsContent = fs.readFileSync(requirementsPath, 'utf-8');
      const requirements = specParserService.parseRequirements(requirementsContent);

      // Read design
      const designPath = path.join(testSpecPath, 'design.md');
      const designContent = fs.readFileSync(designPath, 'utf-8');
      const designLocations = codeAnalysisService.extractDesignLocations(designContent);

      // Validate all requirements
      for (const requirement of requirements.slice(0, 5)) {
        const results = await codeAnalysisService.validateImplementation(
          requirement,
          designLocations
        );

        // Check each missing result
        const missingResults = results.filter(r => r.status === 'missing');
        
        for (const result of missingResults) {
          // Must have criterion text
          expect(result.criterionText).toBeDefined();
          expect(result.criterionText.length).toBeGreaterThan(0);

          // Must have evidence with reason
          expect(result.evidence).toBeDefined();
          expect(result.evidence.reason).toBeDefined();
          expect(result.evidence.reason.length).toBeGreaterThan(0);

          // Must have suggested fix
          expect(result.suggestedFix).toBeDefined();
          expect(result.suggestedFix.length).toBeGreaterThan(0);
        }
      }
    });
  });
});

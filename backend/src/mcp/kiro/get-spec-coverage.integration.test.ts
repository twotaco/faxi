/**
 * Integration test for get_spec_coverage MCP tool
 * Tests the actual MCP server implementation
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';

describe('get_spec_coverage MCP tool - Integration', () => {
  it('should work with actual .kiro/specs directory', async () => {
    // Import the spec parser service
    const { specParserService } = await import('./services/specParserService.js');

    // Get coverage for the actual project specs (go up from backend/)
    const specsDir = path.resolve('..', '.kiro/specs');
    const result = specParserService.getSpecCoverage(specsDir);

    // Verify structure
    expect(result).toHaveProperty('specs');
    expect(result).toHaveProperty('overall_percentage');
    expect(Array.isArray(result.specs)).toBe(true);
    expect(typeof result.overall_percentage).toBe('number');

    // Verify each spec has required properties
    for (const spec of result.specs) {
      expect(spec).toHaveProperty('name');
      expect(spec).toHaveProperty('path');
      expect(spec).toHaveProperty('total_tasks');
      expect(spec).toHaveProperty('completed_tasks');
      expect(spec).toHaveProperty('percentage');
      expect(spec).toHaveProperty('has_tasks');

      // Verify types
      expect(typeof spec.name).toBe('string');
      expect(typeof spec.path).toBe('string');
      expect(typeof spec.total_tasks).toBe('number');
      expect(typeof spec.completed_tasks).toBe('number');
      expect(typeof spec.percentage).toBe('number');
      expect(typeof spec.has_tasks).toBe('boolean');

      // Verify constraints
      expect(spec.total_tasks).toBeGreaterThanOrEqual(0);
      expect(spec.completed_tasks).toBeGreaterThanOrEqual(0);
      expect(spec.completed_tasks).toBeLessThanOrEqual(spec.total_tasks);
      expect(spec.percentage).toBeGreaterThanOrEqual(0);
      expect(spec.percentage).toBeLessThanOrEqual(100);
    }

    // Verify overall percentage is within bounds
    expect(result.overall_percentage).toBeGreaterThanOrEqual(0);
    expect(result.overall_percentage).toBeLessThanOrEqual(100);

    // Log results for manual verification
    console.log('\n=== Spec Coverage Report ===');
    console.log(`Total specs: ${result.specs.length}`);
    console.log(`Overall completion: ${result.overall_percentage}%\n`);
    
    for (const spec of result.specs) {
      console.log(`${spec.name}:`);
      console.log(`  Tasks: ${spec.completed_tasks}/${spec.total_tasks} (${spec.percentage}%)`);
      console.log(`  Has tasks.md: ${spec.has_tasks}`);
    }
    console.log('===========================\n');
  });

  it('should find the kiro-mcps spec', async () => {
    const { specParserService } = await import('./services/specParserService.js');
    
    const specsDir = path.resolve('..', '.kiro/specs');
    const result = specParserService.getSpecCoverage(specsDir);

    // Should find the kiro-mcps spec
    const kiroMcpsSpec = result.specs.find(s => s.name === 'kiro-mcps');
    expect(kiroMcpsSpec).toBeDefined();
    expect(kiroMcpsSpec?.has_tasks).toBe(true);
    expect(kiroMcpsSpec?.total_tasks).toBeGreaterThan(0);
  });

  it('should calculate correct percentage for kiro-mcps spec', async () => {
    const { specParserService } = await import('./services/specParserService.js');
    
    const specsDir = path.resolve('..', '.kiro/specs');
    const result = specParserService.getSpecCoverage(specsDir);

    const kiroMcpsSpec = result.specs.find(s => s.name === 'kiro-mcps');
    
    if (kiroMcpsSpec && kiroMcpsSpec.total_tasks > 0) {
      // Verify percentage calculation
      const expectedPercentage = Math.round(
        (kiroMcpsSpec.completed_tasks / kiroMcpsSpec.total_tasks) * 100
      );
      expect(kiroMcpsSpec.percentage).toBe(expectedPercentage);
    }
  });
});

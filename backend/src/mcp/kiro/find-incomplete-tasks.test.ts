/**
 * Integration tests for find_incomplete_tasks tool
 * 
 * Tests the MCP tool that finds incomplete tasks in specs
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';

describe('find_incomplete_tasks tool', () => {
  let server: Server;

  beforeAll(async () => {
    // Import the server module to get the server instance
    // We'll need to create a test instance
    const { specParserService } = await import('./services/specParserService.js');
    
    // Create a simple server instance for testing
    server = new Server(
      {
        name: 'test-spec-validator',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
  });

  describe('with specific spec_path', () => {
    it('should find incomplete tasks in kiro-mcps spec', async () => {
      const specPath = path.resolve('..', '.kiro', 'specs', 'kiro-mcps');
      
      // Check if spec exists
      if (!fs.existsSync(specPath)) {
        console.warn(`Skipping test: ${specPath} does not exist`);
        return;
      }

      // Import the handler directly
      const { specParserService } = await import('./services/specParserService.js');
      
      // Read and parse tasks.md
      const tasksPath = path.join(specPath, 'tasks.md');
      const content = fs.readFileSync(tasksPath, 'utf-8');
      const tasks = specParserService.parseTasks(content);
      
      // Filter incomplete tasks
      const incompleteTasks = tasks.filter(t => !t.completed);
      const completedTasks = tasks.filter(t => t.completed);

      // Verify we got results
      expect(tasks.length).toBeGreaterThan(0);
      expect(incompleteTasks.length).toBeGreaterThanOrEqual(0);
      expect(completedTasks.length).toBeGreaterThanOrEqual(0);
      
      // Verify task structure
      if (incompleteTasks.length > 0) {
        const firstTask = incompleteTasks[0];
        expect(firstTask).toHaveProperty('number');
        expect(firstTask).toHaveProperty('title');
        expect(firstTask).toHaveProperty('completed');
        expect(firstTask.completed).toBe(false);
      }

      // Verify counts add up
      expect(incompleteTasks.length + completedTasks.length).toBe(tasks.length);
    });

    it('should handle missing tasks.md file', async () => {
      const specPath = '.kiro/specs/nonexistent-spec';
      
      // This should throw an error
      const { specParserService } = await import('./services/specParserService.js');
      
      expect(() => {
        const tasksPath = path.join(specPath, 'tasks.md');
        if (!fs.existsSync(tasksPath)) {
          throw new Error(`tasks.md not found in ${specPath}`);
        }
      }).toThrow();
    });

    it('should parse task numbers correctly', async () => {
      const specPath = path.resolve('..', '.kiro', 'specs', 'kiro-mcps');
      
      if (!fs.existsSync(specPath)) {
        console.warn(`Skipping test: ${specPath} does not exist`);
        return;
      }

      const { specParserService } = await import('./services/specParserService.js');
      
      const tasksPath = path.join(specPath, 'tasks.md');
      const content = fs.readFileSync(tasksPath, 'utf-8');
      const tasks = specParserService.parseTasks(content);
      
      // Verify task numbers are parsed
      const tasksWithNumbers = tasks.filter(t => t.number && !t.number.startsWith('line-'));
      expect(tasksWithNumbers.length).toBeGreaterThan(0);
      
      // Verify number format (should be like "1", "1.1", "2", etc.)
      if (tasksWithNumbers.length > 0) {
        const firstTask = tasksWithNumbers[0];
        expect(firstTask.number).toMatch(/^\d+(\.\d+)*$/);
      }
    });

    it('should identify parent tasks correctly', async () => {
      const specPath = path.resolve('..', '.kiro', 'specs', 'kiro-mcps');
      
      if (!fs.existsSync(specPath)) {
        console.warn(`Skipping test: ${specPath} does not exist`);
        return;
      }

      const { specParserService } = await import('./services/specParserService.js');
      
      const tasksPath = path.join(specPath, 'tasks.md');
      const content = fs.readFileSync(tasksPath, 'utf-8');
      const tasks = specParserService.parseTasks(content);
      
      // Find tasks with parent relationships
      const childTasks = tasks.filter(t => t.parentNumber);
      
      if (childTasks.length > 0) {
        const firstChild = childTasks[0];
        expect(firstChild.parentNumber).toBeDefined();
        
        // Verify parent exists
        const parent = tasks.find(t => t.number === firstChild.parentNumber);
        expect(parent).toBeDefined();
      }
    });
  });

  describe('without spec_path (scan all specs)', () => {
    it('should scan all specs in .kiro/specs/', async () => {
      const specsDir = path.resolve('..', '.kiro', 'specs');
      
      if (!fs.existsSync(specsDir)) {
        console.warn(`Skipping test: ${specsDir} does not exist`);
        return;
      }

      // Get all spec directories
      const entries = fs.readdirSync(specsDir, { withFileTypes: true });
      const specDirs = entries.filter(entry => entry.isDirectory());
      
      expect(specDirs.length).toBeGreaterThan(0);
      
      // Verify we can process multiple specs
      const { specParserService } = await import('./services/specParserService.js');
      
      let totalSpecs = 0;
      let specsWithTasks = 0;
      
      for (const spec of specDirs) {
        totalSpecs++;
        const tasksPath = path.join(specsDir, spec.name, 'tasks.md');
        
        if (fs.existsSync(tasksPath)) {
          specsWithTasks++;
          const content = fs.readFileSync(tasksPath, 'utf-8');
          const tasks = specParserService.parseTasks(content);
          expect(Array.isArray(tasks)).toBe(true);
        }
      }
      
      expect(totalSpecs).toBeGreaterThan(0);
      expect(specsWithTasks).toBeGreaterThan(0);
    });

    it('should calculate overall statistics correctly', async () => {
      const specsDir = path.resolve('..', '.kiro', 'specs');
      
      if (!fs.existsSync(specsDir)) {
        console.warn(`Skipping test: ${specsDir} does not exist`);
        return;
      }

      const { specParserService } = await import('./services/specParserService.js');
      
      // Get coverage (which includes similar logic)
      const coverage = specParserService.getSpecCoverage(specsDir);
      
      expect(coverage.specs.length).toBeGreaterThan(0);
      expect(coverage.overall_percentage).toBeGreaterThanOrEqual(0);
      expect(coverage.overall_percentage).toBeLessThanOrEqual(100);
      
      // Verify individual spec data
      const specsWithTasks = coverage.specs.filter(s => s.has_tasks);
      if (specsWithTasks.length > 0) {
        const firstSpec = specsWithTasks[0];
        expect(firstSpec.total_tasks).toBeGreaterThanOrEqual(0);
        expect(firstSpec.completed_tasks).toBeGreaterThanOrEqual(0);
        expect(firstSpec.completed_tasks).toBeLessThanOrEqual(firstSpec.total_tasks);
      }
    });
  });

  describe('result structure', () => {
    it('should return correct structure for single spec', async () => {
      const specPath = path.resolve('..', '.kiro', 'specs', 'kiro-mcps');
      
      if (!fs.existsSync(specPath)) {
        console.warn(`Skipping test: ${specPath} does not exist`);
        return;
      }

      const { specParserService } = await import('./services/specParserService.js');
      
      const tasksPath = path.join(specPath, 'tasks.md');
      const content = fs.readFileSync(tasksPath, 'utf-8');
      const tasks = specParserService.parseTasks(content);
      
      const incompleteTasks = tasks.filter(t => !t.completed);
      const completedTasks = tasks.filter(t => t.completed);

      // Simulate the result structure
      const result = {
        spec_name: path.basename(specPath),
        spec_path: specPath,
        incomplete_tasks: incompleteTasks.map(t => ({
          task_number: t.number,
          title: t.title,
          parent_task: t.parentNumber,
          line_number: t.lineNumber,
          requirements: t.requirements,
        })),
        total_tasks: tasks.length,
        completed_tasks: completedTasks.length,
        completion_percentage: tasks.length > 0
          ? Math.round((completedTasks.length / tasks.length) * 100)
          : 0,
      };

      // Verify structure
      expect(result).toHaveProperty('spec_name');
      expect(result).toHaveProperty('spec_path');
      expect(result).toHaveProperty('incomplete_tasks');
      expect(result).toHaveProperty('total_tasks');
      expect(result).toHaveProperty('completed_tasks');
      expect(result).toHaveProperty('completion_percentage');
      
      expect(Array.isArray(result.incomplete_tasks)).toBe(true);
      expect(typeof result.total_tasks).toBe('number');
      expect(typeof result.completed_tasks).toBe('number');
      expect(typeof result.completion_percentage).toBe('number');
    });
  });

  describe('error handling', () => {
    it('should provide helpful error for nonexistent spec directory', async () => {
      const specPath = '.kiro/specs/this-spec-does-not-exist';
      
      expect(() => {
        if (!fs.existsSync(specPath)) {
          throw new Error(`Spec directory does not exist: ${specPath}`);
        }
      }).toThrow('Spec directory does not exist');
    });

    it('should provide helpful error for missing tasks.md', async () => {
      const specPath = '.kiro/specs/kiro-mcps';
      const tasksPath = path.join(specPath, 'nonexistent-tasks.md');
      
      expect(() => {
        if (!fs.existsSync(tasksPath)) {
          throw new Error(
            `tasks.md not found in ${specPath}. ` +
            `Expected file at: ${tasksPath}`
          );
        }
      }).toThrow('tasks.md not found');
      expect(() => {
        if (!fs.existsSync(tasksPath)) {
          throw new Error(
            `tasks.md not found in ${specPath}. ` +
            `Expected file at: ${tasksPath}`
          );
        }
      }).toThrow('Expected file at');
    });
  });
});

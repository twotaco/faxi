/**
 * Tests for Spec Parser Service - get_spec_coverage functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SpecParserService } from './specParserService.js';

describe('SpecParserService - getSpecCoverage', () => {
  let tempDir: string;
  let specsDir: string;
  let specParserService: SpecParserService;

  beforeEach(() => {
    // Create a temporary directory for test specs
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-coverage-test-'));
    specsDir = path.join(tempDir, '.kiro', 'specs');
    fs.mkdirSync(specsDir, { recursive: true });
    specParserService = new SpecParserService();
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('parseTasks', () => {
    it('should parse simple incomplete tasks', () => {
      const content = `# Tasks

- [ ] 1. First task
- [ ] 2. Second task
- [ ] 3. Third task
`;

      const tasks = specParserService.parseTasks(content);

      expect(tasks).toHaveLength(3);
      expect(tasks[0]).toMatchObject({
        number: '1',
        title: 'First task',
        completed: false,
      });
      expect(tasks[1]).toMatchObject({
        number: '2',
        title: 'Second task',
        completed: false,
      });
    });

    it('should parse completed tasks', () => {
      const content = `# Tasks

- [x] 1. Completed task
- [ ] 2. Incomplete task
- [x] 3. Another completed task
`;

      const tasks = specParserService.parseTasks(content);

      expect(tasks).toHaveLength(3);
      expect(tasks[0].completed).toBe(true);
      expect(tasks[1].completed).toBe(false);
      expect(tasks[2].completed).toBe(true);
    });

    it('should parse nested tasks with parent relationships', () => {
      const content = `# Tasks

- [ ] 1. Parent task
  - [ ] 1.1 Child task
  - [x] 1.2 Completed child
- [ ] 2. Another parent
  - [ ] 2.1 Child
`;

      const tasks = specParserService.parseTasks(content);

      expect(tasks).toHaveLength(5);
      
      // Parent task should have no parent
      expect(tasks[0].number).toBe('1');
      expect(tasks[0].parentNumber).toBeUndefined();
      
      // Child tasks should have parent
      expect(tasks[1].number).toBe('1.1');
      expect(tasks[1].parentNumber).toBe('1');
      
      expect(tasks[2].number).toBe('1.2');
      expect(tasks[2].parentNumber).toBe('1');
      expect(tasks[2].completed).toBe(true);
    });

    it('should handle tasks without explicit numbers', () => {
      const content = `# Tasks

- [ ] Task without number
- [x] Another task
`;

      const tasks = specParserService.parseTasks(content);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe('Task without number');
      expect(tasks[1].title).toBe('Another task');
    });

    it('should extract requirement references', () => {
      const content = `# Tasks

- [ ] 1. Implement feature - Requirements: 1.1, 1.2
- [ ] 2. Write tests - _Requirements: 2.1_
`;

      const tasks = specParserService.parseTasks(content);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].requirements).toEqual(['1.1', '1.2']);
      expect(tasks[1].requirements).toEqual(['2.1']);
    });

    it('should handle mixed indentation levels', () => {
      const content = `# Tasks

- [ ] 1. Level 0
  - [ ] 1.1 Level 1
    - [ ] 1.1.1 Level 2
  - [ ] 1.2 Back to level 1
- [ ] 2. Back to level 0
`;

      const tasks = specParserService.parseTasks(content);

      expect(tasks).toHaveLength(5);
      expect(tasks[0].parentNumber).toBeUndefined();
      expect(tasks[1].parentNumber).toBe('1');
      expect(tasks[2].parentNumber).toBe('1.1');
      expect(tasks[3].parentNumber).toBe('1');
      expect(tasks[4].parentNumber).toBeUndefined();
    });
  });

  describe('getSpecCoverage', () => {
    it('should throw error if specs directory does not exist', () => {
      const nonExistentPath = path.join(tempDir, 'non-existent');
      
      expect(() => {
        specParserService.getSpecCoverage(nonExistentPath);
      }).toThrow('does not exist');
    });

    it('should return empty coverage for empty specs directory', () => {
      const result = specParserService.getSpecCoverage(specsDir);

      expect(result.specs).toHaveLength(0);
      expect(result.overall_percentage).toBe(0);
    });

    it('should calculate coverage for single spec', () => {
      // Create a spec with tasks
      const specDir = path.join(specsDir, 'test-spec');
      fs.mkdirSync(specDir);
      fs.writeFileSync(
        path.join(specDir, 'tasks.md'),
        `# Tasks

- [x] 1. Completed task
- [ ] 2. Incomplete task
- [x] 3. Another completed
- [ ] 4. Another incomplete
`
      );

      const result = specParserService.getSpecCoverage(specsDir);

      expect(result.specs).toHaveLength(1);
      expect(result.specs[0]).toMatchObject({
        name: 'test-spec',
        total_tasks: 4,
        completed_tasks: 2,
        percentage: 50,
        has_tasks: true,
      });
      expect(result.overall_percentage).toBe(50);
    });

    it('should handle spec without tasks.md', () => {
      // Create a spec without tasks.md
      const specDir = path.join(specsDir, 'no-tasks-spec');
      fs.mkdirSync(specDir);

      const result = specParserService.getSpecCoverage(specsDir);

      expect(result.specs).toHaveLength(1);
      expect(result.specs[0]).toMatchObject({
        name: 'no-tasks-spec',
        total_tasks: 0,
        completed_tasks: 0,
        percentage: 0,
        has_tasks: false,
      });
      expect(result.overall_percentage).toBe(0);
    });

    it('should calculate coverage across multiple specs', () => {
      // Create spec 1: 75% complete (3/4)
      const spec1Dir = path.join(specsDir, 'spec-1');
      fs.mkdirSync(spec1Dir);
      fs.writeFileSync(
        path.join(spec1Dir, 'tasks.md'),
        `# Tasks
- [x] 1. Task 1
- [x] 2. Task 2
- [x] 3. Task 3
- [ ] 4. Task 4
`
      );

      // Create spec 2: 50% complete (2/4)
      const spec2Dir = path.join(specsDir, 'spec-2');
      fs.mkdirSync(spec2Dir);
      fs.writeFileSync(
        path.join(spec2Dir, 'tasks.md'),
        `# Tasks
- [x] 1. Task 1
- [ ] 2. Task 2
- [x] 3. Task 3
- [ ] 4. Task 4
`
      );

      // Create spec 3: no tasks
      const spec3Dir = path.join(specsDir, 'spec-3');
      fs.mkdirSync(spec3Dir);

      const result = specParserService.getSpecCoverage(specsDir);

      expect(result.specs).toHaveLength(3);
      
      // Spec 1: 75%
      const spec1 = result.specs.find(s => s.name === 'spec-1');
      expect(spec1).toMatchObject({
        total_tasks: 4,
        completed_tasks: 3,
        percentage: 75,
        has_tasks: true,
      });

      // Spec 2: 50%
      const spec2 = result.specs.find(s => s.name === 'spec-2');
      expect(spec2).toMatchObject({
        total_tasks: 4,
        completed_tasks: 2,
        percentage: 50,
        has_tasks: true,
      });

      // Spec 3: no tasks
      const spec3 = result.specs.find(s => s.name === 'spec-3');
      expect(spec3).toMatchObject({
        total_tasks: 0,
        completed_tasks: 0,
        percentage: 0,
        has_tasks: false,
      });

      // Overall: (3+2)/(4+4) = 5/8 = 62.5% -> 63% (rounded)
      expect(result.overall_percentage).toBe(63);
    });

    it('should handle 100% completion', () => {
      const specDir = path.join(specsDir, 'complete-spec');
      fs.mkdirSync(specDir);
      fs.writeFileSync(
        path.join(specDir, 'tasks.md'),
        `# Tasks
- [x] 1. Task 1
- [x] 2. Task 2
- [x] 3. Task 3
`
      );

      const result = specParserService.getSpecCoverage(specsDir);

      expect(result.specs[0]).toMatchObject({
        total_tasks: 3,
        completed_tasks: 3,
        percentage: 100,
      });
      expect(result.overall_percentage).toBe(100);
    });

    it('should handle 0% completion', () => {
      const specDir = path.join(specsDir, 'incomplete-spec');
      fs.mkdirSync(specDir);
      fs.writeFileSync(
        path.join(specDir, 'tasks.md'),
        `# Tasks
- [ ] 1. Task 1
- [ ] 2. Task 2
- [ ] 3. Task 3
`
      );

      const result = specParserService.getSpecCoverage(specsDir);

      expect(result.specs[0]).toMatchObject({
        total_tasks: 3,
        completed_tasks: 0,
        percentage: 0,
      });
      expect(result.overall_percentage).toBe(0);
    });

    it('should handle malformed tasks.md gracefully', () => {
      const specDir = path.join(specsDir, 'malformed-spec');
      fs.mkdirSync(specDir);
      fs.writeFileSync(
        path.join(specDir, 'tasks.md'),
        `# Tasks
This is not a valid task format
`
      );

      const result = specParserService.getSpecCoverage(specsDir);

      expect(result.specs).toHaveLength(1);
      expect(result.specs[0]).toMatchObject({
        name: 'malformed-spec',
        total_tasks: 0,
        completed_tasks: 0,
        percentage: 0,
        has_tasks: true, // File exists, just has no valid tasks
      });
    });

    it('should count nested tasks correctly', () => {
      const specDir = path.join(specsDir, 'nested-spec');
      fs.mkdirSync(specDir);
      fs.writeFileSync(
        path.join(specDir, 'tasks.md'),
        `# Tasks
- [x] 1. Parent task
  - [x] 1.1 Child task
  - [ ] 1.2 Another child
- [ ] 2. Another parent
  - [x] 2.1 Child
`
      );

      const result = specParserService.getSpecCoverage(specsDir);

      // Should count all tasks including nested ones
      expect(result.specs[0]).toMatchObject({
        total_tasks: 5,
        completed_tasks: 3,
        percentage: 60,
      });
    });
  });
});

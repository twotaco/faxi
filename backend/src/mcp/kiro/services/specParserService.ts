/**
 * Spec Parser Service
 * 
 * Parses .kiro specification files (requirements.md, design.md, tasks.md)
 * and extracts structured data for validation and analysis.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ParsedTask {
  number: string;           // "1", "1.1", "2"
  title: string;            // Task description
  completed: boolean;       // true if [x], false if [ ]
  parentNumber?: string;    // Parent task number if nested
  lineNumber: number;       // Line in tasks.md
  requirements?: string[];  // Referenced requirements
}

export interface ParsedRequirement {
  id: string;               // "1", "NFR1"
  title: string;            // Requirement title
  userStory: string;        // User story text
  acceptanceCriteria: Array<{
    number: number;
    text: string;
  }>;
  lineNumber: number;
}

export interface ValidationIssue {
  file: string;             // "requirements.md", "tasks.md"
  line?: number;
  issue: string;
  severity: 'error' | 'warning';
}

export class SpecParserService {
  /**
   * Parse a tasks.md file and extract task items
   */
  parseTasks(content: string): ParsedTask[] {
    const tasks: ParsedTask[] = [];
    const lines = content.split('\n');
    
    // Pattern for task items: - [ ] or - [x] with optional indentation
    const taskPattern = /^(\s*)-\s*\[([x\s])\]\s*(.+)$/i;
    
    // Track parent tasks by indentation level
    const parentStack: Array<{ number: string; indent: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      const match = line.match(taskPattern);

      if (match) {
        const indent = match[1].length;
        const completed = match[2].toLowerCase() === 'x';
        const fullTitle = match[3].trim();

        // Extract task number and title
        // Format: "1. Task title" or "1.1 Task title" or just "Task title"
        const numberMatch = fullTitle.match(/^(\d+(?:\.\d+)*)[.\s]\s*(.+)$/);
        const number = numberMatch ? numberMatch[1] : `line-${lineNumber}`;
        const title = numberMatch ? numberMatch[2] : fullTitle;

        // Determine parent based on indentation
        let parentNumber: string | undefined;
        
        // Pop parents that are at same or greater indentation
        while (parentStack.length > 0 && parentStack[parentStack.length - 1].indent >= indent) {
          parentStack.pop();
        }

        // If there's a parent in the stack, use it
        if (parentStack.length > 0) {
          parentNumber = parentStack[parentStack.length - 1].number;
        }

        // Add this task to the stack if it might have children
        parentStack.push({ number, indent });

        // Extract requirements references from title
        // Look for patterns like "Requirements: 1.1, 1.2" or "_Requirements: 1.1_"
        const reqPattern = /_?Requirements?:\s*([\d.,\s]+)_?/i;
        const reqMatch = title.match(reqPattern);
        const requirements = reqMatch 
          ? reqMatch[1].split(',').map(r => r.trim()).filter(r => r)
          : undefined;

        tasks.push({
          number,
          title,
          completed,
          parentNumber,
          lineNumber,
          requirements,
        });
      }
    }

    return tasks;
  }

  /**
   * Parse a requirements.md file and extract requirements
   */
  parseRequirements(content: string): ParsedRequirement[] {
    const requirements: ParsedRequirement[] = [];
    const lines = content.split('\n');

    // Pattern for requirement headers: #### Requirement N, ### Requirement N, or ## Requirement N
    const requirementPattern = /^#{2,4}\s+Requirement\s+(\d+|NFR\d+)/i;
    
    // Pattern for user story: **User Story:** text
    const userStoryPattern = /^\*\*User Story:\*\*\s*(.+)$/i;
    
    // Pattern for acceptance criteria section
    const acceptanceCriteriaPattern = /^#{4,5}\s+Acceptance\s+Criteria/i;
    
    // Pattern for acceptance criteria items (numbered list)
    const criteriaItemPattern = /^(\d+)\.\s+(.+)$/;

    let currentRequirement: Partial<ParsedRequirement> | null = null;
    let inAcceptanceCriteria = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Check for requirement header
      const reqMatch = line.match(requirementPattern);
      if (reqMatch) {
        // Save previous requirement if exists
        if (currentRequirement && currentRequirement.id) {
          requirements.push({
            id: currentRequirement.id,
            title: currentRequirement.title || '',
            userStory: currentRequirement.userStory || '',
            acceptanceCriteria: currentRequirement.acceptanceCriteria || [],
            lineNumber: currentRequirement.lineNumber || lineNumber,
          });
        }

        // Start new requirement
        currentRequirement = {
          id: reqMatch[1],
          title: line.replace(requirementPattern, '').trim() || `Requirement ${reqMatch[1]}`,
          userStory: '',
          acceptanceCriteria: [],
          lineNumber,
        };
        inAcceptanceCriteria = false;
        continue;
      }

      // Check for user story
      const userStoryMatch = line.match(userStoryPattern);
      if (userStoryMatch && currentRequirement) {
        currentRequirement.userStory = userStoryMatch[1].trim();
        continue;
      }

      // Check for acceptance criteria section
      if (acceptanceCriteriaPattern.test(line)) {
        inAcceptanceCriteria = true;
        continue;
      }

      // Check for acceptance criteria items
      if (inAcceptanceCriteria && currentRequirement) {
        const criteriaMatch = line.match(criteriaItemPattern);
        if (criteriaMatch) {
          const number = parseInt(criteriaMatch[1], 10);
          const text = criteriaMatch[2].trim();
          
          if (!currentRequirement.acceptanceCriteria) {
            currentRequirement.acceptanceCriteria = [];
          }
          
          currentRequirement.acceptanceCriteria.push({
            number,
            text,
          });
        }
      }

      // Check if we've moved to a new section (another heading)
      if (line.match(/^#{2,4}\s+/) && !requirementPattern.test(line)) {
        inAcceptanceCriteria = false;
      }
    }

    // Save last requirement if exists
    if (currentRequirement && currentRequirement.id) {
      requirements.push({
        id: currentRequirement.id,
        title: currentRequirement.title || '',
        userStory: currentRequirement.userStory || '',
        acceptanceCriteria: currentRequirement.acceptanceCriteria || [],
        lineNumber: currentRequirement.lineNumber || 0,
      });
    }

    return requirements;
  }

  /**
   * Get coverage overview of all specs
   * Scans .kiro/specs/ directory and calculates completion percentage
   */
  getSpecCoverage(specsDir: string = '.kiro/specs'): {
    specs: Array<{
      name: string;
      path: string;
      total_tasks: number;
      completed_tasks: number;
      percentage: number;
      has_tasks: boolean;
    }>;
    overall_percentage: number;
  } {
    const normalizedPath = path.resolve(specsDir);

    // Check if specs directory exists
    if (!fs.existsSync(normalizedPath)) {
      throw new Error(`Specs directory does not exist: ${specsDir}`);
    }

    // Get all subdirectories in .kiro/specs/
    const entries = fs.readdirSync(normalizedPath, { withFileTypes: true });
    const specDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => ({
        name: entry.name,
        path: path.join(normalizedPath, entry.name),
      }));

    const specs: Array<{
      name: string;
      path: string;
      total_tasks: number;
      completed_tasks: number;
      percentage: number;
      has_tasks: boolean;
    }> = [];

    let totalTasksAcrossAllSpecs = 0;
    let totalCompletedTasksAcrossAllSpecs = 0;

    // Process each spec directory
    for (const spec of specDirs) {
      const tasksPath = path.join(spec.path, 'tasks.md');
      
      // Check if tasks.md exists
      if (!fs.existsSync(tasksPath)) {
        specs.push({
          name: spec.name,
          path: spec.path,
          total_tasks: 0,
          completed_tasks: 0,
          percentage: 0,
          has_tasks: false,
        });
        continue;
      }

      // Parse tasks.md
      try {
        const content = fs.readFileSync(tasksPath, 'utf-8');
        const tasks = this.parseTasks(content);

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.completed).length;
        const percentage = totalTasks > 0 
          ? Math.round((completedTasks / totalTasks) * 100) 
          : 0;

        specs.push({
          name: spec.name,
          path: spec.path,
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          percentage,
          has_tasks: true,
        });

        totalTasksAcrossAllSpecs += totalTasks;
        totalCompletedTasksAcrossAllSpecs += completedTasks;
      } catch (error) {
        // If parsing fails, mark as having no tasks
        specs.push({
          name: spec.name,
          path: spec.path,
          total_tasks: 0,
          completed_tasks: 0,
          percentage: 0,
          has_tasks: false,
        });
      }
    }

    // Calculate overall percentage
    const overallPercentage = totalTasksAcrossAllSpecs > 0
      ? Math.round((totalCompletedTasksAcrossAllSpecs / totalTasksAcrossAllSpecs) * 100)
      : 0;

    return {
      specs,
      overall_percentage: overallPercentage,
    };
  }

  /**
   * Validate spec structure
   * Checks for required files and validates their format
   */
  validateStructure(specPath: string): { valid: boolean; issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];

    // Normalize path
    const normalizedPath = path.resolve(specPath);

    // Check if spec directory exists
    if (!fs.existsSync(normalizedPath)) {
      issues.push({
        file: specPath,
        issue: `Spec directory does not exist: ${specPath}`,
        severity: 'error',
      });
      return { valid: false, issues };
    }

    // Check if it's a directory
    if (!fs.statSync(normalizedPath).isDirectory()) {
      issues.push({
        file: specPath,
        issue: `Path is not a directory: ${specPath}`,
        severity: 'error',
      });
      return { valid: false, issues };
    }

    // Check for required files
    const requiredFiles = ['requirements.md', 'design.md', 'tasks.md'];
    const missingFiles: string[] = [];

    for (const file of requiredFiles) {
      const filePath = path.join(normalizedPath, file);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(file);
        issues.push({
          file,
          issue: `Required file is missing: ${file}`,
          severity: 'error',
        });
      }
    }

    // If any required files are missing, return early
    if (missingFiles.length > 0) {
      return { valid: false, issues };
    }

    // Validate requirements.md
    const requirementsPath = path.join(normalizedPath, 'requirements.md');
    const requirementsIssues = this.validateRequirementsFile(requirementsPath);
    issues.push(...requirementsIssues);

    // Validate design.md
    const designPath = path.join(normalizedPath, 'design.md');
    const designIssues = this.validateDesignFile(designPath);
    issues.push(...designIssues);

    // Validate tasks.md
    const tasksPath = path.join(normalizedPath, 'tasks.md');
    const tasksIssues = this.validateTasksFile(tasksPath);
    issues.push(...tasksIssues);

    // Spec is valid if there are no error-level issues
    const valid = !issues.some(issue => issue.severity === 'error');

    return { valid, issues };
  }

  /**
   * Validate requirements.md file format
   * Checks for numbered requirements with acceptance criteria
   */
  private validateRequirementsFile(filePath: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let hasRequirements = false;
    let currentRequirement: string | null = null;

    // Pattern for requirement headers: ### Requirement N or ## Requirement N
    const requirementPattern = /^#{2,3}\s+Requirement\s+(\d+|NFR\d+)/i;
    
    // Pattern for acceptance criteria section
    const acceptanceCriteriaPattern = /^#{4,5}\s+Acceptance\s+Criteria/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for requirement headers
      const reqMatch = line.match(requirementPattern);
      if (reqMatch) {
        hasRequirements = true;
        currentRequirement = reqMatch[1];
      }

      // Check for acceptance criteria section
      if (acceptanceCriteriaPattern.test(line)) {
        if (!currentRequirement) {
          issues.push({
            file: 'requirements.md',
            line: lineNumber,
            issue: 'Acceptance Criteria section found without a preceding Requirement header',
            severity: 'warning',
          });
        }
      }
    }

    // Check if file has any requirements
    if (!hasRequirements) {
      issues.push({
        file: 'requirements.md',
        issue: 'No numbered requirements found. Expected format: "### Requirement 1" or "## Requirement 1"',
        severity: 'error',
      });
    }

    return issues;
  }

  /**
   * Validate design.md file format
   * Checks for architecture sections
   */
  private validateDesignFile(filePath: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Expected architecture sections
    const expectedSections = [
      'architecture',
      'components',
      'data models',
    ];

    const foundSections = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      
      // Check for section headers (## or ###)
      if (line.match(/^#{2,3}\s+/)) {
        const sectionName = line.replace(/^#{2,3}\s+/, '').trim();
        
        // Check if this matches any expected section
        for (const expected of expectedSections) {
          if (sectionName.includes(expected)) {
            foundSections.add(expected);
          }
        }
      }
    }

    // Check for missing sections
    for (const expected of expectedSections) {
      if (!foundSections.has(expected)) {
        issues.push({
          file: 'design.md',
          issue: `Missing expected architecture section: "${expected}". Design documents should include architecture, components, and data models sections.`,
          severity: 'warning',
        });
      }
    }

    // Check if file is empty or too short
    if (content.trim().length < 100) {
      issues.push({
        file: 'design.md',
        issue: 'Design document appears to be empty or too short',
        severity: 'error',
      });
    }

    return issues;
  }

  /**
   * Validate tasks.md file format
   * Checks for proper checkbox syntax
   */
  private validateTasksFile(filePath: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let hasValidTasks = false;
    const validCheckboxPattern = /^[\s-]*\[\s*[x\s]\s*\]/i;
    const invalidCheckboxPattern = /^[\s-]*\[(?![x\s])/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for valid checkbox syntax
      if (validCheckboxPattern.test(line)) {
        hasValidTasks = true;
      }

      // Check for invalid checkbox syntax
      if (invalidCheckboxPattern.test(line)) {
        issues.push({
          file: 'tasks.md',
          line: lineNumber,
          issue: `Invalid checkbox syntax. Expected "- [ ]" or "- [x]", found: "${line.trim()}"`,
          severity: 'error',
        });
      }

      // Check for malformed task items (has dash but no checkbox)
      if (line.match(/^\s*-\s+[^\[]/) && line.trim().length > 2) {
        // This might be a task without checkbox
        issues.push({
          file: 'tasks.md',
          line: lineNumber,
          issue: `Task item appears to be missing checkbox syntax. Expected "- [ ]" or "- [x]"`,
          severity: 'warning',
        });
      }
    }

    // Check if file has any valid tasks
    if (!hasValidTasks) {
      issues.push({
        file: 'tasks.md',
        issue: 'No valid task items found. Expected format: "- [ ] Task description" or "- [x] Task description"',
        severity: 'error',
      });
    }

    return issues;
  }
}

// Export singleton instance
export const specParserService = new SpecParserService();

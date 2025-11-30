/**
 * Code Analysis Service
 * 
 * Analyzes source code to validate implementation against requirements.
 * This is the core service that enables CODE REVIEW functionality.
 * 
 * Implemented in Task 6a.
 */

import { ParsedRequirement } from './specParserService.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface DesignLocation {
  component: string;           // e.g., "Shopping MCP Server"
  filePath: string;            // e.g., "backend/src/mcp/shoppingMcpServer.ts"
  section: string;             // Section in design.md where this is defined
}

export interface ImplementationFile {
  path: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;              // Why we think this file is related
  relevantLines: Array<{
    lineNumber: number;
    content: string;
  }>;
}

export interface CriteriaValidationResult {
  criterionNumber: number;
  criterionText: string;
  status: 'implemented' | 'missing' | 'partial' | 'needs_manual_review';
  evidence: {
    filePath?: string;
    lineNumber?: number;
    codeSnippet?: string;
    reason: string;
  };
  suggestedFix?: string;
}

export interface CodeSearchResult {
  filePath: string;
  lineNumber: number;
  content: string;
  matchType: 'function_name' | 'class_name' | 'comment_reference' | 'keyword';
}

export interface FileAnalysisResult {
  filePath: string;
  exports: string[];           // Exported functions/classes
  interfaces: string[];        // TypeScript interfaces
  functions: Array<{
    name: string;
    lineNumber: number;
    parameters: string[];
    returnType?: string;
  }>;
  hasErrorHandling: boolean;
  referencedRequirements: string[];  // Requirement IDs found in comments
}

export interface TestCoverageResult {
  requirementId: string;
  hasTests: boolean;
  testFiles: Array<{
    path: string;
    testNames: string[];
    criteriaCovered: number[];
  }>;
  missingCriteria: number[];
  coveragePercent: number;
}

export class CodeAnalysisService {
  /**
   * Parse design.md to extract expected file locations
   * Looks for patterns like:
   * - "Location: backend/src/..."
   * - "**Location**: `backend/src/...`"
   * - Component sections with file paths
   */
  extractDesignLocations(designContent: string): DesignLocation[] {
    const locations: DesignLocation[] = [];
    const lines = designContent.split('\n');
    
    let currentSection = '';
    let currentComponent = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Track sections (## or ###)
      const sectionMatch = line.match(/^#{2,3}\s+(.+)$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1].trim();
        // Component names often appear in section headers
        if (currentSection.includes('MCP') || currentSection.includes('Service')) {
          currentComponent = currentSection;
        }
        continue;
      }
      
      // Look for explicit Location markers
      const locationMatch = line.match(/\*\*Location\*\*:\s*`?([^`\n]+)`?/i) ||
                           line.match(/Location:\s*`?([^`\n]+)`?/i);
      
      if (locationMatch) {
        const filePath = locationMatch[1].trim();
        locations.push({
          component: currentComponent || currentSection,
          filePath,
          section: currentSection
        });
        continue;
      }
      
      // Look for code blocks with file paths (e.g., // backend/src/...)
      const codePathMatch = line.match(/\/\/\s*(backend\/[^\s]+\.ts)/);
      if (codePathMatch) {
        locations.push({
          component: currentComponent || currentSection,
          filePath: codePathMatch[1],
          section: currentSection
        });
      }
      
      // Look for inline file references in backticks
      const inlinePathMatch = line.match(/`(backend\/src\/[^`]+\.ts)`/);
      if (inlinePathMatch) {
        locations.push({
          component: currentComponent || currentSection,
          filePath: inlinePathMatch[1],
          section: currentSection
        });
      }
    }
    
    // Remove duplicates
    const uniqueLocations = locations.filter((loc, index, self) =>
      index === self.findIndex(l => l.filePath === loc.filePath)
    );
    
    return uniqueLocations;
  }

  /**
   * Search codebase for patterns matching requirement keywords
   * Uses glob for file discovery and grep for content search
   */
  async searchCodebase(
    patterns: string[],
    fileGlobs: string[]
  ): Promise<CodeSearchResult[]> {
    const results: CodeSearchResult[] = [];
    
    // Find all matching files
    const files: string[] = [];
    for (const pattern of fileGlobs) {
      const matches = await glob(pattern, { 
        ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
        absolute: false
      });
      files.push(...matches);
    }
    
    // Search each file for patterns
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          for (const pattern of patterns) {
            // Case-insensitive search
            const regex = new RegExp(pattern, 'i');
            if (regex.test(line)) {
              // Determine match type
              let matchType: CodeSearchResult['matchType'] = 'keyword';
              
              if (line.includes('function') || line.includes('const') || line.includes('async')) {
                matchType = 'function_name';
              } else if (line.includes('class') || line.includes('interface')) {
                matchType = 'class_name';
              } else if (line.includes('//') || line.includes('/*') || line.includes('*')) {
                matchType = 'comment_reference';
              }
              
              results.push({
                filePath: file,
                lineNumber: i + 1,
                content: line.trim(),
                matchType
              });
            }
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
    
    return results;
  }

  /**
   * Analyze a source file to extract functions, interfaces, exports
   * Parse TypeScript files to find function signatures and return types
   */
  async analyzeFile(
    filePath: string,
    criteria: Array<{ number: number; text: string }>
  ): Promise<FileAnalysisResult> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      const result: FileAnalysisResult = {
        filePath,
        exports: [],
        interfaces: [],
        functions: [],
        hasErrorHandling: false,
        referencedRequirements: []
      };
      
      // Parse file content
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Find exports
        const exportMatch = line.match(/export\s+(?:const|function|class|interface|type)\s+(\w+)/);
        if (exportMatch) {
          result.exports.push(exportMatch[1]);
        }
        
        // Find interfaces
        const interfaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)/);
        if (interfaceMatch) {
          result.interfaces.push(interfaceMatch[1]);
        }
        
        // Find functions (regular and async)
        const functionMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/);
        if (functionMatch) {
          const params = functionMatch[2]
            .split(',')
            .map(p => p.trim())
            .filter(p => p.length > 0);
          
          result.functions.push({
            name: functionMatch[1],
            lineNumber: i + 1,
            parameters: params,
            returnType: functionMatch[3]?.trim()
          });
        }
        
        // Find arrow functions
        const arrowMatch = line.match(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)(?:\s*:\s*([^=]+))?\s*=>/);
        if (arrowMatch) {
          const params = arrowMatch[2]
            .split(',')
            .map(p => p.trim())
            .filter(p => p.length > 0);
          
          result.functions.push({
            name: arrowMatch[1],
            lineNumber: i + 1,
            parameters: params,
            returnType: arrowMatch[3]?.trim()
          });
        }
        
        // Find class methods (async and regular)
        const methodMatch = line.match(/(?:async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*{/);
        if (methodMatch && !line.includes('function') && !line.includes('if') && !line.includes('while')) {
          const params = methodMatch[2]
            .split(',')
            .map(p => p.trim())
            .filter(p => p.length > 0);
          
          result.functions.push({
            name: methodMatch[1],
            lineNumber: i + 1,
            parameters: params,
            returnType: methodMatch[3]?.trim()
          });
        }
        
        // Check for error handling
        if (line.includes('try') || line.includes('catch') || line.includes('throw')) {
          result.hasErrorHandling = true;
        }
        
        // Find requirement references in comments
        const reqMatch = line.match(/(?:Requirement|Req|Requirements?)\s+(\d+(?:\.\d+)?)/i);
        if (reqMatch) {
          result.referencedRequirements.push(reqMatch[1]);
        }
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to analyze file ${filePath}: ${error}`);
    }
  }

  /**
   * Find source files related to a requirement by:
   * 1. Checking design.md for specified locations
   * 2. Searching for function/class names from the requirement
   * 3. Grepping for requirement ID references in code comments
   */
  async findImplementationFiles(
    requirement: ParsedRequirement,
    designDoc: string
  ): Promise<ImplementationFile[]> {
    const files: ImplementationFile[] = [];
    
    // Step 1: Extract locations from design.md
    const designLocations = this.extractDesignLocations(designDoc);
    
    for (const location of designLocations) {
      // Check if this location might be related to the requirement
      const componentLower = location.component.toLowerCase();
      const titleLower = requirement.title.toLowerCase();
      
      // Simple keyword matching
      const keywords = titleLower.split(/\s+/).filter(w => w.length > 3);
      const hasMatch = keywords.some(keyword => componentLower.includes(keyword));
      
      if (hasMatch) {
        try {
          await fs.access(location.filePath);
          files.push({
            path: location.filePath,
            confidence: 'high',
            reason: `Specified in design.md under "${location.section}"`,
            relevantLines: []
          });
        } catch {
          // File doesn't exist, skip
        }
      }
    }
    
    // Step 2: Search for requirement ID in comments
    const reqIdPatterns = [
      `Requirement ${requirement.id}`,
      `Req ${requirement.id}`,
      `Requirements ${requirement.id}`,
      `@requirement ${requirement.id}`
    ];
    
    const commentResults = await this.searchCodebase(
      reqIdPatterns,
      ['src/**/*.ts', '../admin-dashboard/**/*.ts', '../marketing-website/**/*.ts']
    );
    
    for (const result of commentResults) {
      if (!files.find(f => f.path === result.filePath)) {
        files.push({
          path: result.filePath,
          confidence: 'high',
          reason: `Contains comment referencing requirement ${requirement.id}`,
          relevantLines: [{
            lineNumber: result.lineNumber,
            content: result.content
          }]
        });
      }
    }
    
    // Step 3: Search for keywords from requirement title
    const titleWords = requirement.title
      .split(/\s+/)
      .filter(w => w.length > 4)
      .map(w => w.replace(/[^a-zA-Z0-9]/g, ''));
    
    if (titleWords.length > 0) {
      const keywordResults = await this.searchCodebase(
        titleWords,
        ['src/**/*.ts', '../admin-dashboard/**/*.ts', '../marketing-website/**/*.ts']
      );
      
      // Group by file and count matches
      const fileMatches = new Map<string, number>();
      for (const result of keywordResults) {
        fileMatches.set(result.filePath, (fileMatches.get(result.filePath) || 0) + 1);
      }
      
      // Add files with multiple keyword matches
      const fileMatchEntries = Array.from(fileMatches.entries());
      for (const [filePath, count] of fileMatchEntries) {
        if (count >= 2 && !files.find(f => f.path === filePath)) {
          const relevantLines = keywordResults
            .filter(r => r.filePath === filePath)
            .slice(0, 3)
            .map(r => ({
              lineNumber: r.lineNumber,
              content: r.content
            }));
          
          files.push({
            path: filePath,
            confidence: count >= 3 ? 'medium' : 'low',
            reason: `Contains ${count} keywords from requirement title`,
            relevantLines
          });
        }
      }
    }
    
    return files;
  }

  /**
   * Analyze if source code implements a requirement's acceptance criteria
   * This reads actual code files and checks for implementation evidence
   */
  async validateImplementation(
    requirement: ParsedRequirement,
    designLocations: DesignLocation[]
  ): Promise<CriteriaValidationResult[]> {
    const results: CriteriaValidationResult[] = [];
    
    // Find implementation files
    const designDoc = designLocations.map(l => 
      `## ${l.component}\nLocation: ${l.filePath}`
    ).join('\n\n');
    
    const implementationFiles = await this.findImplementationFiles(requirement, designDoc);
    
    // Analyze each acceptance criterion
    for (const criterion of requirement.acceptanceCriteria) {
      const result: CriteriaValidationResult = {
        criterionNumber: criterion.number,
        criterionText: criterion.text,
        status: 'needs_manual_review',
        evidence: {
          reason: 'No implementation files found'
        }
      };
      
      if (implementationFiles.length === 0) {
        result.status = 'missing';
        result.suggestedFix = `Create implementation for: ${criterion.text}`;
        results.push(result);
        continue;
      }
      
      // Analyze files for this criterion
      let foundEvidence = false;
      
      for (const implFile of implementationFiles) {
        try {
          const analysis = await this.analyzeFile(implFile.path, [criterion]);
          
          // Extract key terms from criterion
          const criterionLower = criterion.text.toLowerCase();
          const hasShall = criterionLower.includes('shall');
          
          // Extract what should be implemented
          let expectedFunction = '';
          const functionMatch = criterion.text.match(/SHALL\s+(\w+)/i);
          if (functionMatch) {
            expectedFunction = functionMatch[1].toLowerCase();
          }
          
          // Check if function exists
          const hasFunction = analysis.functions.some(f => 
            f.name.toLowerCase().includes(expectedFunction) ||
            expectedFunction.includes(f.name.toLowerCase())
          );
          
          if (hasFunction) {
            foundEvidence = true;
            result.status = 'implemented';
            result.evidence = {
              filePath: implFile.path,
              reason: `Found implementation in ${path.basename(implFile.path)}`
            };
            break;
          }
          
          // Check for error handling if criterion mentions it
          if (criterionLower.includes('error') && analysis.hasErrorHandling) {
            foundEvidence = true;
            result.status = 'partial';
            result.evidence = {
              filePath: implFile.path,
              reason: 'Found error handling, but specific implementation unclear'
            };
          }
          
        } catch (error) {
          // Skip files that can't be analyzed
          continue;
        }
      }
      
      if (!foundEvidence) {
        result.status = 'needs_manual_review';
        result.evidence = {
          filePath: implementationFiles[0]?.path,
          reason: 'Implementation files found but specific criterion implementation unclear'
        };
        result.suggestedFix = `Review ${implementationFiles[0]?.path} to verify: ${criterion.text}`;
      }
      
      results.push(result);
    }
    
    return results;
  }

  /**
   * Find tests that cover a requirement
   * Looks for property tests, unit tests, and integration tests
   */
  async findTestsForRequirement(
    requirementId: string,
    specPath: string
  ): Promise<TestCoverageResult> {
    const result: TestCoverageResult = {
      requirementId,
      hasTests: false,
      testFiles: [],
      missingCriteria: [],
      coveragePercent: 0
    };
    
    // Search for test files
    const testPatterns = [
      `**/*.test.ts`,
      `**/*.spec.ts`,
      `**/*.property.test.ts`,
      `**/test/**/*.ts`
    ];
    
    const testFiles: string[] = [];
    for (const pattern of testPatterns) {
      const matches = await glob(pattern, {
        ignore: ['**/node_modules/**', '**/dist/**'],
        absolute: false
      });
      testFiles.push(...matches);
    }
    
    // Search for requirement references in test files
    const reqPatterns = [
      `Requirement ${requirementId}`,
      `Req ${requirementId}`,
      `Requirements ${requirementId}`,
      `Validates: Requirements ${requirementId}`,
      `Property.*${requirementId}`
    ];
    
    for (const testFile of testFiles) {
      try {
        const content = await fs.readFile(testFile, 'utf-8');
        const lines = content.split('\n');
        
        const testNames: string[] = [];
        const criteriaCovered: number[] = [];
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Check for requirement reference
          const hasReqRef = reqPatterns.some(pattern => {
            const regex = new RegExp(pattern, 'i');
            return regex.test(line);
          });
          
          if (hasReqRef) {
            // Extract test name
            const testMatch = line.match(/(?:it|test|describe)\s*\(\s*['"`]([^'"`]+)['"`]/);
            if (testMatch) {
              testNames.push(testMatch[1]);
            }
            
            // Extract criterion number if present
            const criterionMatch = line.match(/(?:Requirement|Req)\s+\d+\.(\d+)/i);
            if (criterionMatch) {
              criteriaCovered.push(parseInt(criterionMatch[1]));
            }
          }
        }
        
        if (testNames.length > 0) {
          result.testFiles.push({
            path: testFile,
            testNames,
            criteriaCovered
          });
          result.hasTests = true;
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
    
    // Calculate coverage (simplified - assumes we know total criteria)
    if (result.testFiles.length > 0) {
      const totalCriteriaCovered = new Set(
        result.testFiles.flatMap(tf => tf.criteriaCovered)
      ).size;
      
      // Estimate coverage based on test files found
      result.coveragePercent = result.testFiles.length > 0 ? 
        Math.min(100, totalCriteriaCovered * 25) : 0;
    }
    
    return result;
  }
}

// Export singleton instance
export const codeAnalysisService = new CodeAnalysisService();

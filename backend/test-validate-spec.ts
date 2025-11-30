#!/usr/bin/env tsx

/**
 * Manual test script for validate_spec functionality
 */

import { specParserService } from './src/mcp/kiro/services/specParserService.js';
import * as path from 'path';

async function testValidateSpec() {
  console.log('Testing validate_spec on kiro-mcps spec...\n');

  const specPath = path.resolve(__dirname, '../.kiro/specs/kiro-mcps');
  
  try {
    const result = specParserService.validateStructure(specPath);
    
    console.log('Validation Result:');
    console.log('==================');
    console.log(`Valid: ${result.valid}`);
    console.log(`Total Issues: ${result.issues.length}`);
    console.log(`Errors: ${result.issues.filter(i => i.severity === 'error').length}`);
    console.log(`Warnings: ${result.issues.filter(i => i.severity === 'warning').length}`);
    
    if (result.issues.length > 0) {
      console.log('\nIssues:');
      result.issues.forEach((issue, idx) => {
        console.log(`\n${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.file}`);
        if (issue.line) {
          console.log(`   Line: ${issue.line}`);
        }
        console.log(`   ${issue.issue}`);
      });
    } else {
      console.log('\n✓ No issues found! Spec is valid.');
    }
    
    console.log('\n==================');
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('Error during validation:', error);
    process.exit(1);
  }
}

testValidateSpec();

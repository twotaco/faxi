/**
 * Manual test script for generate_test_from_spec MCP tool
 * 
 * This script simulates calling the MCP tool directly
 */

import * as fs from 'fs';
import * as path from 'path';

async function testGenerateTestTool() {
  console.log('Testing generate_test_from_spec MCP tool...\n');

  // Test with the kiro-mcps spec
  const specPath = path.join(process.cwd(), '..', '.kiro', 'specs', 'kiro-mcps');
  const requirementId = '4'; // Requirement 4: Generate Test from Spec

  console.log(`Spec path: ${specPath}`);
  console.log(`Requirement ID: ${requirementId}\n`);

  try {
    // Import the spec parser service
    const { specParserService } = await import('./src/mcp/kiro/services/specParserService.js');

    // Read requirements.md
    const requirementsPath = path.join(specPath, 'requirements.md');
    if (!fs.existsSync(requirementsPath)) {
      throw new Error(`requirements.md not found in ${specPath}`);
    }

    const requirementsContent = fs.readFileSync(requirementsPath, 'utf-8');
    const requirements = specParserService.parseRequirements(requirementsContent);

    console.log(`Found ${requirements.length} requirements in spec`);
    console.log(`Available requirement IDs: ${requirements.map(r => r.id).join(', ')}\n`);

    // Find the requested requirement
    const requirement = requirements.find(r => r.id === requirementId);

    if (!requirement) {
      const availableIds = requirements.map(r => r.id).join(', ');
      throw new Error(
        `Requirement ${requirementId} not found in ${specPath}. ` +
        `Available requirement IDs: ${availableIds}`
      );
    }

    console.log('Found requirement:');
    console.log(`  ID: ${requirement.id}`);
    console.log(`  Title: ${requirement.title}`);
    console.log(`  User Story: ${requirement.userStory}`);
    console.log(`  Acceptance Criteria: ${requirement.acceptanceCriteria.length} items\n`);

    // Generate test code
    const testCode = generateTestCode(requirement, 'kiro-mcps');

    console.log('Generated test code:');
    console.log('='.repeat(80));
    console.log(testCode);
    console.log('='.repeat(80));

    console.log('\n✅ Test generation successful!');
    console.log('\nVerifying generated code structure:');
    console.log(`  ✓ Contains fast-check import: ${testCode.includes('import * as fc from')}`);
    console.log(`  ✓ Contains describe block: ${testCode.includes('describe(')}`);
    console.log(`  ✓ Contains it block: ${testCode.includes('it(')}`);
    console.log(`  ✓ Contains fc.asyncProperty: ${testCode.includes('fc.asyncProperty')}`);
    console.log(`  ✓ Contains numRuns: 100: ${testCode.includes('numRuns: 100')}`);
    console.log(`  ✓ Contains requirement ID: ${testCode.includes(`Requirements ${requirementId}`)}`);
    console.log(`  ✓ Contains user story: ${testCode.includes('User Story:')}`);
    console.log(`  ✓ Contains acceptance criteria: ${testCode.includes('Acceptance Criteria:')}`);

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Generate test code (same logic as MCP server)
 */
function generateTestCode(requirement: any, specName: string): string {
  const { id, title, userStory, acceptanceCriteria } = requirement;

  const testDescription = `property: ${title.toLowerCase()}`;

  const propertyComment = [
    '/**',
    ` * Feature: ${specName}, Property: ${title}`,
    ` * Validates: Requirements ${id}`,
    ' */',
  ].join('\n');

  const criteriaComments = acceptanceCriteria
    .map((c: any) => ` * - ${c.number}. ${c.text}`)
    .join('\n');

  const testCode = `
import * as fc from 'fast-check';

describe('${specName} - Requirement ${id}', () => {
  ${propertyComment}
  it('${testDescription}', async () => {
    await fc.assert(
      fc.asyncProperty(
        // TODO: Define generators for test inputs
        fc.string(), // Replace with appropriate generators
        async (input) => {
          // TODO: Implement test logic
          
          // User Story: ${userStory}
          
          // Acceptance Criteria:
${criteriaComments}
          
          // TODO: Add assertions that verify the acceptance criteria
          expect(true).toBe(true); // Replace with actual assertions
        }
      ),
      { numRuns: 100 } // Run 100 iterations as per design doc
    );
  });
});
`.trim();

  return testCode;
}

// Run the test
testGenerateTestTool();

#!/usr/bin/env tsx

import { testFaxFixtureGenerator } from './fixtures/createTestFaxes';

async function main() {
  console.log('🖨️ Generating Faxi test fax fixtures...\n');
  
  try {
    const fixtures = testFaxFixtureGenerator.generateAllFixtures();
    
    console.log(`\n✅ Successfully generated ${fixtures.length} test fax fixtures:\n`);
    
    fixtures.forEach((fixture, index) => {
      console.log(`${index + 1}. ${fixture.filename}`);
      console.log(`   📝 ${fixture.description}`);
      console.log(`   🎯 Scenario: ${fixture.scenario}`);
      console.log(`   🤖 Expected Intent: ${fixture.expectedIntent}`);
      console.log('');
    });
    
    console.log('📁 Fixtures saved to: src/test/fixtures/fax-images/');
    console.log('\n🚀 You can now use these fixtures in the test UI at /test');
    console.log('   Or upload them directly via the test webhook endpoint');
    
  } catch (error) {
    console.error('❌ Error generating fixtures:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
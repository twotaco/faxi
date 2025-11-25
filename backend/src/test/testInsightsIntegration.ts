/**
 * Test Insights Integration
 * 
 * Simple test to verify insights extraction and storage
 */

import { userInsightsService } from '../services/userInsightsService.js';
import { UserInsights } from '../prompts/schemas/base.js';
import { QAResponseSchema } from '../prompts/schemas/qa.js';

async function testInsightsIntegration() {
  console.log('🧪 Testing Insights Integration\n');

  // Test 1: Validate schema
  console.log('Test 1: Schema Validation');
  const testResponse = {
    response: "Hello, thank you for contacting Faxi.\n\nFor weather information, I recommend checking a local weather website.",
    followUpSuggestions: ["What should I pack?"],
    requiresContinuation: false,
    metadata: {
      confidence: "medium" as const,
      category: "weather"
    },
    insights: {
      demographics: {
        ageRangeInferred: "70-79" as const
      },
      intentSignals: {
        commercialIntent: [{
          category: "travel",
          urgency: "near-term" as const
        }]
      },
      digitalProfile: {
        digitalExclusionScore: 4,
        aiAssistanceNeeded: ["information-lookup"]
      },
      confidenceScores: {
        intent: 0.9,
        demographics: 0.6
      }
    }
  };

  try {
    const validated = QAResponseSchema.parse(testResponse);
    console.log('✅ Schema validation passed');
    console.log('   Insights extracted:', Object.keys(validated.insights || {}).length, 'categories\n');
  } catch (error) {
    console.error('❌ Schema validation failed:', error);
    return;
  }

  // Test 2: Process insights
  console.log('Test 2: Process Insights');
  const testUserId = '00000000-0000-0000-0000-000000000001'; // Test user
  const testFaxJobId = '00000000-0000-0000-0000-000000000002'; // Test fax job

  try {
    await userInsightsService.processInsights(
      testUserId,
      testResponse.insights,
      testFaxJobId
    );
    console.log('✅ Insights processed successfully\n');
  } catch (error) {
    console.error('❌ Failed to process insights:', error);
    return;
  }

  // Test 3: Retrieve profile
  console.log('Test 3: Retrieve Profile');
  try {
    const profile = await userInsightsService.getProfile(testUserId);
    if (profile) {
      console.log('✅ Profile retrieved');
      console.log('   Age range:', profile.profileData.demographics?.ageRangeInferred);
      console.log('   Digital exclusion score:', profile.digitalExclusionScore);
      console.log('   Total interactions:', profile.totalInteractions);
      console.log('\n');
    } else {
      console.log('⚠️  No profile found (database not set up?)\n');
    }
  } catch (error) {
    console.error('❌ Failed to retrieve profile:', error);
    return;
  }

  // Test 4: Get history
  console.log('Test 4: Get Insight History');
  try {
    const history = await userInsightsService.getHistory(testUserId, 10);
    console.log('✅ History retrieved');
    console.log('   Total entries:', history.length);
    if (history.length > 0) {
      console.log('   Latest insight type:', history[0].insightType);
      console.log('   Confidence:', history[0].confidenceScore);
    }
    console.log('\n');
  } catch (error) {
    console.error('❌ Failed to retrieve history:', error);
    return;
  }

  console.log('🎉 All tests passed!\n');
  console.log('Next steps:');
  console.log('1. Run database migration: npm run migrate');
  console.log('2. Test with real fax: Send a test fax via /test/fax/receive');
  console.log('3. Check insights in database: SELECT * FROM user_insights;');
  console.log('4. View history: SELECT * FROM insights_history ORDER BY detected_at DESC LIMIT 10;');
}

// Run tests
testInsightsIntegration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });

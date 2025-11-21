import { describe, it, expect, beforeAll } from 'vitest';
import { aiVisionInterpreter } from '../../services/aiVisionInterpreter';
import { mcpControllerAgent } from '../../services/mcpControllerAgent';
import { ResponseGenerator } from '../../services/responseGenerator';
import { testFaxFixtureGenerator } from '../fixtures/createTestFaxes';
import { userRepository } from '../../repositories/userRepository';

describe('Simple End-to-End Fax Processing', () => {
  beforeAll(() => {
    // Generate test fixtures
    testFaxFixtureGenerator.generateAllFixtures();
  });

  it('should process an AI chat fax from image to response', async () => {
    // Step 1: Get test fax image
    const aiChatFixture = testFaxFixtureGenerator.getFixture('ai_chat_request.png');
    expect(aiChatFixture).toBeDefined();

    // Step 2: Create test user
    const { user } = await userRepository.findOrCreate('+1234567890');
    expect(user).toBeDefined();

    // Step 3: Interpret the fax with Gemini
    console.log('Step 1: Interpreting fax with Gemini...');
    const interpretation = await aiVisionInterpreter.interpretFax({
      imageData: aiChatFixture!,
      userId: user.id,
    });

    console.log('Interpretation result:', {
      intent: interpretation.intent,
      confidence: interpretation.confidence,
      extractedText: interpretation.extractedText?.substring(0, 100),
    });

    expect(interpretation.intent).toBe('ai_chat');
    expect(interpretation.extractedText).toBeTruthy();

    // Step 4: Process with MCP Controller Agent
    console.log('Step 2: Processing with MCP Controller Agent...');
    const agentResponse = await mcpControllerAgent.processRequest({
      interpretation,
      userId: user.id,
      faxJobId: 'test-job-123',
      conversationContext: interpretation.context,
    });

    console.log('Agent response:', {
      success: agentResponse.success,
      responseType: agentResponse.responseType,
      stepsExecuted: agentResponse.steps.length,
      userMessage: agentResponse.userMessage?.substring(0, 100),
    });

    // Log any errors from agent steps
    if (agentResponse.steps.length > 0) {
      agentResponse.steps.forEach((step, i) => {
        console.log(`  Step ${i + 1}: ${step.toolServer}.${step.toolName}`, {
          success: step.success,
          error: step.error,
        });
      });
    }

    expect(agentResponse.success).toBe(true);
    expect(agentResponse.steps.length).toBeGreaterThan(0);
    expect(agentResponse.faxTemplate).toBeDefined();

    // Step 5: Generate response fax
    console.log('Step 3: Generating response fax...');
    const responseResult = await ResponseGenerator.generateResponse({
      type: agentResponse.faxTemplate.type,
      data: agentResponse.faxTemplate.contextData,
    });

    console.log('Response generated:', {
      referenceId: responseResult.referenceId,
      pdfSize: responseResult.pdfBuffer.length,
    });

    expect(responseResult.pdfBuffer.length).toBeGreaterThan(0);
    expect(responseResult.referenceId).toBeTruthy();

    console.log('✅ End-to-end test passed!');
  }, 120000); // 2 minute timeout
});

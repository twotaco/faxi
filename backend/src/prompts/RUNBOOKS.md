# Prompt System Runbooks

## Overview

This document provides step-by-step procedures for diagnosing and resolving common issues in the Faxi LLM Prompt Architecture system.

## Table of Contents

1. [Schema Validation Failures](#schema-validation-failures)
2. [Insights Extraction Issues](#insights-extraction-issues)
3. [Performance Degradation](#performance-degradation)
4. [High Error Rates](#high-error-rates)
5. [Adding New Use Cases](#adding-new-use-cases)
6. [Emergency Procedures](#emergency-procedures)

---

## Schema Validation Failures

### Symptoms
- Validation success rate drops below 95%
- Repeated validation errors in logs
- Users receiving error responses
- Alert: `VALIDATION_THRESHOLD_BREACH`

### Diagnosis Steps

#### 1. Check Monitoring Dashboard
```
Navigate to: http://localhost:3000/prompt-monitoring-dashboard.html
Look for: Validation success rate by use case
```

#### 2. Review Recent Errors
```bash
# Check application logs for validation errors
grep "Schema validation failed" backend/logs/app.log | tail -20

# Or use the monitoring API
curl http://localhost:3000/api/monitoring/prompts/errors/qa?timeWindow=3600000
```

#### 3. Identify Patterns
Look for:
- Specific fields that consistently fail validation
- Particular use cases with higher failure rates
- Time-based patterns (e.g., failures after deployment)

### Common Causes & Solutions

#### Cause 1: Schema Too Strict

**Symptoms:**
- LLM consistently omits optional fields
- Validation errors on enum values
- Type mismatches (string vs number)

**Solution:**
```typescript
// Make fields optional if they're not always needed
export const YourSchema = z.object({
  requiredField: z.string(),
  optionalField: z.string().optional(), // Add .optional()
  flexibleEnum: z.enum(['value1', 'value2']).or(z.string()) // Allow other values
});
```

**Steps:**
1. Identify the failing field from error logs
2. Update schema in `backend/src/prompts/schemas/[useCase].ts`
3. Test with sample inputs
4. Deploy and monitor

#### Cause 2: Prompt Instructions Unclear

**Symptoms:**
- LLM returns correct data but wrong format
- Missing required fields
- Incorrect field names

**Solution:**
```typescript
// Update prompt template to be more explicit
systemPrompt: `
CRITICAL: Your response MUST include these exact fields:
- intent: one of ["search", "select", "order"]
- response: a string with the fax-friendly response
- metadata: an object with confidence and requiresFollowUp

Example:
{
  "intent": "search",
  "response": "Here are the products...",
  "metadata": {
    "confidence": "high",
    "requiresFollowUp": false
  }
}
`
```

**Steps:**
1. Review prompt template in `backend/src/prompts/templates/[useCase].ts`
2. Add explicit field requirements
3. Include more examples
4. Test with edge cases
5. Deploy and monitor

#### Cause 3: Gemini Model Issues

**Symptoms:**
- Sudden increase in validation failures
- JSON format errors
- Timeout errors

**Solution:**
```typescript
// Add retry logic with exponential backoff
const result = await retryWithBackoff(async () => {
  return await model.generateContent(userMessage);
}, {
  maxAttempts: 3,
  initialDelay: 1000,
  backoffMultiplier: 2
});
```

**Steps:**
1. Check Gemini API status
2. Review rate limits
3. Implement retry logic if not present
4. Consider fallback to different model version

### Resolution Checklist

- [ ] Identified failing use case
- [ ] Reviewed error patterns
- [ ] Updated schema or prompt as needed
- [ ] Tested changes locally
- [ ] Deployed to production
- [ ] Monitored validation success rate
- [ ] Documented changes

### Prevention

1. **Test prompts thoroughly** before deployment
2. **Use gradual rollout** for prompt changes
3. **Monitor validation rates** continuously
4. **Keep schemas flexible** with optional fields
5. **Include diverse examples** in prompts

---

## Insights Extraction Issues

### Symptoms
- Low confidence scores (< 0.6)
- Missing insights in responses
- Insights extraction rate below 80%
- Privacy violations detected

### Diagnosis Steps

#### 1. Check Insights Metrics
```bash
# Check insights extraction rate
curl http://localhost:3000/api/monitoring/prompts/insights/qa?timeWindow=3600000

# Review insights in database
psql -d faxi -c "SELECT * FROM user_insights WHERE updated_at > NOW() - INTERVAL '1 hour' LIMIT 10;"
```

#### 2. Review Sample Responses
```bash
# Check recent fax jobs with insights
psql -d faxi -c "
SELECT fj.id, fj.from_number, ui.demographics, ui.confidence_scores
FROM fax_jobs fj
LEFT JOIN user_insights ui ON fj.from_number = ui.user_id
WHERE fj.created_at > NOW() - INTERVAL '1 hour'
ORDER BY fj.created_at DESC
LIMIT 10;
"
```

#### 3. Analyze Confidence Scores
Look for:
- Consistently low confidence across all categories
- Specific categories with low confidence
- Missing insights fields

### Common Causes & Solutions

#### Cause 1: Insufficient Context

**Symptoms:**
- Low confidence scores across all insights
- Many fields marked as "unknown"
- Insights extraction rate < 50%

**Solution:**
```typescript
// Update prompt to emphasize insights extraction
systemPrompt: `
INSIGHTS EXTRACTION (CRITICAL):
You MUST extract insights from every interaction. Look for:

DEMOGRAPHICS:
- Age indicators: language style, technology comfort, life stage
- Household type: mentions of family, cooking portions, living situation

LIFE EVENTS:
- Moving: new area questions, address changes
- Caregiving: helping elderly parent, responsibilities
- Health changes: medical appointments, mobility issues

Only include insights with confidence > 0.6.
If you cannot infer with confidence > 0.6, omit that field.
`
```

**Steps:**
1. Review prompt template insights section
2. Add more specific extraction guidelines
3. Include examples with insights
4. Test with diverse inputs
5. Monitor confidence scores

#### Cause 2: Privacy Violations

**Symptoms:**
- Alerts for PII in insights
- Medical diagnoses in insights
- Exact ages or birthdates

**Solution:**
```typescript
// Strengthen privacy validation
export function validatePrivacy(insights: UserInsights): boolean {
  // Check for PII patterns
  const piiPatterns = [
    /\d{3}-\d{2}-\d{4}/, // SSN
    /\d{10,}/, // Phone numbers
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/, // Exact dates
    /@/, // Email addresses
  ];

  const insightsStr = JSON.stringify(insights);
  
  for (const pattern of piiPatterns) {
    if (pattern.test(insightsStr)) {
      logger.warn('PII detected in insights', { pattern: pattern.toString() });
      return false;
    }
  }

  // Check for medical diagnoses
  const medicalTerms = ['diabetes', 'cancer', 'hypertension', 'diagnosis'];
  for (const term of medicalTerms) {
    if (insightsStr.toLowerCase().includes(term)) {
      logger.warn('Medical diagnosis detected in insights', { term });
      return false;
    }
  }

  return true;
}
```

**Steps:**
1. Review privacy validation in `userInsightsService.ts`
2. Add stricter validation rules
3. Update prompt to emphasize privacy
4. Test with sensitive inputs
5. Monitor for violations

#### Cause 3: Confidence Scoring Issues

**Symptoms:**
- Confidence scores don't match actual accuracy
- Too many low-confidence insights
- Inconsistent scoring across use cases

**Solution:**
```typescript
// Calibrate confidence scoring in prompt
systemPrompt: `
CONFIDENCE SCORING GUIDELINES:

0.9-1.0: EXPLICIT statement
  Example: "I'm 75 years old" → ageRange: "70-79", confidence: 0.95

0.7-0.9: STRONG contextual clues
  Example: "My grandson is visiting" → ageRange: "60-69", confidence: 0.8

0.5-0.7: MODERATE inference
  Example: "I need help with the computer" → digitalExclusion: 4, confidence: 0.6

< 0.5: DO NOT INCLUDE
  Too speculative, not enough evidence

IMPORTANT: Only include insights with confidence > 0.6
`
```

**Steps:**
1. Review confidence scoring guidelines in prompts
2. Add calibration examples
3. Test with known inputs
4. Compare predicted vs actual confidence
5. Adjust guidelines as needed

### Resolution Checklist

- [ ] Identified insights issue type
- [ ] Reviewed sample responses
- [ ] Updated prompt or validation as needed
- [ ] Tested with diverse inputs
- [ ] Verified privacy compliance
- [ ] Monitored confidence scores
- [ ] Documented changes

### Prevention

1. **Include diverse examples** with insights in prompts
2. **Regularly audit** insights for privacy compliance
3. **Calibrate confidence scores** against actual accuracy
4. **Monitor extraction rates** by use case
5. **Test with edge cases** regularly

---

## Performance Degradation

### Symptoms
- Response time > 5 seconds
- Validation time > 100ms
- Timeout errors
- Alert: Slow response time

### Diagnosis Steps

#### 1. Check Performance Metrics
```bash
# Check average response times
curl http://localhost:3000/api/monitoring/prompts/performance/qa?timeWindow=3600000

# Check system resources
top -b -n 1 | head -20
```

#### 2. Profile Slow Requests
```bash
# Enable detailed logging
export LOG_LEVEL=debug

# Check logs for slow operations
grep "duration" backend/logs/app.log | grep -E "[5-9][0-9]{3}|[0-9]{5,}"
```

#### 3. Identify Bottlenecks
Look for:
- Slow LLM calls (> 4 seconds)
- Slow validation (> 100ms)
- Slow insights processing (> 500ms)
- Database query delays

### Common Causes & Solutions

#### Cause 1: Large Prompts

**Symptoms:**
- LLM call time > 4 seconds
- Consistent slow responses
- High token usage

**Solution:**
```typescript
// Reduce prompt size
systemPrompt: `
You are helping users with [task] via fax.

CRITICAL: Respond with valid JSON matching the schema.

FAX RULES:
- Concise (500-800 words)
- Short paragraphs
- Simple language

[Shortened guidelines...]

SCHEMA: {schema}
`

// Remove verbose examples, keep only 1-2 essential ones
examples: [
  { input: "Common case", output: {...} }
]
```

**Steps:**
1. Review prompt length
2. Remove redundant instructions
3. Reduce number of examples
4. Test response quality
5. Monitor performance

#### Cause 2: Slow Validation

**Symptoms:**
- Validation time > 100ms
- Complex schema validation
- Large response objects

**Solution:**
```typescript
// Optimize schema validation
export const OptimizedSchema = z.object({
  // Use simpler types where possible
  intent: z.string(), // Instead of z.enum() for large enums
  
  // Lazy validation for nested objects
  metadata: z.lazy(() => MetadataSchema),
  
  // Skip validation for non-critical fields
  debugInfo: z.any().optional()
});

// Cache schema compilation
const compiledSchema = YourSchema.parse;
```

**Steps:**
1. Profile validation performance
2. Simplify complex schemas
3. Use lazy validation for nested objects
4. Cache compiled schemas
5. Monitor validation time

#### Cause 3: Database Bottlenecks

**Symptoms:**
- Slow insights storage
- Database connection timeouts
- High database CPU usage

**Solution:**
```sql
-- Add indexes for common queries
CREATE INDEX idx_user_insights_user_id ON user_insights(user_id);
CREATE INDEX idx_insights_history_timestamp ON insights_history(timestamp);

-- Optimize queries
-- Before:
SELECT * FROM user_insights WHERE user_id = $1;

-- After:
SELECT user_id, demographics, confidence_scores 
FROM user_insights 
WHERE user_id = $1;
```

**Steps:**
1. Review slow query logs
2. Add missing indexes
3. Optimize query patterns
4. Consider connection pooling
5. Monitor database performance

### Resolution Checklist

- [ ] Identified performance bottleneck
- [ ] Measured baseline performance
- [ ] Implemented optimization
- [ ] Tested performance improvement
- [ ] Verified no quality degradation
- [ ] Monitored production performance
- [ ] Documented changes

### Prevention

1. **Keep prompts concise** (< 2000 tokens)
2. **Use simple schemas** where possible
3. **Index database tables** appropriately
4. **Monitor performance metrics** continuously
5. **Load test** before major changes

---

## High Error Rates

### Symptoms
- Error rate > 5%
- Frequent retry attempts
- User complaints
- Alert: `ERROR_THRESHOLD_BREACH`

### Diagnosis Steps

#### 1. Check Error Metrics
```bash
# Check error rate by use case
curl http://localhost:3000/api/monitoring/prompts/errors/qa?timeWindow=3600000

# Review error logs
grep "ERROR" backend/logs/error.log | tail -50
```

#### 2. Categorize Errors
Group by type:
- `validation_failure`: Schema validation errors
- `json_parse_error`: Invalid JSON from LLM
- `llm_error`: Gemini API errors
- `insights_error`: Insights processing errors

#### 3. Identify Root Cause
Look for:
- Specific use cases with high error rates
- Time-based patterns (e.g., after deployment)
- External dependencies (Gemini API issues)

### Common Causes & Solutions

#### Cause 1: Gemini API Issues

**Symptoms:**
- Sudden spike in errors
- Timeout errors
- Rate limit errors

**Solution:**
```typescript
// Implement robust error handling
async function callGeminiWithRetry(
  model: any,
  message: string,
  maxRetries: number = 3
): Promise<any> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(message);
      return result;
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      if (error.message.includes('rate limit')) {
        // Exponential backoff
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
      
      if (error.message.includes('timeout')) {
        // Retry with timeout
        continue;
      }
      
      // Non-retryable error
      throw error;
    }
  }
  
  throw lastError;
}
```

**Steps:**
1. Check Gemini API status
2. Implement retry logic
3. Add exponential backoff
4. Monitor error rates
5. Consider fallback strategies

#### Cause 2: Invalid User Input

**Symptoms:**
- Errors on specific types of requests
- Parsing errors
- Validation failures on user data

**Solution:**
```typescript
// Add input validation
export function validateUserInput(input: string): {
  valid: boolean;
  sanitized: string;
  errors: string[];
} {
  const errors: string[] = [];
  let sanitized = input;
  
  // Check length
  if (input.length > 5000) {
    errors.push('Input too long');
    sanitized = input.substring(0, 5000);
  }
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Check for malicious patterns
  if (/<script|javascript:/i.test(input)) {
    errors.push('Potentially malicious input');
  }
  
  return {
    valid: errors.length === 0,
    sanitized,
    errors
  };
}
```

**Steps:**
1. Review error patterns
2. Add input validation
3. Sanitize user input
4. Test with edge cases
5. Monitor error rates

#### Cause 3: System Resource Issues

**Symptoms:**
- Intermittent errors
- Memory errors
- Connection timeouts

**Solution:**
```bash
# Check system resources
free -h
df -h
netstat -an | grep ESTABLISHED | wc -l

# Increase resource limits if needed
# In docker-compose.yml:
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

**Steps:**
1. Monitor system resources
2. Identify resource constraints
3. Increase limits if needed
4. Optimize resource usage
5. Monitor stability

### Resolution Checklist

- [ ] Identified error type and cause
- [ ] Reviewed error patterns
- [ ] Implemented fix
- [ ] Tested error scenarios
- [ ] Verified error rate reduction
- [ ] Monitored production
- [ ] Documented resolution

### Prevention

1. **Implement robust error handling** with retries
2. **Validate user input** before processing
3. **Monitor system resources** continuously
4. **Set up alerts** for error rate thresholds
5. **Test error scenarios** regularly

---

## Adding New Use Cases

### Overview
Step-by-step procedure for adding a new use case to the prompt system.

### Prerequisites
- Understanding of the use case requirements
- Access to codebase
- Test environment available

### Procedure

#### Step 1: Define the Schema (15 minutes)

```bash
# Create schema file
touch backend/src/prompts/schemas/yourUseCase.ts
```

```typescript
// backend/src/prompts/schemas/yourUseCase.ts
import { z } from 'zod';
import { UserInsightsSchema } from './base';

export const YourUseCaseResponseSchema = z.object({
  intent: z.enum(['action1', 'action2', 'clarify']),
  response: z.string(),
  metadata: z.object({
    confidence: z.enum(['high', 'medium', 'low']),
    requiresFollowUp: z.boolean()
  }),
  insights: UserInsightsSchema.optional()
});

export type YourUseCaseResponse = z.infer<typeof YourUseCaseResponseSchema>;

export const yourUseCaseJsonSchema = {
  type: "object",
  properties: {
    // ... JSON schema for Gemini
  },
  required: ["intent", "response", "metadata"]
};
```

**Validation:**
- [ ] Schema compiles without errors
- [ ] All required fields defined
- [ ] Insights field included
- [ ] JSON schema matches Zod schema

#### Step 2: Create Prompt Template (20 minutes)

```bash
# Create template file
touch backend/src/prompts/templates/yourUseCase.ts
```

```typescript
// backend/src/prompts/templates/yourUseCase.ts
import { PromptTemplate } from '../index';
import { YourUseCaseResponseSchema, yourUseCaseJsonSchema } from '../schemas/yourUseCase';

export const yourUseCasePrompt: PromptTemplate = {
  useCase: 'your-use-case',
  systemPrompt: `[Your prompt here]`,
  jsonSchema: yourUseCaseJsonSchema,
  zodSchema: YourUseCaseResponseSchema,
  examples: [
    {
      input: "Example request",
      output: { /* example response */ }
    }
  ],
  faxFormatting: {
    maxWords: 800,
    preferredSections: ['summary', 'details']
  }
};
```

**Validation:**
- [ ] Prompt includes all required sections
- [ ] Insights extraction guidelines included
- [ ] Examples provided
- [ ] Fax formatting rules specified

#### Step 3: Register Template (5 minutes)

```typescript
// backend/src/prompts/register.ts
import { yourUseCasePrompt } from './templates/yourUseCase';

export function registerAllPrompts(manager: PromptManager): void {
  // ... existing registrations
  manager.register(yourUseCasePrompt);
}
```

**Validation:**
- [ ] Template registered successfully
- [ ] No registration errors
- [ ] Template retrievable via promptManager.get()

#### Step 4: Create MCP Server Integration (15 minutes)

```typescript
// backend/src/mcp/yourUseCaseMcpServer.ts
export class YourUseCaseMcpServer {
  async handleRequest(
    userMessage: string,
    userId: string,
    faxJobId: string
  ): Promise<YourUseCaseResponse> {
    const systemPrompt = promptManager.buildSystemPrompt('your-use-case');
    
    // Call Gemini with JSON mode
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: promptManager.get('your-use-case').jsonSchema
      }
    });
    
    const result = await model.generateContent(userMessage);
    const responseText = result.response.text();
    
    // Validate and process
    const validated = await promptManager.validateOutput('your-use-case', responseText);
    
    if (validated.insights) {
      await userInsightsService.processInsights(userId, validated.insights, faxJobId);
    }
    
    return validated;
  }
}
```

**Validation:**
- [ ] MCP server compiles
- [ ] Gemini integration correct
- [ ] Validation implemented
- [ ] Insights processing included

#### Step 5: Write Tests (5 minutes)

```typescript
// backend/src/test/integration/yourUseCaseWithInsights.test.ts
describe('Your Use Case with Insights', () => {
  it('should handle request and extract insights', async () => {
    const server = new YourUseCaseMcpServer();
    const response = await server.handleRequest(
      'Test request',
      'test-user-id',
      'test-fax-job-id'
    );
    
    expect(response.intent).toBeDefined();
    expect(response.response).toBeDefined();
    expect(response.insights).toBeDefined();
  });
});
```

**Validation:**
- [ ] Tests pass
- [ ] Schema validation tested
- [ ] Insights extraction tested
- [ ] Error cases covered

#### Step 6: Deploy and Monitor

```bash
# Deploy to production
npm run build
npm run deploy

# Monitor metrics
curl http://localhost:3000/api/monitoring/prompts/dashboard
```

**Validation:**
- [ ] Deployment successful
- [ ] No errors in logs
- [ ] Validation success rate > 95%
- [ ] Insights extraction working
- [ ] Performance within targets

### Checklist

- [ ] Schema defined and validated
- [ ] Prompt template created
- [ ] Template registered
- [ ] MCP server integration complete
- [ ] Tests written and passing
- [ ] Deployed to production
- [ ] Monitoring configured
- [ ] Documentation updated

### Time Estimate
Total: ~60 minutes

---

## Emergency Procedures

### Complete System Failure

#### Symptoms
- All use cases failing
- No responses generated
- Database connection errors
- Gemini API errors

#### Immediate Actions

1. **Check System Status**
```bash
# Check if services are running
docker-compose ps

# Check logs
docker-compose logs backend | tail -100
```

2. **Restart Services**
```bash
# Restart backend
docker-compose restart backend

# Or full restart
docker-compose down && docker-compose up -d
```

3. **Verify External Dependencies**
```bash
# Check Gemini API
curl https://generativelanguage.googleapis.com/v1/models

# Check database
psql -d faxi -c "SELECT 1;"
```

4. **Enable Fallback Mode**
```typescript
// In backend/src/config/index.ts
export const config = {
  // ...
  fallbackMode: true, // Disable structured outputs temporarily
  useLegacyPrompts: true // Use old generic prompts
};
```

5. **Notify Stakeholders**
- Post incident status
- Estimate recovery time
- Provide updates every 30 minutes

### Rollback Procedure

If a recent deployment caused issues:

```bash
# Rollback to previous version
git revert HEAD
npm run build
npm run deploy

# Or use Docker tags
docker-compose down
docker-compose up -d backend:previous-tag
```

### Contact Information

- **On-Call Engineer**: [Contact info]
- **Gemini API Support**: [Support link]
- **Database Admin**: [Contact info]

---

## Appendix

### Useful Commands

```bash
# Check validation success rate
curl http://localhost:3000/api/monitoring/prompts/validation/qa

# Check insights extraction
curl http://localhost:3000/api/monitoring/prompts/insights/qa

# Check performance
curl http://localhost:3000/api/monitoring/prompts/performance/qa

# Export all metrics
curl http://localhost:3000/api/monitoring/prompts/export > metrics.json

# Health check
curl http://localhost:3000/api/monitoring/prompts/health
```

### Log Locations

- Application logs: `backend/logs/app.log`
- Error logs: `backend/logs/error.log`
- Monitoring dashboard: `http://localhost:3000/prompt-monitoring-dashboard.html`

### Key Thresholds

- Validation success rate: ≥ 95%
- Error rate: < 5%
- Response time: < 5000ms
- Validation time: < 100ms
- Insights extraction rate: ≥ 80%
- Confidence scores: ≥ 0.6

---

## Version History

- v1.0 (2025-01-25): Initial runbooks

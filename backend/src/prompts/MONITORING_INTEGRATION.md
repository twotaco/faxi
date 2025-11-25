# Monitoring Integration Guide

## Quick Start

This guide shows how to integrate the prompt monitoring system into your Express application.

## Step 1: Add Routes to Express App

Add these routes to your main Express app in `backend/src/index.ts`:

```typescript
import * as monitoringController from './webhooks/monitoringController.js';

// Prompt Monitoring Endpoints
app.get('/api/monitoring/prompts/dashboard', monitoringController.getPromptDashboard);
app.get('/api/monitoring/prompts/validation/:useCase', monitoringController.getValidationMetrics);
app.get('/api/monitoring/prompts/insights/:useCase', monitoringController.getInsightsMetrics);
app.get('/api/monitoring/prompts/performance/:useCase', monitoringController.getPerformanceMetrics);
app.get('/api/monitoring/prompts/errors/:useCase', monitoringController.getErrorMetrics);
app.get('/api/monitoring/prompts/export', monitoringController.exportMetrics);
app.get('/api/monitoring/prompts/health', monitoringController.getHealthStatus);
```

## Step 2: Update MCP Servers to Record Metrics

Update your MCP servers to pass `userId` and `faxJobId` to validation:

### Example: AI Chat MCP Server

```typescript
// In backend/src/mcp/aiChatMcpServer.ts

async handleRequest(userMessage: string, userId: string, faxJobId: string) {
  const startTime = Date.now();
  
  try {
    // Call Gemini
    const result = await model.generateContent(userMessage);
    const responseText = result.response.text();
    
    // Record LLM call performance
    promptMonitoringService.recordPerformance({
      useCase: 'qa',
      operation: 'llm_call',
      durationMs: Date.now() - startTime,
      timestamp: new Date(),
      userId,
      faxJobId
    });
    
    // Validate with monitoring (automatically records metrics)
    const validated = await handleLLMResponse(
      'qa',
      responseText,
      undefined, // retry callback
      {}, // config
      undefined, // manager
      userId, // Pass userId
      faxJobId // Pass faxJobId
    );
    
    if (!validated.success) {
      throw validated.error;
    }
    
    // Process insights
    if (validated.data.insights) {
      const insightsStart = Date.now();
      
      await userInsightsService.processInsights(
        userId,
        validated.data.insights,
        faxJobId
      );
      
      // Record insights metrics
      promptMonitoringService.recordInsights({
        useCase: 'qa',
        userId,
        faxJobId,
        insightsExtracted: true,
        confidenceScores: validated.data.insights.confidenceScores || {},
        fieldsExtracted: Object.keys(validated.data.insights),
        timestamp: new Date()
      });
      
      // Record insights processing performance
      promptMonitoringService.recordPerformance({
        useCase: 'qa',
        operation: 'insights_processing',
        durationMs: Date.now() - insightsStart,
        timestamp: new Date(),
        userId,
        faxJobId
      });
    }
    
    return validated.data;
    
  } catch (error) {
    // Record error
    promptMonitoringService.recordError({
      useCase: 'qa',
      errorType: error instanceof SchemaValidationError ? 'validation_failure' : 'llm_error',
      errorMessage: error.message,
      retryCount: 0,
      resolved: false,
      timestamp: new Date(),
      userId,
      faxJobId
    });
    
    throw error;
  }
}
```

## Step 3: Access the Dashboard

Once integrated, access the monitoring dashboard at:

```
http://localhost:3000/prompt-monitoring-dashboard.html
```

## Step 4: Set Up Alerts (Optional)

### Email Alerts

```typescript
// In backend/src/services/promptMonitoringService.ts

import { emailService } from './emailService.js';

private async sendAlert(alert: {
  type: 'validation' | 'error' | 'performance';
  useCase: string;
  message: string;
  severity: 'warning' | 'critical';
}): Promise<void> {
  await emailService.sendEmail({
    to: 'ops-team@example.com',
    subject: `[${alert.severity.toUpperCase()}] Prompt System Alert: ${alert.type}`,
    body: `
      Use Case: ${alert.useCase}
      Type: ${alert.type}
      Severity: ${alert.severity}
      
      ${alert.message}
      
      Dashboard: http://localhost:3000/prompt-monitoring-dashboard.html
    `
  });
}

// Call in threshold check methods
private checkValidationThreshold(useCase: string): void {
  const successRate = this.getValidationSuccessRate(useCase, 3600000);
  const threshold = 0.95;

  if (successRate < threshold) {
    this.sendAlert({
      type: 'validation',
      useCase,
      message: `Validation success rate (${(successRate * 100).toFixed(1)}%) below threshold (${threshold * 100}%)`,
      severity: 'warning'
    });
  }
}
```

### Slack Alerts

```typescript
import axios from 'axios';

private async sendSlackAlert(message: string): Promise<void> {
  await axios.post(process.env.SLACK_WEBHOOK_URL!, {
    text: message,
    username: 'Prompt Monitor',
    icon_emoji: ':warning:'
  });
}
```

## Step 5: Export to External Monitoring (Optional)

### Prometheus Integration

```typescript
// backend/src/webhooks/monitoringController.ts

export async function getPrometheusMetrics(req: Request, res: Response): Promise<void> {
  const metrics = promptMonitoringService.getDashboardMetrics(3600000);
  
  let prometheusFormat = '';
  
  // Validation success rate
  prometheusFormat += `# HELP prompt_validation_success_rate Validation success rate by use case\n`;
  prometheusFormat += `# TYPE prompt_validation_success_rate gauge\n`;
  for (const [useCase, data] of Object.entries(metrics.useCases)) {
    prometheusFormat += `prompt_validation_success_rate{use_case="${useCase}"} ${data.validationSuccessRate}\n`;
  }
  
  // Error rate
  prometheusFormat += `# HELP prompt_error_rate Error rate by use case\n`;
  prometheusFormat += `# TYPE prompt_error_rate gauge\n`;
  for (const [useCase, data] of Object.entries(metrics.useCases)) {
    prometheusFormat += `prompt_error_rate{use_case="${useCase}"} ${data.errorRate}\n`;
  }
  
  // Response time
  prometheusFormat += `# HELP prompt_response_time_ms Average response time in milliseconds\n`;
  prometheusFormat += `# TYPE prompt_response_time_ms gauge\n`;
  for (const [useCase, data] of Object.entries(metrics.useCases)) {
    prometheusFormat += `prompt_response_time_ms{use_case="${useCase}"} ${data.averageResponseTime}\n`;
  }
  
  res.set('Content-Type', 'text/plain');
  res.send(prometheusFormat);
}

// Add route
app.get('/metrics/prompts', monitoringController.getPrometheusMetrics);
```

## Testing

### Test Monitoring Endpoints

```bash
# Test dashboard endpoint
curl http://localhost:3000/api/monitoring/prompts/dashboard | jq

# Test validation metrics
curl http://localhost:3000/api/monitoring/prompts/validation/qa | jq

# Test health check
curl http://localhost:3000/api/monitoring/prompts/health | jq
```

### Test Dashboard UI

1. Open browser to `http://localhost:3000/prompt-monitoring-dashboard.html`
2. Verify metrics display
3. Change time window
4. Click refresh button
5. Verify auto-refresh works

### Generate Test Metrics

```typescript
// Test script: backend/src/test/testMonitoring.ts
import { promptMonitoringService } from '../services/promptMonitoringService';

// Record some test metrics
for (let i = 0; i < 100; i++) {
  promptMonitoringService.recordValidation({
    useCase: 'qa',
    success: Math.random() > 0.05, // 95% success rate
    attemptNumber: 1,
    timestamp: new Date()
  });
  
  promptMonitoringService.recordPerformance({
    useCase: 'qa',
    operation: 'total',
    durationMs: 2000 + Math.random() * 2000, // 2-4 seconds
    timestamp: new Date()
  });
}

console.log('Test metrics generated');
```

## Troubleshooting

### Dashboard Not Loading

1. Check if backend is running: `curl http://localhost:3000/api/monitoring/prompts/health`
2. Check browser console for errors
3. Verify routes are registered in Express app

### No Metrics Showing

1. Verify MCP servers are recording metrics
2. Check if validation is passing `userId` and `faxJobId`
3. Generate test metrics with script above
4. Check time window selection (metrics only retained for 24 hours)

### High Memory Usage

The monitoring service stores metrics in memory. If memory usage is high:

1. Reduce retention period in `promptMonitoringService.ts`:
```typescript
private readonly RETENTION_MS = 12 * 60 * 60 * 1000; // 12 hours instead of 24
```

2. Or export metrics to external system and clear:
```typescript
// Periodically export and reset
setInterval(() => {
  const metrics = promptMonitoringService.exportMetrics();
  // Send to external system
  sendToExternalMonitoring(metrics);
  // Reset
  promptMonitoringService.reset();
}, 3600000); // Every hour
```

## Best Practices

1. **Always pass userId and faxJobId** to validation for better tracking
2. **Record performance metrics** for all major operations
3. **Set up alerts** for critical thresholds
4. **Export metrics** to external system for long-term storage
5. **Monitor the dashboard** regularly during development
6. **Review runbooks** when issues occur

## Support

For issues or questions:
- Check `RUNBOOKS.md` for common issues
- Review `PROMPT_ENGINEERING_GUIDE.md` for best practices
- Check application logs: `backend/logs/app.log`

---

**Last Updated:** January 25, 2025

import { loggingService } from './loggingService';
import { monitoringService } from './monitoringService';
import { config } from '../config';

interface AlertChannel {
  name: string;
  type: 'email' | 'webhook' | 'slack' | 'pagerduty' | 'console';
  config: Record<string, any>;
  enabled: boolean;
}

interface Alert {
  id: string;
  name: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  condition: string; // JavaScript expression
  cooldownMinutes: number;
  channels: string[]; // Channel names
  enabled: boolean;
  lastTriggered?: Date;
  lastResolved?: Date;
}

class AlertingService {
  private static instance: AlertingService;
  private channels: Map<string, AlertChannel> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];

  private constructor() {
    this.setupDefaultChannels();
    this.setupDefaultRules();
    this.startAlertMonitoring();
  }

  public static getInstance(): AlertingService {
    if (!AlertingService.instance) {
      AlertingService.instance = new AlertingService();
    }
    return AlertingService.instance;
  }

  /**
   * Add or update an alert channel
   */
  public addChannel(channel: AlertChannel): void {
    this.channels.set(channel.name, channel);
    loggingService.info(`Alert channel added: ${channel.name}`, {}, { channelType: channel.type });
  }

  /**
   * Add or update an alert rule
   */
  public addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    loggingService.info(`Alert rule added: ${rule.name}`, {}, { 
      ruleId: rule.id, 
      severity: rule.severity 
    });
  }

  /**
   * Trigger an alert
   */
  public async triggerAlert(
    ruleId: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule || !rule.enabled) {
      return;
    }

    // Check cooldown
    if (rule.lastTriggered) {
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      if (Date.now() - rule.lastTriggered.getTime() < cooldownMs) {
        return;
      }
    }

    const alert: Alert = {
      id: `${ruleId}-${Date.now()}`,
      name: rule.name,
      severity: rule.severity,
      message,
      timestamp: new Date(),
      resolved: false,
      metadata,
    };

    this.activeAlerts.set(alert.id, alert);
    this.alertHistory.push(alert);
    rule.lastTriggered = new Date();

    // Send to configured channels
    await this.sendAlert(alert, rule.channels);

    loggingService.error(`Alert triggered: ${rule.name}`, undefined, {}, {
      alertId: alert.id,
      ruleId,
      severity: rule.severity,
      metadata,
    });
  }

  /**
   * Resolve an alert
   */
  public async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    this.activeAlerts.delete(alertId);

    // Find the rule and update last resolved time
    const rule = Array.from(this.rules.values()).find(r => alert.name === r.name);
    if (rule) {
      rule.lastResolved = new Date();
    }

    loggingService.info(`Alert resolved: ${alert.name}`, {}, {
      alertId,
      duration: alert.resolvedAt.getTime() - alert.timestamp.getTime(),
    });
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  public getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Get alert statistics
   */
  public getAlertStatistics(timeRange: { start: Date; end: Date }): {
    totalAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
    infoAlerts: number;
    averageResolutionTime: number;
    alertsByRule: Array<{ ruleName: string; count: number }>;
  } {
    const alertsInRange = this.alertHistory.filter(
      alert => alert.timestamp >= timeRange.start && alert.timestamp <= timeRange.end
    );

    const resolvedAlerts = alertsInRange.filter(alert => alert.resolved && alert.resolvedAt);
    const totalResolutionTime = resolvedAlerts.reduce((sum, alert) => {
      return sum + (alert.resolvedAt!.getTime() - alert.timestamp.getTime());
    }, 0);

    const alertsByRule = new Map<string, number>();
    alertsInRange.forEach(alert => {
      const count = alertsByRule.get(alert.name) || 0;
      alertsByRule.set(alert.name, count + 1);
    });

    return {
      totalAlerts: alertsInRange.length,
      criticalAlerts: alertsInRange.filter(a => a.severity === 'critical').length,
      warningAlerts: alertsInRange.filter(a => a.severity === 'warning').length,
      infoAlerts: alertsInRange.filter(a => a.severity === 'info').length,
      averageResolutionTime: resolvedAlerts.length > 0 ? totalResolutionTime / resolvedAlerts.length : 0,
      alertsByRule: Array.from(alertsByRule.entries()).map(([ruleName, count]) => ({
        ruleName,
        count,
      })),
    };
  }

  private setupDefaultChannels(): void {
    // Console channel (always available)
    this.addChannel({
      name: 'console',
      type: 'console',
      config: {},
      enabled: true,
    });

    // Email channel (if configured)
    if (config.alerts?.email?.enabled) {
      this.addChannel({
        name: 'email',
        type: 'email',
        config: {
          smtpHost: config.alerts.email.smtpHost,
          smtpPort: config.alerts.email.smtpPort,
          username: config.alerts.email.username,
          password: config.alerts.email.password,
          from: config.alerts.email.from,
          to: config.alerts.email.to,
        },
        enabled: true,
      });
    }

    // Slack channel (if configured)
    if (config.alerts?.slack?.enabled) {
      this.addChannel({
        name: 'slack',
        type: 'slack',
        config: {
          webhookUrl: config.alerts.slack.webhookUrl,
          channel: config.alerts.slack.channel,
        },
        enabled: true,
      });
    }

    // PagerDuty channel (if configured)
    if (config.alerts?.pagerduty?.enabled) {
      this.addChannel({
        name: 'pagerduty',
        type: 'pagerduty',
        config: {
          integrationKey: config.alerts.pagerduty.integrationKey,
        },
        enabled: true,
      });
    }
  }

  private setupDefaultRules(): void {
    this.addRule({
      id: 'database-down',
      name: 'Database Down',
      description: 'Database connection is down',
      severity: 'critical',
      condition: 'healthStatus.services.database === "down"',
      cooldownMinutes: 1,
      channels: ['console', 'email', 'pagerduty'],
      enabled: true,
    });

    this.addRule({
      id: 'redis-down',
      name: 'Redis Down',
      description: 'Redis connection is down',
      severity: 'critical',
      condition: 'healthStatus.services.redis === "down"',
      cooldownMinutes: 1,
      channels: ['console', 'email', 'pagerduty'],
      enabled: true,
    });

    this.addRule({
      id: 'high-error-rate',
      name: 'High Error Rate',
      description: 'HTTP error rate is above 10%',
      severity: 'warning',
      condition: 'metrics.errorRate > 0.1',
      cooldownMinutes: 5,
      channels: ['console', 'slack'],
      enabled: true,
    });

    this.addRule({
      id: 'high-memory-usage',
      name: 'High Memory Usage',
      description: 'Memory usage is above 90%',
      severity: 'warning',
      condition: 'healthStatus.metrics.memoryUsage.heapUsed / healthStatus.metrics.memoryUsage.heapTotal > 0.9',
      cooldownMinutes: 10,
      channels: ['console', 'slack'],
      enabled: true,
    });

    this.addRule({
      id: 'queue-backlog',
      name: 'Queue Backlog',
      description: 'Fax processing queue has large backlog',
      severity: 'warning',
      condition: 'healthStatus.metrics.queueSizes.faxProcessing + healthStatus.metrics.queueSizes.emailToFax > 100',
      cooldownMinutes: 15,
      channels: ['console', 'slack'],
      enabled: true,
    });

    this.addRule({
      id: 'fax-processing-failures',
      name: 'Fax Processing Failures',
      description: 'High rate of fax processing failures',
      severity: 'warning',
      condition: 'metrics.faxFailureRate > 0.2',
      cooldownMinutes: 10,
      channels: ['console', 'email'],
      enabled: true,
    });

    // Email quality monitoring rules
    this.addRule({
      id: 'email-high-bounce-rate',
      name: 'High Email Bounce Rate',
      description: 'Email bounce rate exceeds 5%',
      severity: 'warning',
      condition: 'metrics.emailBounceRate > 0.05',
      cooldownMinutes: 60,
      channels: ['console', 'email'],
      enabled: true,
    });

    this.addRule({
      id: 'email-high-complaint-rate',
      name: 'High Email Complaint Rate',
      description: 'Email complaint rate exceeds 0.1%',
      severity: 'critical',
      condition: 'metrics.emailComplaintRate > 0.001',
      cooldownMinutes: 30,
      channels: ['console', 'email', 'pagerduty'],
      enabled: true,
    });

    this.addRule({
      id: 'email-low-delivery-rate',
      name: 'Low Email Delivery Rate',
      description: 'Email delivery rate below 95%',
      severity: 'warning',
      condition: 'metrics.emailDeliveryRate < 0.95',
      cooldownMinutes: 60,
      channels: ['console', 'email'],
      enabled: true,
    });

    this.addRule({
      id: 'email-quality-issue',
      name: 'Email Quality Issue',
      description: 'General email quality issue detected',
      severity: 'warning',
      condition: 'false', // Manually triggered only
      cooldownMinutes: 60,
      channels: ['console', 'email'],
      enabled: true,
    });
  }

  private async sendAlert(alert: Alert, channelNames: string[]): Promise<void> {
    const promises = channelNames.map(async (channelName) => {
      const channel = this.channels.get(channelName);
      if (!channel || !channel.enabled) {
        return;
      }

      try {
        await this.sendToChannel(alert, channel);
      } catch (error) {
        loggingService.error(`Failed to send alert to channel ${channelName}`, error as Error, {}, {
          alertId: alert.id,
          channelName,
        });
      }
    });

    await Promise.allSettled(promises);
  }

  private async sendToChannel(alert: Alert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'console':
        console.error(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`, {
          alertId: alert.id,
          timestamp: alert.timestamp.toISOString(),
          metadata: alert.metadata,
        });
        break;

      case 'email':
        // In production, implement email sending
        console.log(`📧 Would send email alert: ${alert.message}`);
        break;

      case 'slack':
        // In production, implement Slack webhook
        console.log(`💬 Would send Slack alert: ${alert.message}`);
        break;

      case 'pagerduty':
        // In production, implement PagerDuty integration
        console.log(`📟 Would send PagerDuty alert: ${alert.message}`);
        break;

      case 'webhook':
        // In production, implement generic webhook
        console.log(`🔗 Would send webhook alert: ${alert.message}`);
        break;

      default:
        loggingService.warn(`Unknown alert channel type: ${channel.type}`);
    }
  }

  private startAlertMonitoring(): void {
    // Check alert conditions every 30 seconds
    setInterval(async () => {
      try {
        await this.evaluateAlertRules();
      } catch (error) {
        loggingService.error('Alert monitoring error', error as Error);
      }
    }, 30000);

    // Clean up old alert history every hour
    setInterval(() => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      this.alertHistory = this.alertHistory.filter(alert => alert.timestamp > oneWeekAgo);
    }, 60 * 60 * 1000);
  }

  private async evaluateAlertRules(): Promise<void> {
    const healthStatus = await monitoringService.getHealthStatus();
    
    // Calculate additional metrics for alert conditions
    const metrics = {
      errorRate: 0, // This would be calculated from monitoring service
      faxFailureRate: 0, // This would be calculated from fax processing stats
    };

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      try {
        // Create evaluation context
        const context = {
          healthStatus,
          metrics,
          Date,
          Math,
        };

        // Evaluate the condition (in production, use a safer evaluation method)
        const conditionResult = this.evaluateCondition(rule.condition, context);
        
        if (conditionResult) {
          await this.triggerAlert(rule.id, `${rule.description} - ${rule.condition}`, {
            healthStatus,
            metrics,
          });
        }
      } catch (error) {
        loggingService.error(`Failed to evaluate alert rule: ${rule.name}`, error as Error, {}, {
          ruleId: rule.id,
          condition: rule.condition,
        });
      }
    }
  }

  private evaluateCondition(condition: string, context: any): boolean {
    try {
      // Simple condition evaluation - in production, use a safer method
      // like a proper expression parser or sandboxed evaluation
      const func = new Function('healthStatus', 'metrics', 'Date', 'Math', `return ${condition}`);
      return func(context.healthStatus, context.metrics, context.Date, context.Math);
    } catch (error) {
      loggingService.error('Failed to evaluate alert condition', error as Error, {}, { condition });
      return false;
    }
  }
}

export const alertingService = AlertingService.getInstance();
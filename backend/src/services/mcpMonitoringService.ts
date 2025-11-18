import { db } from '../database/connection';

export class MCPMonitoringService {
  async getServerStats() {
    const servers = ['email', 'shopping', 'payment', 'ai_chat', 'user_profile'];
    
    const stats = await Promise.all(
      servers.map(async (server) => {
        const result = await db.query(
          `SELECT 
             COUNT(*) as total_calls,
             COUNT(*) FILTER (WHERE event_data->>'success' = 'true') as successful_calls,
             AVG(CAST(event_data->>'duration' AS FLOAT)) as avg_response_time
           FROM audit_logs
           WHERE event_type = 'mcp.tool_call' 
           AND event_data->>'toolServer' = $1
           AND created_at > NOW() - INTERVAL '1 hour'`,
          [server]
        );

        const row = result.rows[0];
        return {
          name: server,
          status: 'up',
          totalCalls: parseInt(row.total_calls, 10),
          successRate: row.total_calls > 0 
            ? (parseInt(row.successful_calls, 10) / parseInt(row.total_calls, 10)) * 100 
            : 100,
          avgResponseTime: parseFloat(row.avg_response_time) || 0,
        };
      })
    );

    return stats;
  }

  async getExternalAPIHealth() {
    return [
      { name: 'Telnyx', status: 'up', rateLimit: 85 },
      { name: 'Stripe', status: 'up', rateLimit: 45 },
      { name: 'Gemini', status: 'up', rateLimit: 92 },
      { name: 'Amazon', status: 'up', rateLimit: 30 },
    ];
  }
}

export const mcpMonitoringService = new MCPMonitoringService();

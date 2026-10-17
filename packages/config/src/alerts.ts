export interface AlertRule {
  alert: string;
  expr: string;
  forDuration: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  actionRequired: string;
}

/**
 * Standard Prometheus Alerting Rules for ChatPilot (ARCHITECTURE.md §11.4, IMPLEMENTATION_PLAN.md Phase P9)
 */
export const PROMETHEUS_ALERT_RULES: AlertRule[] = [
  {
    alert: 'HighBullMqQueueDepth',
    expr: 'bullmq_queue_depth > 100',
    forDuration: '5m',
    severity: 'warning',
    description: 'BullMQ queue depth exceeds 100 jobs for more than 5 minutes.',
    actionRequired: 'Scale worker container instances or investigate job deadlocks.',
  },
  {
    alert: 'CriticalBullMqQueueDepth',
    expr: 'bullmq_queue_depth > 500',
    forDuration: '2m',
    severity: 'critical',
    description: 'BullMQ queue depth critical (> 500 jobs backlog).',
    actionRequired: 'Immediate worker scaling required; check Redis latency and external provider timeouts.',
  },
  {
    alert: 'SlowWebhookIngress',
    expr: 'http_request_duration_seconds{path=~".*/webhooks/.*", quantile="0.99"} > 2.0',
    forDuration: '3m',
    severity: 'warning',
    description: 'WhatsApp webhook acknowledgment P99 latency exceeds 2 seconds threshold.',
    actionRequired: 'Verify Redis queue dispatch and database pre-auth lookup performance.',
  },
  {
    alert: 'SlowAiCompletion',
    expr: 'ai_request_duration_seconds{quantile="0.95"} > 8.0',
    forDuration: '5m',
    severity: 'warning',
    description: 'P95 AI turn completion duration exceeds 8 seconds.',
    actionRequired: 'Check Gemini/OpenAI rate limits, failover to secondary provider if elevated.',
  },
  {
    alert: 'GucMissingIntegrityViolation',
    expr: 'increase(chatpilot_guc_missing_errors_total[1m]) > 0',
    forDuration: '0m',
    severity: 'critical',
    description: 'A query was attempted without valid transaction-local tenant GUC context.',
    actionRequired: 'Security incident: check application logs for bypassed ScopedPrisma wrapper.',
  },
  {
    alert: 'HighHttp5xxErrorRate',
    expr: 'rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01',
    forDuration: '5m',
    severity: 'critical',
    description: 'HTTP 5xx server error rate exceeds 1% of all inbound traffic.',
    actionRequired: 'Inspect application error logs and database connection pool saturation.',
  },
];

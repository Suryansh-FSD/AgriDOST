import { NextResponse } from 'next/server';
import { getN8nConfig } from '@/lib/n8n/storage';
import { getWebhookUrlForEvent } from '@/lib/n8n/client';

/**
 * GET /api/n8n/status
 * Returns n8n gateway configuration, simulated mode status, active webhook endpoints,
 * and connectivity health information.
 */
export async function GET() {
  const config = getN8nConfig();
  const simulated =
    process.env.N8N_SIMULATED_MODE === 'true' ||
    config.simulatedMode ||
    !process.env.N8N_WEBHOOK_URL;

  const workflows = [
    {
      id: 'government-assistance',
      name: 'Government Assistance Deadlines & Renewals',
      webhookUrl: getWebhookUrlForEvent('government.application.created', config.webhookBaseUrl),
      events: [
        'government.application.created',
        'government.application.status_changed',
        'government.deadline.approaching',
        'government.reminder.triggered',
      ],
      active: true,
    },
    {
      id: 'smart-farm-operations',
      name: 'Smart Farm Operations & Weather Guard',
      webhookUrl: getWebhookUrlForEvent('operations.weather.check_requested', config.webhookBaseUrl),
      events: [
        'operations.weather.check_requested',
        'operations.spray.window_evaluation',
        'operations.irrigation.advisory',
      ],
      active: true,
    },
    {
      id: 'market-intelligence',
      name: 'Market Intelligence & Mandi Price Advisory',
      webhookUrl: getWebhookUrlForEvent('market.price.check_requested', config.webhookBaseUrl),
      events: [
        'market.price.check_requested',
        'market.harvest.recorded',
        'market.advisory.generated',
      ],
      active: true,
    },
  ];

  return NextResponse.json({
    status: 'online',
    mode: simulated ? 'simulated' : 'live',
    simulated,
    webhookBaseUrl: config.webhookBaseUrl,
    apiKeyConfigured: Boolean(config.apiKey && !config.apiKey.includes('placeholder')),
    webhookSecretConfigured: Boolean(config.webhookSecret),
    workflows,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
}

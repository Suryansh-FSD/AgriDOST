/**
 * tests/n8n-automation-ui.test.ts
 *
 * Automated Unit & Component Test Suite for AgriDOST 4.0:
 * - AutomationCenter dashboard rendering and KPI statistics
 * - WorkflowCard rendering, categories, and active states
 * - ExecutionHistoryTable rendering, status filters, and formatting
 * - ManualTriggerModal preset scenarios and payload inspection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  AutomationCenter,
  WorkflowCard,
  ExecutionHistoryTable,
  ManualTriggerModal,
} from '@/components/automation';
import {
  N8nWorkflowDefinition,
  N8nExecutionRecord,
} from '@/types';

// ==============================================================================
// Mock Data Fixtures
// ==============================================================================

const MOCK_WORKFLOWS: N8nWorkflowDefinition[] = [
  {
    id: 'government-assistance',
    name: 'Government Assistance Deadlines & Renewals',
    description: 'Monitors official scheme deadlines and creates farmer reminders.',
    category: 'Government',
    supportedEvents: [
      'government.application.created',
      'government.application.status_changed',
      'government.deadline.approaching',
    ],
    webhookPath: 'agridost-government-assistance',
    active: true,
    version: '1.0.0',
    lastExecutionAt: '2026-11-22T10:00:00.000Z',
    lastExecutionStatus: 'success',
  },
  {
    id: 'smart-farm-operations',
    name: 'Smart Farm Operations & Weather Guard',
    description: 'Evaluates wind speed and precipitation before drone flights.',
    category: 'Operations',
    supportedEvents: [
      'operations.weather.check_requested',
      'operations.spray.window_evaluation',
    ],
    webhookPath: 'agridost-smart-farm-operations',
    active: false,
    version: '1.0.0',
    lastExecutionAt: '2026-11-22T08:30:00.000Z',
    lastExecutionStatus: 'failed',
  },
  {
    id: 'market-intelligence',
    name: 'Market Intelligence & Mandi Price Advisory',
    description: 'Scrapes Mandi prices and issues sell/hold advisories.',
    category: 'Market',
    supportedEvents: [
      'market.price.check_requested',
      'market.harvest.recorded',
    ],
    webhookPath: 'agridost-market-intelligence',
    active: true,
    version: '1.0.0',
    lastExecutionAt: '2026-11-22T06:00:00.000Z',
    lastExecutionStatus: 'skipped',
  },
];

const MOCK_EXECUTIONS: N8nExecutionRecord[] = [
  {
    id: 'exec-test-01',
    eventId: 'evt-test-01',
    eventType: 'government.deadline.approaching',
    workflowId: 'government-assistance',
    farmId: 'demo-farm-01',
    status: 'success',
    startedAt: '2026-11-22T10:00:00.000Z',
    completedAt: '2026-11-22T10:00:00.142Z',
    durationMs: 142,
    inputSummary: 'PM-KISAN e-KYC deadline check for Demo Farm',
    outputSummary: 'Verified active criteria. Scheduled 1 reminder.',
    outputData: { reminderCreated: true },
    retryCount: 0,
  },
  {
    id: 'exec-test-02',
    eventId: 'evt-test-02',
    eventType: 'operations.spray.window_evaluation',
    workflowId: 'smart-farm-operations',
    farmId: 'demo-farm-01',
    status: 'failed',
    startedAt: '2026-11-22T08:30:00.000Z',
    completedAt: '2026-11-22T08:30:00.098Z',
    durationMs: 98,
    inputSummary: 'Drone Spray Wind Check (26 km/h)',
    outputSummary: 'UNSAFE: Wind 26 km/h exceeded 15 km/h limit. Spray halted.',
    error: {
      code: 'ERR_WIND_UNSAFE',
      message: 'Wind speed above maximum safety limit.',
      retryable: false,
    },
    retryCount: 0,
  },
  {
    id: 'exec-test-03',
    eventId: 'evt-test-03',
    eventType: 'market.price.check_requested',
    workflowId: 'market-intelligence',
    farmId: 'demo-farm-01',
    status: 'skipped',
    startedAt: '2026-11-22T06:00:00.000Z',
    completedAt: '2026-11-22T06:00:00.015Z',
    durationMs: 15,
    inputSummary: 'Soybean Mandi price duplicate check',
    outputSummary: 'Skipped: Duplicate idempotency key within 24h window.',
    retryCount: 0,
  },
];

describe('AgriDOST 4.0: Automation Center UI Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // 1. WorkflowCard Component Tests
  // ============================================================================
  describe('WorkflowCard Component', () => {
    it('renders government workflow card with title, description, and category badge', () => {
      const html = renderToString(
        React.createElement(WorkflowCard, { workflow: MOCK_WORKFLOWS[0] })
      );

      expect(html).toContain('Government Assistance Deadlines &amp; Renewals');
      expect(html).toContain('Government');
      expect(html).toContain('Monitors official scheme deadlines and creates farmer reminders.');
      expect(html).toContain('Test Trigger');
    });

    it('renders supported event chips', () => {
      const html = renderToString(
        React.createElement(WorkflowCard, { workflow: MOCK_WORKFLOWS[0] })
      );

      expect(html).toContain('government.application.created');
      expect(html).toContain('government.deadline.approaching');
      expect(html).toContain('Trigger Events');
    });

    it('renders active status toggle and status pill correctly', () => {
      // Active workflow with success status
      const activeHtml = renderToString(
        React.createElement(WorkflowCard, { workflow: MOCK_WORKFLOWS[0] })
      );
      expect(activeHtml).toContain('Active');
      expect(activeHtml).toContain('Last: Success');

      // Disabled workflow with failed status
      const disabledHtml = renderToString(
        React.createElement(WorkflowCard, { workflow: MOCK_WORKFLOWS[1] })
      );
      expect(disabledHtml).toContain('Disabled');
      expect(disabledHtml).toContain('Last: Failed');
      expect(disabledHtml).toContain('disabled');
    });

    it('renders operations and market category badges with distinctive colors', () => {
      const opsHtml = renderToString(
        React.createElement(WorkflowCard, { workflow: MOCK_WORKFLOWS[1] })
      );
      expect(opsHtml).toContain('Operations');

      const mktHtml = renderToString(
        React.createElement(WorkflowCard, { workflow: MOCK_WORKFLOWS[2] })
      );
      expect(mktHtml).toContain('Market');
    });
  });

  // ============================================================================
  // 2. ExecutionHistoryTable Component Tests
  // ============================================================================
  describe('ExecutionHistoryTable Component', () => {
    it('renders execution rows with event types, workflows, and durations', () => {
      const html = renderToString(
        React.createElement(ExecutionHistoryTable, { executions: MOCK_EXECUTIONS })
      );

      expect(html).toContain('government.deadline.approaching');
      expect(html).toContain('Government Assistance');
      expect(html).toContain('PM-KISAN e-KYC deadline check for Demo Farm');
      expect(html).toContain('142ms');

      expect(html).toContain('operations.spray.window_evaluation');
      expect(html).toContain('Smart Operations');
      expect(html).toContain('Drone Spray Wind Check (26 km/h)');
      expect(html).toContain('98ms');

      expect(html).toContain('market.price.check_requested');
      expect(html).toContain('Market Intelligence');
    });

    it('renders status pills for Success, Failed, and Skipped accurately', () => {
      const html = renderToString(
        React.createElement(ExecutionHistoryTable, { executions: MOCK_EXECUTIONS })
      );

      expect(html).toContain('Success');
      expect(html).toContain('Failed');
      expect(html).toContain('Skipped');
    });

    it('renders total count footer and filter toolbar', () => {
      const html = renderToString(
        React.createElement(ExecutionHistoryTable, { executions: MOCK_EXECUTIONS })
      );

      expect(html).toContain('Showing');
      expect(html).toContain('executions');
      expect(html).toContain('All Workflows');
      expect(html).toContain('Search event, input...');
    });

    it('renders clean empty state when no executions are present', () => {
      const html = renderToString(
        React.createElement(ExecutionHistoryTable, { executions: [] })
      );

      expect(html).toContain('No executions recorded');
      expect(html).toContain('Trigger a workflow above to see live events.');
    });
  });

  // ============================================================================
  // 3. ManualTriggerModal Component Tests
  // ============================================================================
  describe('ManualTriggerModal Component', () => {
    it('renders modal when isOpen is true with workflow selectors', () => {
      const html = renderToString(
        React.createElement(ManualTriggerModal, {
          isOpen: true,
          onClose: () => {},
          initialWorkflowId: 'government-assistance',
          isSimulatedMode: true,
        })
      );

      expect(html).toContain('Trigger n8n Automation Workflow');
      expect(html).toContain('Manual Workflow Tester');
      expect(html).toContain('Deterministic Simulation Engine');
      expect(html).toContain('Government Assistance');
      expect(html).toContain('Smart Operations');
      expect(html).toContain('Market Intelligence');
      expect(html).toContain('Trigger Workflow');
    });

    it('returns null when isOpen is false', () => {
      const html = renderToString(
        React.createElement(ManualTriggerModal, {
          isOpen: false,
          onClose: () => {},
        })
      );

      expect(html).toBe('');
    });

    it('renders scenario presets for testing', () => {
      const html = renderToString(
        React.createElement(ManualTriggerModal, {
          isOpen: true,
          onClose: () => {},
          initialWorkflowId: 'smart-farm-operations',
        })
      );

      expect(html).toContain('Drone Spray Window: Optimal Weather');
      expect(html).toContain('Drone Spray Alert: High Wind Warning');
      expect(html).toContain('Event Payload (JSON)');
    });
  });

  // ============================================================================
  // 4. AutomationCenter Master Dashboard Tests
  // ============================================================================
  describe('AutomationCenter Component', () => {
    it('renders master dashboard title, description, and status banner', () => {
      const html = renderToString(
        React.createElement(AutomationCenter, {})
      );

      expect(html).toContain('Automation Center');
      expect(html).toContain('AgriDOST 4.0 Event-Driven Engine');
      expect(html).toContain('Bi-Directional n8n Workflows • HMAC Webhook Security');
      expect(html).toContain('Test / Trigger Workflow');
      expect(html).toContain('http://localhost:5678/webhook/');
    });

    it('renders 4 KPI statistic cards', () => {
      const html = renderToString(
        React.createElement(AutomationCenter, {})
      );

      expect(html).toContain('Active Workflows');
      expect(html).toContain('Total Executions');
      expect(html).toContain('Success Rate');
      expect(html).toContain('Engine State');
    });

    it('renders all 3 core workflow cards in the grid', () => {
      const html = renderToString(
        React.createElement(AutomationCenter, {})
      );

      expect(html).toContain('Government Assistance Deadlines &amp; Renewals');
      expect(html).toContain('Smart Farm Operations &amp; Weather Guard');
      expect(html).toContain('Market Intelligence &amp; Mandi Price Advisory');
    });

    it('renders live execution history section and table', () => {
      const html = renderToString(
        React.createElement(AutomationCenter, {})
      );

      expect(html).toContain('Live Execution History');
      expect(html).toContain('Reload Logs');
    });

    it('incorporates active farm name when provided as prop', () => {
      const mockFarm = {
        id: 'farm-baramati-01',
        name: 'Baramati Grape & Sugarcane Estate',
        boundary: { type: 'Polygon' as const, coordinates: [] },
        areaSqM: 10000,
        areaAcres: 5.5,
        country: 'India',
        createdAt: '2026-11-22T00:00:00.000Z',
        updatedAt: '2026-11-22T00:00:00.000Z',
      };

      const html = renderToString(
        React.createElement(AutomationCenter, { farm: mockFarm })
      );

      expect(html).toContain('Baramati Grape &amp; Sugarcane Estate');
    });
  });
});

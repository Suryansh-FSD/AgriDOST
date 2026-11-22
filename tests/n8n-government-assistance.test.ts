import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  createGovernmentEvent,
  executeGovernmentWorkflow,
  calculateDeadlineProximity,
  formatStatusBadge,
  GovernmentAssistancePayloadSchema,
  GovernmentEventEnvelopeSchema,
} from '@/lib/n8n/workflows/government-assistance';
import { N8nEventEnvelope, GovernmentAssistancePayload } from '@/types';

describe('AgriDOST: Government Assistance Automation (n8n Workflow & Engine)', () => {
  const workflowFilePath = path.resolve(process.cwd(), 'workflows/government-assistance.json');

  describe('1. Workflow JSON Specification & Node Integrity', () => {
    it('should exist and be parseable valid JSON', () => {
      expect(fs.existsSync(workflowFilePath)).toBe(true);
      const rawJson = fs.readFileSync(workflowFilePath, 'utf8');
      expect(() => JSON.parse(rawJson)).not.toThrow();
    });

    it('should contain all required n8n node types: Webhook, Switch, Code, and HTTP Request', () => {
      const rawJson = fs.readFileSync(workflowFilePath, 'utf8');
      const workflow = JSON.parse(rawJson);

      expect(workflow.name).toBeTruthy();
      expect(Array.isArray(workflow.nodes)).toBe(true);
      expect(workflow.nodes.length).toBeGreaterThanOrEqual(4);

      // Verify Webhook Node
      const webhookNode = workflow.nodes.find(
        (n: { type: string }) => n.type === 'n8n-nodes-base.webhook'
      );
      expect(webhookNode).toBeDefined();
      expect(webhookNode.parameters.path).toBe('agridost-government-assistance');
      expect(webhookNode.parameters.httpMethod).toBe('POST');

      // Verify Switch Node
      const switchNode = workflow.nodes.find(
        (n: { type: string }) => n.type === 'n8n-nodes-base.switch'
      );
      expect(switchNode).toBeDefined();
      const rules = switchNode.parameters?.rules?.values || [];
      const ruleConditions = JSON.stringify(rules);
      expect(ruleConditions).toContain('government.application.created');
      expect(ruleConditions).toContain('government.application.status_changed');
      expect(ruleConditions).toContain('government.deadline.approaching');
      expect(ruleConditions).toContain('government.reminder.triggered');

      // Verify Code / Function Nodes
      const codeNodes = workflow.nodes.filter(
        (n: { type: string }) => n.type === 'n8n-nodes-base.code'
      );
      expect(codeNodes.length).toBeGreaterThanOrEqual(3);

      // Verify HTTP Request Node for Callbacks
      const httpNode = workflow.nodes.find(
        (n: { type: string }) => n.type === 'n8n-nodes-base.httpRequest'
      );
      expect(httpNode).toBeDefined();
      expect(httpNode.parameters.method).toBe('POST');
      expect(httpNode.parameters.url).toContain('callback');
    });

    it('should contain valid node connection topology', () => {
      const rawJson = fs.readFileSync(workflowFilePath, 'utf8');
      const workflow = JSON.parse(rawJson);

      expect(workflow.connections).toBeDefined();
      expect(workflow.connections['Webhook: Government Assistance']).toBeDefined();
      expect(workflow.connections['Switch: Route Event Type']).toBeDefined();
    });
  });

  describe('2. Event Construction & Zod Schema Validation', () => {
    it('should construct a valid N8nEventEnvelope with deterministic idempotencyKey', () => {
      const event = createGovernmentEvent(
        'government.application.created',
        {
          id: 'app-pmk-101',
          farmId: 'demo-farm-01',
          status: 'draft',
          statusSource: 'user_reported',
          applicationReferenceNumber: 'PMK-MH-2026-9921',
          nextAction: 'Upload 7/12 land record',
        },
        {
          id: 'pm-kisan',
          name: 'Pradhan Mantri Kisan Samman Nidhi',
          shortName: 'PM-KISAN',
          officialApplicationUrl: 'https://pmkisan.gov.in/',
        },
        {
          id: 'farmer-mh-01',
          name: 'Ramesh Patil',
          farmId: 'demo-farm-01',
          phone: '+919876543210',
        }
      );

      // Zod Validation
      const parseResult = GovernmentEventEnvelopeSchema.safeParse(event);
      expect(parseResult.success).toBe(true);

      // Idempotency Key validation
      expect(event.idempotencyKey).toBe('government.application.created:demo-farm-01:app-pmk-101');
      expect(event.producer).toBe('agridost-app');
      expect(event.version).toBe('1.0');
      expect(event.payload.schemeId).toBe('pm-kisan');
      expect(event.payload.farmerName).toBe('Ramesh Patil');
    });

    it('should validate all 4 supported government event types', () => {
      const eventTypes = [
        'government.application.created',
        'government.application.status_changed',
        'government.deadline.approaching',
        'government.reminder.triggered',
      ] as const;

      for (const type of eventTypes) {
        const event = createGovernmentEvent(
          type,
          { id: 'app-test', farmId: 'farm-test' },
          { id: 'pmfby', name: 'PMFBY', officialApplicationUrl: 'https://pmfby.gov.in/' },
          { id: 'farmer-test', name: 'Kisan Kumar' }
        );

        const parseResult = GovernmentEventEnvelopeSchema.safeParse(event);
        expect(parseResult.success).toBe(true);
        expect(event.eventType).toBe(type);
      }
    });

    it('should reject invalid payload schema violating URL or required fields', () => {
      const invalidPayload = {
        schemeId: 'pm-kisan',
        schemeName: 'PM-KISAN',
        currentStatus: 'draft',
        statusSource: 'user_reported',
        farmerName: 'Ramesh',
        actionRequired: 'Verify',
        officialPortalUrl: 'not-a-valid-url', // Fails URL validation
      };

      const result = GovernmentAssistancePayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('3. Deadline Alert & Proximity Priority Logic', () => {
    it('should flag deadline <= 7 days as CRITICAL priority and isCritical=true', () => {
      const referenceDate = new Date('2026-11-20T00:00:00.000Z');
      const deadlineDate = '2026-11-25T00:00:00.000Z'; // 5 days remaining

      const proximity = calculateDeadlineProximity(deadlineDate, referenceDate);

      expect(proximity.daysRemaining).toBe(5);
      expect(proximity.priority).toBe('CRITICAL');
      expect(proximity.isCritical).toBe(true);
    });

    it('should flag deadline between 8 and 14 days as HIGH priority', () => {
      const referenceDate = new Date('2026-11-20T00:00:00.000Z');
      const deadlineDate = '2026-11-30T00:00:00.000Z'; // 10 days remaining

      const proximity = calculateDeadlineProximity(deadlineDate, referenceDate);

      expect(proximity.daysRemaining).toBe(10);
      expect(proximity.priority).toBe('HIGH');
      expect(proximity.isCritical).toBe(false);
    });

    it('should flag deadline > 14 days as MEDIUM priority', () => {
      const referenceDate = new Date('2026-11-20T00:00:00.000Z');
      const deadlineDate = '2026-12-15T00:00:00.000Z'; // 25 days remaining

      const proximity = calculateDeadlineProximity(deadlineDate, referenceDate);

      expect(proximity.daysRemaining).toBe(25);
      expect(proximity.priority).toBe('MEDIUM');
      expect(proximity.isCritical).toBe(false);
    });

    it('should return null daysRemaining for undefined deadline', () => {
      const proximity = calculateDeadlineProximity(undefined);
      expect(proximity.daysRemaining).toBeNull();
      expect(proximity.priority).toBe('MEDIUM');
      expect(proximity.isCritical).toBe(false);
    });
  });

  describe('4. Status Badge Integrity & Anti-Hallucination Preservation', () => {
    it('should never mark a user_reported application as government_verified, even if currentStatus is approved', () => {
      const badge = formatStatusBadge('user_reported', 'approved');

      expect(badge.isGovernmentVerified).toBe(false);
      expect(badge.statusSource).toBe('user_reported');
      expect(badge.badgeLabel).toContain('Self-Reported');
      expect(badge.disclaimer).toContain('NOT constitute official government verification');
    });

    it('should mark government_verified applications correctly with official badge and disclaimer', () => {
      const badge = formatStatusBadge('government_verified', 'approved');

      expect(badge.isGovernmentVerified).toBe(true);
      expect(badge.statusSource).toBe('government_verified');
      expect(badge.badgeLabel).toBe('Official: approved');
      expect(badge.disclaimer).toContain('Verified directly against official government records');
    });
  });

  describe('5. Simulated Workflow Execution & Bilingual Notifications', () => {
    it('should simulate execution of deadline approaching event with CRITICAL priority and bilingual alerts', async () => {
      const referenceDate = new Date('2026-11-20T12:00:00.000Z');
      const deadlineDate = '2026-11-24T12:00:00.000Z'; // 4 days remaining

      const event = createGovernmentEvent(
        'government.deadline.approaching',
        { id: 'app-kusum-01', farmId: 'farm-solar-01' },
        {
          id: 'pm-kusum-component-b',
          name: 'PM-KUSUM Component B',
          officialApplicationUrl: 'https://pmkusum.mnre.gov.in/',
        },
        { id: 'farmer-01', name: 'Baldev Singh' },
        { deadlineDate }
      );

      const result = await executeGovernmentWorkflow(event, { referenceDate });

      expect(result.status).toBe('success');
      expect(result.workflowId).toBe('government-assistance');
      expect(result.priority).toBe('CRITICAL');
      expect(result.daysRemaining).toBe(4);

      // English notifications check
      expect(result.notifications.en.title).toContain('CRITICAL DEADLINE');
      expect(result.notifications.en.sms).toContain('4 days');
      expect(result.notifications.en.whatsapp).toContain('pmkusum.mnre.gov.in');

      // Hindi notifications check
      expect(result.notifications.hi.title).toContain('अति महत्वपूर्ण');
      expect(result.notifications.hi.sms).toContain('4 दिन');
      expect(result.notifications.hi.whatsapp).toContain('pmkusum.mnre.gov.in');

      // Callback payload check
      expect(result.callbackPayload.workflowId).toBe('government-assistance');
      expect(result.callbackPayload.status).toBe('success');
      expect(result.callbackPayload.idempotencyKey).toBe(event.idempotencyKey);
    });

    it('should simulate execution of status change preserving user_reported unverified disclaimer', async () => {
      const event = createGovernmentEvent(
        'government.application.status_changed',
        {
          id: 'app-mh-01',
          farmId: 'farm-mh-01',
          status: 'submitted',
          statusSource: 'user_reported',
          applicationReferenceNumber: 'MH-NSMN-7711',
          nextAction: 'Check approval in 14 days',
        },
        {
          id: 'mh-namo-shetkari',
          name: 'Namo Shetkari Mahasanman Nidhi Yojana',
          officialApplicationUrl: 'https://krishi.maharashtra.gov.in/',
        },
        { id: 'farmer-02', name: 'Sunita Deshmukh' }
      );

      const result = await executeGovernmentWorkflow(event);

      expect(result.status).toBe('success');
      expect(result.isGovernmentVerified).toBe(false);
      expect(result.statusSource).toBe('user_reported');
      expect(result.statusDisclaimer).toContain('NOT constitute official government verification');

      // Notification checks
      expect(result.notifications.en.title).toContain('[Self-Reported]');
      expect(result.notifications.en.sms).toContain('Self-reported by user');
      expect(result.notifications.hi.title).toContain('[स्व-रिपोर्टित]');
      expect(result.notifications.hi.sms).toContain('स्व-रिपोर्टित');
    });

    it('should reject invalid event envelope during execution', async () => {
      const invalidEvent = {
        eventId: 'invalid',
        eventType: 'government.application.created',
        // Missing required envelope fields
      } as unknown as N8nEventEnvelope<GovernmentAssistancePayload>;

      await expect(executeGovernmentWorkflow(invalidEvent)).rejects.toThrow(
        'Invalid Government Assistance Event Envelope'
      );
    });
  });
});

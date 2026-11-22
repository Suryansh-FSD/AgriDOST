import { z } from 'zod';
import {
  N8nEventEnvelope,
  N8nEventType,
  N8nProducer,
  GovernmentAssistancePayload,
  GovernmentScheme,
  FarmerSchemeApplication,
} from '@/types';

/**
 * Zod Schemas for Government Assistance Automation
 */
export const GovernmentAssistancePayloadSchema = z.object({
  schemeId: z.string().min(1, 'schemeId is required'),
  schemeName: z.string().min(1, 'schemeName is required'),
  applicationId: z.string().optional(),
  referenceNumber: z.string().optional(),
  previousStatus: z.string().optional(),
  currentStatus: z.string().min(1, 'currentStatus is required'),
  statusSource: z.enum(['user_reported', 'government_verified']),
  deadlineDate: z.string().optional(),
  reminderTitle: z.string().optional(),
  reminderDueDate: z.string().optional(),
  farmerName: z.string().min(1, 'farmerName is required'),
  farmerContact: z.string().optional(),
  actionRequired: z.string().min(1, 'actionRequired is required'),
  officialPortalUrl: z.string().url('officialPortalUrl must be a valid URL'),
});

export const GovernmentEventTypeEnum = z.enum([
  'government.application.created',
  'government.application.status_changed',
  'government.deadline.approaching',
  'government.reminder.triggered',
]);

export const GovernmentEventEnvelopeSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  eventType: GovernmentEventTypeEnum,
  timestamp: z.string().min(1, 'timestamp is required'),
  producer: z.enum(['agridost-app', 'agridost-scheduler', 'n8n-workflow']),
  version: z.literal('1.0'),
  farmerId: z.string().min(1, 'farmerId is required'),
  farmId: z.string().min(1, 'farmId is required'),
  payload: GovernmentAssistancePayloadSchema,
  idempotencyKey: z.string().min(1, 'idempotencyKey is required'),
  signature: z.string().optional(),
});

export type ValidatedGovernmentEnvelope = z.infer<typeof GovernmentEventEnvelopeSchema>;

/**
 * Input interfaces for event creation
 */
export interface FarmerProfileInfo {
  id: string;
  name: string;
  farmId?: string;
  contact?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface SchemeInfo {
  id: string;
  name: string;
  shortName?: string;
  officialApplicationUrl?: string;
  officialInfoUrl?: string;
  applicationDeadline?: string;
  [key: string]: unknown;
}

export interface ApplicationInfo {
  id?: string;
  farmId?: string;
  schemeId?: string;
  status?: string;
  statusSource?: 'user_reported' | 'government_verified';
  applicationReferenceNumber?: string;
  nextAction?: string;
  portalUrl?: string;
  [key: string]: unknown;
}

export interface CreateGovernmentEventOptions {
  previousStatus?: string;
  currentStatus?: string;
  statusSource?: 'user_reported' | 'government_verified';
  deadlineDate?: string;
  reminderTitle?: string;
  reminderDueDate?: string;
  actionRequired?: string;
  officialPortalUrl?: string;
  producer?: N8nProducer;
  timestamp?: string;
  eventId?: string;
}

export interface BilingualNotification {
  title: string;
  sms: string;
  whatsapp: string;
  push: string;
}

export interface GovernmentNotifications {
  en: BilingualNotification;
  hi: BilingualNotification;
}

export interface DeadlineProximityResult {
  daysRemaining: number | null;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  isCritical: boolean;
}

export interface StatusBadgeResult {
  isGovernmentVerified: boolean;
  statusSource: 'user_reported' | 'government_verified';
  badgeLabel: string;
  badgeLabelHi: string;
  disclaimer: string;
}

export interface GovernmentWorkflowExecutionResult {
  executionId: string;
  workflowId: 'government-assistance';
  eventId: string;
  eventType: N8nEventType;
  status: 'success' | 'failed';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  daysRemaining: number | null;
  statusSource: 'user_reported' | 'government_verified';
  isGovernmentVerified: boolean;
  statusDisclaimer: string;
  notifications: GovernmentNotifications;
  callbackUrl: string;
  callbackPayload: Record<string, unknown>;
  executedAt: string;
  summary: string;
}

/**
 * Generates a deterministic idempotency key for government assistance events.
 * Format: government.${eventType}:${farmId}:${appId || schemeId}
 */
export function generateGovernmentIdempotencyKey(
  type: N8nEventType | string,
  farmId: string,
  entityId: string
): string {
  const cleanType = type.startsWith('government.') ? type : `government.${type}`;
  return `${cleanType}:${farmId}:${entityId}`;
}

/**
 * Calculates days remaining until deadline and computes urgency priority.
 * If <= 7 days, sets priority to 'CRITICAL'.
 */
export function calculateDeadlineProximity(
  deadlineDateStr?: string,
  referenceDate: string | Date = new Date()
): DeadlineProximityResult {
  if (!deadlineDateStr) {
    return { daysRemaining: null, priority: 'MEDIUM', isCritical: false };
  }

  const deadline = new Date(deadlineDateStr);
  const ref = typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate;

  if (isNaN(deadline.getTime()) || isNaN(ref.getTime())) {
    return { daysRemaining: null, priority: 'MEDIUM', isCritical: false };
  }

  const diffMs = deadline.getTime() - ref.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 7) {
    return { daysRemaining, priority: 'CRITICAL', isCritical: true };
  } else if (daysRemaining <= 14) {
    return { daysRemaining, priority: 'HIGH', isCritical: false };
  }

  return { daysRemaining, priority: 'MEDIUM', isCritical: false };
}

/**
 * Formats status badge integrity details and attaches mandatory unverified disclaimers.
 * Never marks a self-reported status as government_verified.
 */
export function formatStatusBadge(
  statusSource: 'user_reported' | 'government_verified',
  currentStatus: string
): StatusBadgeResult {
  const isGovernmentVerified = statusSource === 'government_verified';

  if (isGovernmentVerified) {
    return {
      isGovernmentVerified: true,
      statusSource: 'government_verified',
      badgeLabel: `Official: ${currentStatus}`,
      badgeLabelHi: `आधिकारिक: ${currentStatus}`,
      disclaimer: 'Verified directly against official government records/nodal portal.',
    };
  }

  return {
    isGovernmentVerified: false,
    statusSource: 'user_reported',
    badgeLabel: `Self-Reported: ${currentStatus} (Unverified)`,
    badgeLabelHi: `स्व-रिपोर्टित: ${currentStatus} (असत्यापित)`,
    disclaimer:
      'Status is self-reported by applicant and does NOT constitute official government verification, approval, or fund sanction.',
  };
}

/**
 * Builds actionable English and Hindi notifications for SMS, WhatsApp, and Push.
 */
export function buildGovernmentNotifications(
  eventType: N8nEventType,
  payload: GovernmentAssistancePayload,
  daysRemaining?: number | null,
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' = 'MEDIUM'
): GovernmentNotifications {
  const schemeName = payload.schemeName;
  const farmerName = payload.farmerName || 'Farmer';
  const portalUrl = payload.officialPortalUrl;
  const isGov = payload.statusSource === 'government_verified';

  switch (eventType) {
    case 'government.deadline.approaching': {
      const urgencyEn = priority === 'CRITICAL' ? '🚨 CRITICAL DEADLINE' : '⏰ DEADLINE ALERT';
      const urgencyHi = priority === 'CRITICAL' ? '🚨 अति महत्वपूर्ण समय सीमा' : '⏰ समय सीमा सूचना';
      const deadlineStr = payload.deadlineDate || payload.reminderDueDate || 'Upcoming';

      const enTitle = `${urgencyEn}: ${schemeName} (${daysRemaining ?? '?'} days left)`;
      const enSms = `URGENT: Only ${daysRemaining ?? '?'} days remain until deadline (${deadlineStr}) for ${schemeName}. Complete your application at: ${portalUrl}`;
      const enWhatsapp = `*${enTitle}*\n\nDear ${farmerName}, only *${daysRemaining ?? '?'} days* remain to submit your application for *${schemeName}*.\n\n*Deadline:* ${deadlineStr}\n*Action:* ${payload.actionRequired}\n*Portal:* ${portalUrl}`;
      const enPush = `Only ${daysRemaining ?? '?'} days left to apply for ${schemeName}. Tap to complete your submission.`;

      const hiTitle = `${urgencyHi}: ${schemeName} (केवल ${daysRemaining ?? '?'} दिन शेष)`;
      const hiSms = `महत्वपूर्ण: ${schemeName} की अंतिम तिथि (${deadlineStr}) में केवल ${daysRemaining ?? '?'} दिन शेष हैं। तुरंत पोर्टल पर आवेदन करें: ${portalUrl}`;
      const hiWhatsapp = `*${hiTitle}*\n\nकिसान भाई ${farmerName}, *${schemeName}* के लिए आवेदन करने में केवल *${daysRemaining ?? '?'} दिन* बाकी हैं।\n\n*अंतिम तिथि:* ${deadlineStr}\n*आवश्यक कदम:* ${payload.actionRequired}\n*पोर्टल:* ${portalUrl}`;
      const hiPush = `${schemeName} के लिए आवेदन की अंतिम तिथि समीप है। विवरण देखें।`;

      return {
        en: { title: enTitle, sms: enSms, whatsapp: enWhatsapp, push: enPush },
        hi: { title: hiTitle, sms: hiSms, whatsapp: hiWhatsapp, push: hiPush },
      };
    }

    case 'government.application.status_changed': {
      const badgeEn = isGov ? '[Official Update]' : '[Self-Reported]';
      const badgeHi = isGov ? '[आधिकारिक अपडेट]' : '[स्व-रिपोर्टित]';
      const verificationNoteEn = isGov
        ? 'Confirmed by government portal.'
        : 'Note: Self-reported by user; pending official portal confirmation.';
      const verificationNoteHi = isGov
        ? 'सरकारी पोर्टल द्वारा पुष्टि।'
        : 'सूचना: उपयोगकर्ता द्वारा स्व-रिपोर्टित; आधिकारिक पुष्टि प्रतीक्षित।';

      const enTitle = `${badgeEn} ${schemeName}: Status Changed to ${payload.currentStatus}`;
      const enSms = `${badgeEn} ${schemeName} application (Ref: ${payload.referenceNumber || 'N/A'}) status is ${payload.currentStatus}. ${verificationNoteEn} Action: ${payload.actionRequired}`;
      const enWhatsapp = `*${enTitle}*\n\nDear ${farmerName},\nYour application status for *${schemeName}* has been updated to *${payload.currentStatus}*.\n\n*Reference:* ${payload.referenceNumber || 'N/A'}\n*Status Type:* ${isGov ? 'Government Verified' : 'Self-Reported (Unverified)'}\n*Next Action:* ${payload.actionRequired}\n*Portal:* ${portalUrl}`;
      const enPush = `${schemeName} status updated to ${payload.currentStatus}. ${verificationNoteEn}`;

      const hiTitle = `${badgeHi} ${schemeName}: स्थिति बदलकर ${payload.currentStatus} हुई`;
      const hiSms = `${badgeHi} ${schemeName} आवेदन (संदर्भ: ${payload.referenceNumber || 'उपलब्ध नहीं'}) की स्थिति ${payload.currentStatus} है। ${verificationNoteHi} कार्यवाही: ${payload.actionRequired}`;
      const hiWhatsapp = `*${hiTitle}*\n\nकिसान भाई ${farmerName},\n*${schemeName}* के लिए आपके आवेदन की स्थिति अब *${payload.currentStatus}* है।\n\n*संदर्भ:* ${payload.referenceNumber || 'उपलब्ध नहीं'}\n*स्थिति प्रकार:* ${isGov ? 'सरकारी सत्यापित' : 'स्व-रिपोर्टित (असत्यापित)'}\n*अगला कदम:* ${payload.actionRequired}\n*पोर्टल:* ${portalUrl}`;
      const hiPush = `${schemeName} की स्थिति अब ${payload.currentStatus} है।`;

      return {
        en: { title: enTitle, sms: enSms, whatsapp: enWhatsapp, push: enPush },
        hi: { title: hiTitle, sms: hiSms, whatsapp: hiWhatsapp, push: hiPush },
      };
    }

    case 'government.reminder.triggered': {
      const reminderTitle = payload.reminderTitle || 'Pending Scheme Action';
      const dueDate = payload.reminderDueDate || 'Upcoming';

      const enTitle = `Reminder: ${reminderTitle} (${schemeName})`;
      const enSms = `Reminder for ${schemeName}: ${reminderTitle}. Due: ${dueDate}. Action: ${payload.actionRequired}. Portal: ${portalUrl}`;
      const enWhatsapp = `*${enTitle}*\n\nDear ${farmerName},\nThis is a scheduled reminder for *${schemeName}*.\n\n*Task:* ${reminderTitle}\n*Due Date:* ${dueDate}\n*Action Required:* ${payload.actionRequired}\n*Portal:* ${portalUrl}`;
      const enPush = `Reminder: ${reminderTitle} for ${schemeName} is due soon.`;

      const hiTitle = `रिमाइंडर: ${reminderTitle} (${schemeName})`;
      const hiSms = `रिमाइंडर: ${schemeName} के लिए ${reminderTitle}। नियत तिथि: ${dueDate}। कार्यवाही: ${payload.actionRequired}। पोर्टल: ${portalUrl}`;
      const hiWhatsapp = `*${hiTitle}*\n\nकिसान भाई ${farmerName},\n*${schemeName}* के लिए यह एक आवश्यक स्मरण पत्र है।\n\n*कार्य:* ${reminderTitle}\n*नियत तारीख:* ${dueDate}\n*आवश्यक कार्यवाही:* ${payload.actionRequired}\n*पोर्टल:* ${portalUrl}`;
      const hiPush = `रिमाइंडर: ${schemeName} का कार्य शीघ्र पूरा करें।`;

      return {
        en: { title: enTitle, sms: enSms, whatsapp: enWhatsapp, push: enPush },
        hi: { title: hiTitle, sms: hiSms, whatsapp: hiWhatsapp, push: hiPush },
      };
    }

    case 'government.application.created':
    default: {
      const enTitle = `Application Draft: ${schemeName}`;
      const enSms = `Your application draft for ${schemeName} (Ref: ${payload.referenceNumber || 'Pending'}) is ready. Next step: ${payload.actionRequired}. Portal: ${portalUrl}`;
      const enWhatsapp = `*${enTitle}*\n\nDear ${farmerName},\nYour application draft for *${schemeName}* has been prepared on AgriDOST.\n\n*Reference Number:* ${payload.referenceNumber || 'Pending'}\n*Next Step:* ${payload.actionRequired}\n*Official Portal:* ${portalUrl}`;
      const enPush = `Application draft for ${schemeName} ready. Next step: ${payload.actionRequired}`;

      const hiTitle = `आवेदन ड्राफ्ट तैयार: ${schemeName}`;
      const hiSms = `${schemeName} (संदर्भ: ${payload.referenceNumber || 'प्रक्रियाधीन'}) के लिए आपका आवेदन तैयार है। अगला कदम: ${payload.actionRequired}। पोर्टल: ${portalUrl}`;
      const hiWhatsapp = `*${hiTitle}*\n\nकिसान भाई ${farmerName},\n*${schemeName}* के लिए आपका आवेदन ड्राफ्ट तैयार कर लिया गया है।\n\n*संदर्भ संख्या:* ${payload.referenceNumber || 'प्रक्रियाधीन'}\n*अगला कदम:* ${payload.actionRequired}\n*आधिकारिक पोर्टल:* ${portalUrl}`;
      const hiPush = `${schemeName} के लिए आवेदन ड्राफ्ट तैयार है।`;

      return {
        en: { title: enTitle, sms: enSms, whatsapp: enWhatsapp, push: enPush },
        hi: { title: hiTitle, sms: hiSms, whatsapp: hiWhatsapp, push: hiPush },
      };
    }
  }
}

/**
 * Creates a valid, production-ready N8nEventEnvelope for government assistance automation.
 */
export function createGovernmentEvent(
  type: N8nEventType,
  app?: Partial<FarmerSchemeApplication> | ApplicationInfo | null,
  scheme?: Partial<GovernmentScheme> | SchemeInfo | null,
  farmer?: FarmerProfileInfo | null,
  options?: CreateGovernmentEventOptions
): N8nEventEnvelope<GovernmentAssistancePayload> {
  const farmerId = farmer?.id || 'demo-farmer-01';
  const farmId = farmer?.farmId || app?.farmId || 'demo-farm-01';
  const schemeId = scheme?.id || app?.schemeId || 'pm-kisan';
  const entityId = app?.id || app?.applicationReferenceNumber || schemeId;

  const schemeName = scheme?.shortName || scheme?.name || 'Pradhan Mantri Kisan Samman Nidhi';
  const currentStatus = options?.currentStatus || app?.status || 'draft';
  const statusSource = options?.statusSource || app?.statusSource || 'user_reported';
  const officialPortalUrl =
    options?.officialPortalUrl ||
    scheme?.officialApplicationUrl ||
    scheme?.officialInfoUrl ||
    app?.portalUrl ||
    'https://pmkisan.gov.in/';

  const actionRequired =
    options?.actionRequired ||
    app?.nextAction ||
    'Verify required documents and submit on the official government portal.';

  const payload: GovernmentAssistancePayload = {
    schemeId,
    schemeName,
    applicationId: app?.id,
    referenceNumber: app?.applicationReferenceNumber,
    previousStatus: options?.previousStatus,
    currentStatus,
    statusSource,
    deadlineDate: options?.deadlineDate || scheme?.applicationDeadline,
    reminderTitle: options?.reminderTitle,
    reminderDueDate: options?.reminderDueDate,
    farmerName: farmer?.name || 'Farmer',
    farmerContact: farmer?.contact || farmer?.phone,
    actionRequired,
    officialPortalUrl,
  };

  const idempotencyKey = generateGovernmentIdempotencyKey(type, farmId, entityId);

  const envelope: N8nEventEnvelope<GovernmentAssistancePayload> = {
    eventId: options?.eventId || `evt_${crypto.randomUUID()}`,
    eventType: type,
    timestamp: options?.timestamp || new Date().toISOString(),
    producer: options?.producer || 'agridost-app',
    version: '1.0',
    farmerId,
    farmId,
    payload,
    idempotencyKey,
  };

  return envelope;
}

/**
 * Deterministic simulated execution engine matching the n8n workflow behavior for offline testing.
 */
export async function executeGovernmentWorkflow(
  event: N8nEventEnvelope<GovernmentAssistancePayload>,
  options?: {
    callbackUrl?: string;
    referenceDate?: string | Date;
  }
): Promise<GovernmentWorkflowExecutionResult> {
  // Validate schema
  const parseResult = GovernmentEventEnvelopeSchema.safeParse(event);
  if (!parseResult.success) {
    throw new Error(`Invalid Government Assistance Event Envelope: ${parseResult.error.message}`);
  }

  const validEvent = parseResult.data;
  const payload = validEvent.payload;

  // 1. Calculate deadline proximity
  const deadlineStr = payload.deadlineDate || payload.reminderDueDate;
  const proximity = calculateDeadlineProximity(
    deadlineStr,
    options?.referenceDate || validEvent.timestamp
  );

  // Determine priority
  let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' = proximity.priority;
  if (validEvent.eventType === 'government.application.status_changed') {
    priority = payload.statusSource === 'government_verified' ? 'HIGH' : 'MEDIUM';
  }

  // 2. Status badge integrity: never mark unverified as approved
  const badgeInfo = formatStatusBadge(payload.statusSource, payload.currentStatus);

  // 3. Build bilingual notifications
  const notifications = buildGovernmentNotifications(
    validEvent.eventType,
    payload,
    proximity.daysRemaining,
    priority
  );

  const callbackUrl = options?.callbackUrl || 'http://localhost:3000/api/n8n/callback';
  const executedAt = new Date().toISOString();
  const executionId = `exec_${crypto.randomUUID()}`;

  const callbackPayload = {
    callbackUrl,
    executionId,
    eventId: validEvent.eventId,
    eventType: validEvent.eventType,
    workflowId: 'government-assistance',
    status: 'success',
    priority,
    daysRemaining: proximity.daysRemaining,
    statusSource: payload.statusSource,
    isGovernmentVerified: badgeInfo.isGovernmentVerified,
    statusDisclaimer: badgeInfo.disclaimer,
    notifications,
    farmerId: validEvent.farmerId,
    farmId: validEvent.farmId,
    idempotencyKey: validEvent.idempotencyKey,
    processedAt: executedAt,
  };

  const summary = `Executed ${validEvent.eventType} for ${payload.schemeName} (${priority} priority, ${payload.statusSource}).`;

  return {
    executionId,
    workflowId: 'government-assistance',
    eventId: validEvent.eventId,
    eventType: validEvent.eventType,
    status: 'success',
    priority,
    daysRemaining: proximity.daysRemaining,
    statusSource: payload.statusSource,
    isGovernmentVerified: badgeInfo.isGovernmentVerified,
    statusDisclaimer: badgeInfo.disclaimer,
    notifications,
    callbackUrl,
    callbackPayload,
    executedAt,
    summary,
  };
}

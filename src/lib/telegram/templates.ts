/**
 * AgriDOST 4.0: Telegram Bilingual Notification Templates
 *
 * Rich HTML message templates for Indian farmers with clean emoji formatting,
 * priority indicators, and dual English + Hindi presentation.
 */

import {
  NotificationLanguageMode,
  TelegramNotification,
  TelegramNotificationCategory,
  TelegramPriority,
} from '@/types/telegram';

const CATEGORY_ICONS: Record<TelegramNotificationCategory, string> = {
  weather: '🌦️',
  crop_health: '🌿',
  scheme: '🏛️',
  market: '📈',
  task: '🚜',
};

const CATEGORY_NAMES: Record<TelegramNotificationCategory, { en: string; hi: string }> = {
  weather: { en: 'Weather Advisory', hi: 'मौसम सलाह' },
  crop_health: { en: 'Crop Health Alert', hi: 'फसल स्वास्थ्य अलर्ट' },
  scheme: { en: 'Government Scheme', hi: 'सरकारी योजना' },
  market: { en: 'Mandi Market Intelligence', hi: 'मंडी भाव सूचना' },
  task: { en: 'Farm Operations Reminder', hi: 'कृषि कार्य स्मरण' },
};

const PRIORITY_BADGES: Record<TelegramPriority, { en: string; hi: string; icon: string }> = {
  urgent: { en: 'CRITICAL ALERT', hi: 'अति आवश्यक', icon: '🔴' },
  high: { en: 'HIGH PRIORITY', hi: 'उच्च प्राथमिकता', icon: '🟠' },
  medium: { en: 'ATTENTION', hi: 'ध्यान दें', icon: '🟡' },
  low: { en: 'ADVISORY', hi: 'सामान्य सलाह', icon: '🟢' },
};

/**
 * Format a TelegramNotification into HTML text for Telegram sendMessage.
 */
export function formatNotification(
  notification: TelegramNotification,
  mode: NotificationLanguageMode = 'bilingual'
): string {
  const icon = CATEGORY_ICONS[notification.category] || '📢';
  const catName = CATEGORY_NAMES[notification.category] || { en: 'Alert', hi: 'सूचना' };
  const prio = PRIORITY_BADGES[notification.priority] || PRIORITY_BADGES.medium;

  const priorityLine =
    notification.priority === 'urgent' || notification.priority === 'high'
      ? `${prio.icon} <b>[${prio.en} / ${prio.hi}]</b>\n`
      : '';

  if (mode === 'en') {
    return `${icon} <b>AgriDOST: ${catName.en}</b>\n${priorityLine}<b>${escapeHtml(notification.titleEn)}</b>\n\n${escapeHtml(notification.bodyEn)}\n\n${formatMetadata(notification.metadata, 'en')}\n<i>AgriDOST AI Farm Companion • Farmer ID: ${notification.farmerId}</i>`.trim();
  }

  if (mode === 'hi') {
    return `${icon} <b>एग्रीदोस्त: ${catName.hi}</b>\n${priorityLine}<b>${escapeHtml(notification.titleHi || notification.titleEn)}</b>\n\n${escapeHtml(notification.bodyHi || notification.bodyEn)}\n\n${formatMetadata(notification.metadata, 'hi')}\n<i>एग्रीदोस्त किसान साथी • किसान आईडी: ${notification.farmerId}</i>`.trim();
  }

  // Bilingual default
  return `${icon} <b>AgriDOST • ${catName.en} / ${catName.hi}</b>
${priorityLine}
📌 <b>${escapeHtml(notification.titleEn)}</b>
हिंदी: <b>${escapeHtml(notification.titleHi)}</b>

📝 <b>Details (English):</b>
${escapeHtml(notification.bodyEn)}

📝 <b>विवरण (हिंदी):</b>
${escapeHtml(notification.bodyHi)}

${formatMetadata(notification.metadata, 'bilingual')}
────────────────────
🌾 <i>AgriDOST 4.0 Verified Advisory • Farmer ID: ${notification.farmerId}</i>`.trim();
}

/**
 * Escape HTML special characters for Telegram HTML mode.
 */
function escapeHtml(text?: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Render optional metadata fields nicely into bullet points.
 */
function formatMetadata(
  meta?: Record<string, unknown>,
  lang: 'en' | 'hi' | 'bilingual' = 'bilingual'
): string {
  if (!meta || Object.keys(meta).length === 0) return '';

  const lines: string[] = ['<b>Additional Information / अतिरिक्त जानकारी:</b>'];

  for (const [key, val] of Object.entries(meta)) {
    if (val === undefined || val === null) continue;
    const readableKey = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
    lines.push(`• <b>${escapeHtml(readableKey)}:</b> ${escapeHtml(String(val))}`);
  }

  return lines.length > 1 ? lines.join('\n') + '\n' : '';
}

/**
 * Helper to build a Weather Alert notification.
 */
export function buildWeatherNotification(params: {
  farmerId: string;
  chatId?: number | string;
  priority?: TelegramPriority;
  weatherCondition: string;
  rainfallMm?: number;
  windSpeedKmh?: number;
  sprayCondition?: 'Optimal' | 'Caution' | 'Unsafe';
  adviceEn: string;
  adviceHi: string;
  location?: string;
}): TelegramNotification {
  const isUrgent = (params.rainfallMm && params.rainfallMm > 50) || params.sprayCondition === 'Unsafe';

  return {
    id: `weather-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    farmerId: params.farmerId,
    chatId: params.chatId,
    category: 'weather',
    priority: params.priority || (isUrgent ? 'urgent' : 'high'),
    titleEn: `Weather Warning: ${params.weatherCondition}${params.location ? ` in ${params.location}` : ''}`,
    titleHi: `मौसम चेतावनी: ${params.location ? `${params.location} में ` : ''}${params.weatherCondition}`,
    bodyEn: `${params.adviceEn}\nSpray Condition: ${params.sprayCondition || 'Check local parameters'} (Wind: ${params.windSpeedKmh ?? 'N/A'} km/h, Rain: ${params.rainfallMm ?? 0} mm).`,
    bodyHi: `${params.adviceHi}\nछिड़काव स्थिति: ${params.sprayCondition === 'Unsafe' ? 'असुरक्षित (छिड़काव टालें)' : params.sprayCondition === 'Caution' ? 'सावधानी बरतें' : 'अनुकूल'} (हवा की गति: ${params.windSpeedKmh ?? 'अज्ञात'} किमी/घं, वर्षा: ${params.rainfallMm ?? 0} मिमी).`,
    metadata: {
      sprayCondition: params.sprayCondition,
      windSpeedKmh: params.windSpeedKmh,
      rainfallMm: params.rainfallMm,
      location: params.location,
    },
  };
}

/**
 * Helper to build a Crop Health Diagnostic Alert notification.
 */
export function buildCropHealthNotification(params: {
  farmerId: string;
  chatId?: number | string;
  cropName: string;
  diseaseNameEn: string;
  diseaseNameHi: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  confidenceScore?: number;
  chemicalRemedyEn: string;
  chemicalRemedyHi: string;
  organicRemedyEn?: string;
  organicRemedyHi?: string;
}): TelegramNotification {
  const isCritical = params.severity === 'critical' || params.severity === 'high';

  return {
    id: `crophealth-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    farmerId: params.farmerId,
    chatId: params.chatId,
    category: 'crop_health',
    priority: isCritical ? 'urgent' : 'medium',
    titleEn: `Crop Health Diagnosis: ${params.diseaseNameEn} detected in ${params.cropName}`,
    titleHi: `फसल स्वास्थ्य निदान: ${params.cropName} में ${params.diseaseNameHi} की पहचान`,
    bodyEn: `Pathology detected with ${params.confidenceScore ?? 85}% confidence. Severity: ${params.severity.toUpperCase()}.\nRecommended Treatment: ${params.chemicalRemedyEn}${params.organicRemedyEn ? `\nOrganic alternative: ${params.organicRemedyEn}` : ''}`,
    bodyHi: `${params.diseaseNameHi} रोग के लक्षण पाए गए हैं (विश्वसनीयता: ${params.confidenceScore ?? 85}%)। गंभीरता: ${params.severity}।\nउपचार: ${params.chemicalRemedyHi}${params.organicRemedyHi ? `\nजैविक विकल्प: ${params.organicRemedyHi}` : ''}`,
    metadata: {
      crop: params.cropName,
      diagnosis: params.diseaseNameEn,
      severity: params.severity,
      confidence: params.confidenceScore ? `${params.confidenceScore}%` : undefined,
    },
  };
}

/**
 * Helper to build a Government Scheme Deadline Reminder notification.
 */
export function buildSchemeNotification(params: {
  farmerId: string;
  chatId?: number | string;
  schemeNameEn: string;
  schemeNameHi: string;
  deadlineDate: string;
  benefitEn: string;
  benefitHi: string;
  actionEn: string;
  actionHi: string;
}): TelegramNotification {
  return {
    id: `scheme-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    farmerId: params.farmerId,
    chatId: params.chatId,
    category: 'scheme',
    priority: 'high',
    titleEn: `Deadline Reminder: ${params.schemeNameEn}`,
    titleHi: `अंतिम तिथि स्मरण: ${params.schemeNameHi}`,
    bodyEn: `The last date to apply/verify e-KYC for ${params.schemeNameEn} is ${params.deadlineDate}.\nBenefit: ${params.benefitEn}\nAction Required: ${params.actionEn}`,
    bodyHi: `${params.schemeNameHi} हेतु आवेदन/ई-केवाईसी की अंतिम तिथि ${params.deadlineDate} है।\nलाभ: ${params.benefitHi}\nआवश्यक कदम: ${params.actionHi}`,
    metadata: {
      deadline: params.deadlineDate,
      scheme: params.schemeNameEn,
    },
  };
}

/**
 * Helper to build a Mandi Market Price Spike / Target notification.
 */
export function buildMarketNotification(params: {
  farmerId: string;
  chatId?: number | string;
  commodity: string;
  mandiName: string;
  currentPrice: number;
  mspPrice?: number;
  changePct?: number;
  adviceEn: string;
  adviceHi: string;
}): TelegramNotification {
  return {
    id: `market-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    farmerId: params.farmerId,
    chatId: params.chatId,
    category: 'market',
    priority: 'medium',
    titleEn: `Mandi Price Alert: ${params.commodity} at ${params.mandiName} (₹${params.currentPrice}/Qtl)`,
    titleHi: `मंडी भाव अलर्ट: ${params.mandiName} में ${params.commodity} (₹${params.currentPrice}/क्विंटल)`,
    bodyEn: `Current modal price reached ₹${params.currentPrice}/Quintal${params.changePct ? ` (${params.changePct > 0 ? '+' : ''}${params.changePct}% change)` : ''}${params.mspPrice ? `. Official MSP: ₹${params.mspPrice}/Qtl` : ''}.\nRecommendation: ${params.adviceEn}`,
    bodyHi: `वर्तमान भाव ₹${params.currentPrice}/क्विंटल पर पहुंचा${params.changePct ? ` (${params.changePct > 0 ? '+' : ''}${params.changePct}% बदलाव)` : ''}${params.mspPrice ? ` (सरकारी एमएसपी: ₹${params.mspPrice}/क्विंटल)` : ''}।\nसुझाव: ${params.adviceHi}`,
    metadata: {
      commodity: params.commodity,
      mandi: params.mandiName,
      pricePerQuintal: `₹${params.currentPrice}`,
      msp: params.mspPrice ? `₹${params.mspPrice}` : undefined,
    },
  };
}

/**
 * Helper to build a Field Task Reminder notification.
 */
export function buildTaskNotification(params: {
  farmerId: string;
  chatId?: number | string;
  taskTitleEn: string;
  taskTitleHi: string;
  scheduledTime: string;
  farmName?: string;
  detailsEn: string;
  detailsHi: string;
}): TelegramNotification {
  return {
    id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    farmerId: params.farmerId,
    chatId: params.chatId,
    category: 'task',
    priority: 'medium',
    titleEn: `Task Reminder: ${params.taskTitleEn}`,
    titleHi: `कृषि कार्य स्मरण: ${params.taskTitleHi}`,
    bodyEn: `Scheduled at: ${params.scheduledTime}${params.farmName ? ` on farm ${params.farmName}` : ''}.\n${params.detailsEn}`,
    bodyHi: `नियत समय: ${params.scheduledTime}${params.farmName ? ` (खेत: ${params.farmName})` : ''}।\n${params.detailsHi}`,
    metadata: {
      scheduledTime: params.scheduledTime,
      farm: params.farmName,
    },
  };
}

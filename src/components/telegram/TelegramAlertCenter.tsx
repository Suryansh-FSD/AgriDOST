'use client';

import React, { useState, useEffect } from 'react';
import {
  FarmerConsentRecord,
  TelegramDeliveryResult,
  TelegramNotificationCategory,
  TelegramPriority,
} from '@/types/telegram';
import { Farm } from '@/types';
import {
  Send,
  ShieldCheck,
  ShieldAlert,
  Bell,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  QrCode,
  Smartphone,
  ExternalLink,
  Info,
} from 'lucide-react';

interface TelegramAlertCenterProps {
  farm?: Farm;
}

export function TelegramAlertCenter({ farm }: TelegramAlertCenterProps) {
  const [farmerId, setFarmerId] = useState<string>(farm?.id || 'demo-farmer-01');
  const [chatId, setChatId] = useState<string>('1098765432');
  const [username, setUsername] = useState<string>('demo_farmer_kisan');
  const [lang, setLang] = useState<'en' | 'hi' | 'mr'>('hi');

  const [consentStatus, setConsentStatus] = useState<boolean>(true);
  const [consentTimestamp, setConsentTimestamp] = useState<string>(new Date().toISOString());
  const [loading, setLoading] = useState(false);

  // Test notification options
  const [testCategory, setTestCategory] = useState<TelegramNotificationCategory>('weather');
  const [testPriority, setTestPriority] = useState<TelegramPriority>('high');
  const [deliveryResult, setDeliveryResult] = useState<TelegramDeliveryResult | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Poll consent from server
  const checkConsent = async () => {
    try {
      const res = await fetch(`/api/telegram/consent?farmerId=${encodeURIComponent(farmerId)}`);
      if (res.ok) {
        const data = await res.json();
        setConsentStatus(Boolean(data.optInStatus));
        if (data.consentTimestamp) setConsentTimestamp(data.consentTimestamp);
        if (data.chatId) setChatId(String(data.chatId));
        if (data.languagePreference) setLang(data.languagePreference);
      }
    } catch {
      // Fallback in-memory
    }
  };

  useEffect(() => {
    checkConsent();
  }, [farmerId]);

  // Handle Opt-In / Opt-Out
  const handleToggleConsent = async (enable: boolean) => {
    setLoading(true);
    setActionNotice(null);
    try {
      const res = await fetch('/api/telegram/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmerId,
          chatId,
          username,
          optInStatus: enable,
          languagePreference: lang,
        }),
      });

      if (res.ok) {
        setConsentStatus(enable);
        setActionNotice(
          enable
            ? 'Explicit opt-in recorded! Telegram alerts are now active for this farm profile.'
            : 'Opt-out successful. All notifications revoked. No messages will be dispatched.'
        );
      }
    } catch (err) {
      console.error('[TelegramAlertCenter] Failed to update consent:', err);
    } finally {
      setLoading(false);
    }
  };

  // Send Test Notification
  const handleSendTestAlert = async () => {
    setLoading(true);
    setDeliveryResult(null);
    setActionNotice(null);
    try {
      const titles = {
        weather: {
          en: 'Heavy Rain & High Wind Warning',
          hi: 'भारी बारिश एवं तेज हवा चेतावनी',
        },
        crop_health: {
          en: 'Early Blight Detected in Tomato Parcel',
          hi: 'टमाटर के खेत में अगेती झुलसा का प्रकोप',
        },
        scheme: {
          en: 'PMFBY Kharif Crop Insurance Deadline Approaching',
          hi: 'पीएमएफबीवाई खरीफ फसल बीमा की अंतिम तिथि निकट',
        },
        market: {
          en: 'Soybean Modal Price Spike at Nashik APMC',
          hi: 'नासिक मंडी में सोयाबीन भाव में उछाल (₹4,890/क्विंटल)',
        },
        task: {
          en: 'Morning Drip Fertigation & Neem Spray Scheduled',
          hi: 'सुबह ड्रिप फर्टिगेशन एवं नीम तेल छिड़काव का कार्य',
        },
      };

      const bodies = {
        weather: {
          en: 'Wind gusts exceeding 16 km/h. Drone spraying strictly suspended under CIBRC guidelines.',
          hi: 'हवा की गति 16 किमी/घंटा से अधिक। सीआईबीआरसी दिशा-निर्देशों के अनुसार ड्रोन छिड़काव स्थगित रखें।',
        },
        crop_health: {
          en: 'Brown concentric spots on lower leaves. Recommended bio-fungicide: Trichoderma viride.',
          hi: 'निचली पत्तियों पर भूरे छल्लेदार धब्बे। ट्राइकोडर्मा विरिडी जैव कवकनाशी का प्रयोग करें।',
        },
        scheme: {
          en: 'Last date for PMFBY Kharif enrollment is July 31. Verify Aadhaar & 7/12 land record at CSC.',
          hi: 'पीएमएफबीवाई नामांकन की अंतिम तिथि 31 जुलाई है। सीएससी केंद्र पर आधार और 7/12 सत्यापित करें।',
        },
        market: {
          en: 'Current mandi rate is above MSP (₹4,892/Qtl). Good window to liquidate stored crop inventory.',
          hi: 'वर्तमान मंडी भाव एमएसपी से ऊपर है। स्टॉक की गई उपज बेचने का उपयुक्त अवसर है।',
        },
        task: {
          en: 'Scheduled for 07:00 AM. Wear nitrile gloves and standard protective visor.',
          hi: 'प्रातः 07:00 बजे का समय निर्धारित। सुरक्षा हेतु दस्ताने और मास्क का प्रयोग करें।',
        },
      };

      const res = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmerId,
          chatId,
          category: testCategory,
          priority: testPriority,
          titleEn: titles[testCategory].en,
          bodyEn: bodies[testCategory].en,
          titleHi: titles[testCategory].hi,
          bodyHi: bodies[testCategory].hi,
        }),
      });

      const data = await res.json();
      setDeliveryResult(data);
    } catch (err) {
      console.error('[TelegramAlertCenter] Failed to dispatch alert:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E7E9E2] bg-white p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#DCE8D3] text-[#173F2B]">
              <Send className="h-4 w-4" />
            </div>
            <h2 className="text-xl font-bold text-[#173F2B] font-heading">
              Telegram Farmer Notification Gateway
            </h2>
          </div>
          <p className="mt-1 text-xs text-[#26312A]/60">
            Encrypted bilingual notifications, explicit farmer opt-in management, and 24-hour deduplication.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold ${
              consentStatus
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-amber-300 bg-amber-50 text-amber-800'
            }`}
          >
            {consentStatus ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
            {consentStatus ? 'CONSENT ACTIVE (स्वीकृति सक्रिय)' : 'OPTED OUT (अस्वीकृत)'}
          </span>
        </div>
      </div>

      {actionNotice && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-4 text-xs font-semibold text-emerald-800">
          {actionNotice}
        </div>
      )}

      {/* Main Grid: Consent Management + Dispatch Simulator */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Farmer Profile & Consent Card (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-2xl border border-[#E7E9E2] bg-white p-5 shadow-xs space-y-4">
            <h3 className="font-heading text-sm font-bold text-[#173F2B] flex items-center gap-1.5">
              <Smartphone className="h-4 w-4 text-[#173F2B]" />
              Farmer Telegram Opt-In Credentials
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#26312A] block mb-1">Farmer Profile ID</label>
                <input
                  type="text"
                  value={farmerId}
                  onChange={(e) => setFarmerId(e.target.value)}
                  className="w-full rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] p-2.5 font-medium text-[#173F2B]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#26312A] block mb-1">Telegram Chat ID</label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="w-full rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] p-2.5 font-medium text-[#173F2B]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#26312A] block mb-1">Preferred Language</label>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as any)}
                  className="w-full rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] p-2.5 font-medium text-[#173F2B]"
                >
                  <option value="hi">Hindi (हिंदी) - Primary</option>
                  <option value="en">English - Primary</option>
                  <option value="mr">Marathi (मराठी) - Primary</option>
                </select>
              </div>

              <div className="pt-2 border-t border-[#E7E9E2] flex items-center justify-between gap-3">
                {consentStatus ? (
                  <button
                    onClick={() => handleToggleConsent(false)}
                    disabled={loading}
                    className="w-full rounded-xl border border-red-300 bg-red-50 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 transition"
                  >
                    Revoke Consent (/stop)
                  </button>
                ) : (
                  <button
                    onClick={() => handleToggleConsent(true)}
                    disabled={loading}
                    className="w-full rounded-xl bg-[#173F2B] py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#173F2B]/90 transition"
                  >
                    Grant Consent (/start)
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E7E9E2] bg-[#F7F7F0] p-4 text-xs space-y-2 text-[#26312A]/80">
            <h4 className="font-bold text-[#173F2B] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#173F2B]" />
              Strict Farmer Privacy Commitment
            </h4>
            <p className="text-[11px] leading-relaxed">
              AgriDOST strictly forbids unsolicited messages. Alerts are only delivered if the farmer explicitly opted in via this portal or texted <code>/start</code> to the bot. Consent can be revoked instantly at any time.
            </p>
          </div>
        </div>

        {/* Right: Test Alert Dispatcher & Delivery Status (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-2xl border border-[#E7E9E2] bg-white p-5 shadow-xs space-y-4">
            <h3 className="font-heading text-sm font-bold text-[#173F2B] flex items-center gap-1.5">
              <Bell className="h-4 w-4 text-[#173F2B]" />
              Controlled Alert Dispatch & Deduplication Simulator
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-[#26312A] block mb-1">Notification Category</label>
                <select
                  value={testCategory}
                  onChange={(e) => setTestCategory(e.target.value as any)}
                  className="w-full rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] p-2.5 font-medium text-[#173F2B]"
                >
                  <option value="weather">🌦️ Weather Advisory</option>
                  <option value="crop_health">🌿 Crop Health Diagnostic</option>
                  <option value="scheme">🏛️ Government Scheme Deadline</option>
                  <option value="market">📈 APMC Mandi Price Alert</option>
                  <option value="task">🚜 Field Task Reminder</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#26312A] block mb-1">Priority</label>
                <select
                  value={testPriority}
                  onChange={(e) => setTestPriority(e.target.value as any)}
                  className="w-full rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] p-2.5 font-medium text-[#173F2B]"
                >
                  <option value="urgent">🔴 Urgent / Critical</option>
                  <option value="high">🟠 High Priority</option>
                  <option value="medium">🟡 Medium Attention</option>
                  <option value="low">🟢 Normal Advisory</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleSendTestAlert}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Dispatch Test Notification to Telegram</span>
            </button>
          </div>

          {/* Delivery Result Card */}
          {deliveryResult && (
            <div
              className={`rounded-2xl border p-5 shadow-xs space-y-3 ${
                deliveryResult.success
                  ? 'border-emerald-300 bg-emerald-50/50'
                  : 'border-red-300 bg-red-50/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#26312A]">
                  Delivery Status Result
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    deliveryResult.success
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {deliveryResult.success ? 'DELIVERED (सफल)' : 'BLOCKED / FAILED'}
                </span>
              </div>

              <div className="text-xs space-y-1">
                {deliveryResult.success ? (
                  <>
                    <p className="font-medium text-emerald-900">
                      Message successfully dispatched to Telegram Chat ID <code>{deliveryResult.chatId}</code>!
                    </p>
                    <p className="text-[11px] text-emerald-800/80">
                      Message ID: <strong>#{deliveryResult.messageId}</strong> • Timestamp: {deliveryResult.deliveredAt}
                    </p>
                    {deliveryResult.wasDeduplicated && (
                      <p className="text-[11px] text-amber-800 font-semibold mt-1">
                        ⚠️ 24-Hour Deduplication Sentinel flagged repeat content within 24 hours.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-medium text-red-900">
                      Delivery rejected: <strong>{deliveryResult.error}</strong>
                    </p>
                    <p className="text-[11px] text-red-800/80">
                      Consent policy prevented sending alert. Farmer must opt in before messages can be delivered.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

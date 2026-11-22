'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  ShieldAlert,
  ExternalLink,
  RotateCcw,
  Globe,
  CheckCircle2,
  Lock,
  ChevronDown,
  Building,
  Calendar,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { GovernmentScheme, Farm } from '@/types';
import { getAllSchemes } from '@/lib/schemes';
import { t, SupportedLanguage } from '@/lib/i18n';
import { getOfflineSchemeAnswer } from '@/lib/ai/schemes-prompt';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  sources?: Array<{
    title: string;
    url: string;
    lastVerified: string;
  }>;
  isOfflineFallback?: boolean;
}

export interface SchemeAIAssistantProps {
  activeFarm?: Farm;
  selectedSchemeId?: string;
  onSelectScheme?: (schemeId: string) => void;
  className?: string;
}

let messageCounter = 0;
function getNextMessageId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}-${messageCounter}`;
}

export function SchemeAIAssistant({
  activeFarm,
  selectedSchemeId,
  onSelectScheme,
  className = '',
}: SchemeAIAssistantProps) {
  const [lang, setLang] = useState<SupportedLanguage>('en');
  const [currentSchemeId, setCurrentSchemeId] = useState<string>(selectedSchemeId || '');
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableSchemes, setAvailableSchemes] = useState<GovernmentScheme[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Synchronize available schemes from registry
  useEffect(() => {
    try {
      const list = getAllSchemes();
      setAvailableSchemes(list);
    } catch {
      // In SSR or edge cases
      setAvailableSchemes([]);
    }
  }, []);

  // Update selected scheme if prop changes
  useEffect(() => {
    if (selectedSchemeId !== undefined) {
      setCurrentSchemeId(selectedSchemeId);
    }
  }, [selectedSchemeId]);

  // Initial welcome message based on language
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-1',
      sender: 'assistant',
      text:
        lang === 'hi'
          ? 'नमस्ते! मैं एग्रीदोस्त का सरकारी योजना सहायक हूँ। मैं आपको पीएम-किसान, पीएमएफबीवाई, कुसुम सोलर पंप एवं अन्य कृषि सब्सिडी के आधिकारिक नियमों की सटीक जानकारी दे सकता हूँ। आप क्या जानना चाहते हैं?'
          : 'Namaste! I am your AgriDOST Government Assistance Advisor. I can guide you through verified central and state schemes like PM-KISAN, PMFBY, PM-KUSUM solar pumps, and KCC loans. How can I help you today?',
      timestamp: 'Today',
    },
  ]);

  // When language changes, update greeting if chat hasn't started
  const handleLangToggle = (newLang: SupportedLanguage) => {
    setLang(newLang);
    if (messages.length === 1) {
      setMessages([
        {
          id: 'welcome-1',
          sender: 'assistant',
          text:
            newLang === 'hi'
              ? 'नमस्ते! मैं एग्रीदोस्त का सरकारी योजना सहायक हूँ। मैं आपको पीएम-किसान, पीएमएफबीवाई, कुसुम सोलर पंप एवं अन्य कृषि सब्सिडी के आधिकारिक नियमों की सटीक जानकारी दे सकता हूँ। आप क्या जानना चाहते हैं?'
              : 'Namaste! I am your AgriDOST Government Assistance Advisor. I can guide you through verified central and state schemes like PM-KISAN, PMFBY, PM-KUSUM solar pumps, and KCC loans. How can I help you today?',
          timestamp: 'Today',
        },
      ]);
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const quickPrompts = [
    {
      id: 'pm-kisan-eligibility',
      en: 'PM-KISAN eligibility rules',
      hi: 'पीएम-किसान पात्रता नियम',
      schemeId: 'pm-kisan',
    },
    {
      id: 'pmfby-documents',
      en: 'Documents needed for PMFBY',
      hi: 'पीएम फसल बीमा के लिए दस्तावेज',
      schemeId: 'pmfby',
    },
    {
      id: 'kusum-subsidy',
      en: 'How to get 60% solar pump subsidy?',
      hi: 'सोलर पंप पर 60% सब्सिडी कैसे लें?',
      schemeId: 'pm-kusum',
    },
    {
      id: 'state-schemes',
      en: activeFarm?.locationDetails?.state
        ? `What schemes apply in ${activeFarm.locationDetails.state}?`
        : 'What schemes apply in Maharashtra/Punjab?',
      hi: activeFarm?.locationDetails?.state
        ? `मेरे राज्य (${activeFarm.locationDetails.state}) के लिए योजनाएं?`
        : 'मेरे राज्य के लिए कौन सी योजनाएं हैं?',
      schemeId: '',
    },
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: getNextMessageId('user'),
      sender: 'user',
      text,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          schemeId: currentSchemeId || undefined,
          farmContext: activeFarm
            ? {
                id: activeFarm.id,
                name: activeFarm.name,
                areaAcres: activeFarm.areaAcres,
                primaryCrop: activeFarm.primaryCrop,
                soilType: activeFarm.soilType,
                waterSource: activeFarm.waterSource,
                locationDetails: activeFarm.locationDetails,
              }
            : undefined,
          lang,
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();

      const assistantMsg: ChatMessage = {
        id: getNextMessageId('assistant'),
        sender: 'assistant',
        text: data.answer || 'No response available from verified registry.',
        timestamp: 'Just now',
        sources: data.sources || [],
        isOfflineFallback: data.status === 'offline_fallback',
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      // Offline client fallback
      const offline = getOfflineSchemeAnswer(
        text,
        availableSchemes,
        activeFarm,
        lang
      );

      const assistantMsg: ChatMessage = {
        id: getNextMessageId('assistant-fallback'),
        sender: 'assistant',
        text: offline.answer,
        timestamp: 'Just now',
        sources: offline.sources,
        isOfflineFallback: true,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: getNextMessageId('welcome'),
        sender: 'assistant',
        text:
          lang === 'hi'
            ? 'बातचीत रीसेट हो गई है। आप किसी भी सरकारी योजना के बारे में पुनः पूछ सकते हैं।'
            : 'Chat cleared. Feel free to ask about any government scheme, eligibility requirement, or document.',
        timestamp: 'Today',
      },
    ]);
  };

  return (
    <div
      className={`flex flex-col h-[700px] max-h-[85vh] rounded-2xl border border-[#E7E9E2] bg-white shadow-xs overflow-hidden ${className}`}
      data-testid="scheme-ai-assistant"
    >
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-[#E7E9E2] bg-[#F7F7F0] px-4 py-3 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#173F2B] text-white shadow-xs">
            <Sparkles className="h-5 w-5 text-[#DCE8D3]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-semibold text-sm text-[#26312A]">
                {t('nav.aiAdvisor', lang)}
              </h3>
              <span className="flex items-center gap-1 rounded-full bg-[#173F2B]/10 px-2 py-0.5 text-[10px] font-medium text-[#173F2B]">
                <CheckCircle2 className="h-3 w-3 text-[#173F2B]" />
                {t('badge.verified', lang)}
              </span>
            </div>
            <p className="text-xs text-[#4D6B53]">
              {activeFarm
                ? `${activeFarm.name} • ${activeFarm.areaAcres ? activeFarm.areaAcres.toFixed(1) : ''} Acres ${activeFarm.locationDetails?.state ? `• ${activeFarm.locationDetails.state}` : ''}`
                : lang === 'hi'
                ? 'सरकारी दिशानिर्देशों पर आधारित'
                : 'Based on official Government gazettes'}
            </p>
          </div>
        </div>

        {/* Controls: Scheme Filter, Language Toggle, Clear */}
        <div className="flex items-center gap-2">
          {/* Scheme Selector */}
          <div className="relative">
            <select
              value={currentSchemeId}
              onChange={(e) => {
                const val = e.target.value;
                setCurrentSchemeId(val);
                if (onSelectScheme) onSelectScheme(val);
              }}
              className="appearance-none rounded-lg border border-[#E7E9E2] bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-[#26312A] hover:border-[#173F2B]/40 focus:outline-hidden focus:ring-1 focus:ring-[#173F2B]"
              aria-label="Filter schemes"
            >
              <option value="">{t('action.allSchemes', lang)}</option>
              {availableSchemes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shortName || s.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3.5 w-3.5 text-[#4D6B53]" />
          </div>

          {/* Bilingual Toggle */}
          <div className="flex items-center rounded-lg border border-[#E7E9E2] bg-white p-0.5">
            <button
              type="button"
              onClick={() => handleLangToggle('en')}
              className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                lang === 'en'
                  ? 'bg-[#173F2B] text-white shadow-xs'
                  : 'text-[#4D6B53] hover:text-[#26312A]'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => handleLangToggle('hi')}
              className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                lang === 'hi'
                  ? 'bg-[#173F2B] text-white shadow-xs'
                  : 'text-[#4D6B53] hover:text-[#26312A]'
              }`}
            >
              हिंदी
            </button>
          </div>

          {/* Clear Chat */}
          <button
            type="button"
            onClick={handleClearChat}
            title={t('action.clearChat', lang)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E7E9E2] bg-white text-[#4D6B53] hover:bg-[#F7F7F0] hover:text-[#26312A]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Security Anti-Hallucination Disclaimer Banner */}
      <div className="flex items-start gap-2.5 border-b border-[#E7E9E2] bg-[#DCE8D3]/30 px-4 py-2 text-xs text-[#26312A]">
        <ShieldAlert className="h-4 w-4 shrink-0 text-[#173F2B] mt-0.5" />
        <div className="leading-tight">
          <span className="font-semibold text-[#173F2B]">
            {lang === 'hi' ? 'सुरक्षा सूचना: ' : 'Security Notice: '}
          </span>
          {t('disclaimer.ai', lang)}
        </div>
      </div>

      {/* 3. Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-2xs ${
                msg.sender === 'user'
                  ? 'bg-[#173F2B] text-white rounded-tr-xs'
                  : 'bg-[#F7F7F0] text-[#26312A] border border-[#E7E9E2] rounded-tl-xs'
              }`}
            >
              {/* Message Header for Assistant */}
              {msg.sender === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-[#E7E9E2]/60 text-[11px] font-semibold text-[#4D6B53]">
                  <Bot className="h-3.5 w-3.5 text-[#173F2B]" />
                  <span>AgriDOST AI Grounding</span>
                  {msg.isOfflineFallback && (
                    <span className="ml-auto rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.2 text-[9px] font-medium text-amber-800">
                      {lang === 'hi' ? 'स्थानीय रजिस्ट्री' : 'Verified Offline Registry'}
                    </span>
                  )}
                </div>
              )}

              {/* Message Content */}
              <div className="whitespace-pre-line">{msg.text}</div>

              {/* Source Citations */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-[#E7E9E2]/80 space-y-1.5">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-[#173F2B]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#173F2B]" />
                    <span>{lang === 'hi' ? 'आधिकारिक स्रोत एवं सत्यापन:' : 'Verified Sources & Citations:'}</span>
                  </div>
                  <div className="space-y-1">
                    {msg.sources.map((src, i) => (
                      <div
                        key={i}
                        className="flex flex-wrap items-center justify-between text-[11px] bg-white rounded-lg p-1.5 border border-[#E7E9E2]"
                      >
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 font-medium text-[#173F2B] hover:underline"
                        >
                          <span>{src.title}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <span className="text-[10px] text-[#4D6B53]">
                          {lang === 'hi' ? 'सत्यापित: ' : 'Verified: '}
                          {src.lastVerified}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="mt-1 text-[10px] text-[#4D6B53] px-1">
              {msg.timestamp}
            </span>
          </div>
        ))}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="rounded-2xl rounded-tl-xs border border-[#E7E9E2] bg-[#F7F7F0] p-4 shadow-2xs">
              <div className="flex items-center gap-2 text-xs text-[#4D6B53]">
                <div className="h-2 w-2 rounded-full bg-[#173F2B] animate-pulse" />
                <div className="h-2 w-2 rounded-full bg-[#173F2B] animate-pulse delay-150" />
                <div className="h-2 w-2 rounded-full bg-[#173F2B] animate-pulse delay-300" />
                <span className="ml-1 font-medium">
                  {lang === 'hi'
                    ? 'सरकारी नियमों का सत्यापन किया जा रहा है...'
                    : 'Verifying against official government guidelines...'}
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. Quick Prompts Section */}
      <div className="border-t border-[#E7E9E2] bg-[#F7F7F0]/60 p-2.5">
        <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-medium text-[#4D6B53]">
          <HelpCircle className="h-3 w-3" />
          <span>{lang === 'hi' ? 'त्वरित प्रश्न:' : 'Common Farmer Questions:'}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quickPrompts.map((qp) => (
            <button
              key={qp.id}
              type="button"
              onClick={() => {
                if (qp.schemeId) {
                  setCurrentSchemeId(qp.schemeId);
                  if (onSelectScheme) onSelectScheme(qp.schemeId);
                }
                handleSendMessage(lang === 'hi' ? qp.hi : qp.en);
              }}
              className="rounded-full border border-[#E7E9E2] bg-white px-2.5 py-1 text-xs text-[#26312A] hover:border-[#173F2B] hover:bg-[#DCE8D3]/30 transition-colors"
            >
              {lang === 'hi' ? qp.hi : qp.en}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Input Textarea & Send Bar */}
      <div className="border-t border-[#E7E9E2] bg-white p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={
              lang === 'hi'
                ? 'सरकारी योजनाओं, सब्सिडी या दस्तावेजों के बारे में पूछें...'
                : 'Ask about subsidies, eligibility rules, or documents...'
            }
            disabled={isLoading}
            className="flex-1 rounded-xl border border-[#E7E9E2] bg-[#F7F7F0] px-4 py-2.5 text-sm text-[#26312A] placeholder-[#4D6B53]/60 focus:border-[#173F2B] focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#173F2B]"
          />
          <button
            type="submit"
            disabled={isLoading || !inputMessage.trim()}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#173F2B] px-4 text-xs font-semibold text-white shadow-xs hover:bg-[#26312A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span>{t('action.sendMessage', lang)}</span>
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

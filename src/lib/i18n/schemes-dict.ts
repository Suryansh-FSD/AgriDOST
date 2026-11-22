/**
 * AgriDOST: Bilingual (English / Hindi) Dictionary for Government Schemes
 * Version 1.0.0
 * 
 * Provides comprehensive translations for scheme navigation, eligibility criteria,
 * document requirements, status indicators, and official disclaimers.
 */

export type SupportedLanguage = 'en' | 'hi';

export interface TranslationDictionary {
  [key: string]: {
    en: string;
    hi: string;
  };
}

export const SCHEMES_DICTIONARY: TranslationDictionary = {
  // Navigation & Page Headings
  'nav.title': {
    en: 'Government Assistance',
    hi: 'सरकारी योजनाएं और सहायता',
  },
  'nav.subtitle': {
    en: 'Verified Central & State Schemes for Farmers',
    hi: 'किसानों के लिए सत्यापित केंद्र और राज्य सरकार की योजनाएं',
  },
  'nav.overview': {
    en: 'Overview',
    hi: 'अवलोकन',
  },
  'nav.schemes': {
    en: 'Schemes & Subsidies',
    hi: 'योजनाएं और सब्सिडी',
  },
  'nav.eligibility': {
    en: 'Eligibility Checker',
    hi: 'पात्रता जांच',
  },
  'nav.documents': {
    en: 'Document Assistant',
    hi: 'दस्तावेज सहायक',
  },
  'nav.application': {
    en: 'Application Guide',
    hi: 'आवेदन मार्गदर्शिका',
  },
  'nav.tracker': {
    en: 'My Applications',
    hi: 'मेरे आवेदन',
  },
  'nav.aiAdvisor': {
    en: 'AI Scheme Advisor',
    hi: 'एआई योजना सलाहकार',
  },
  'nav.reminders': {
    en: 'Deadlines & Reminders',
    hi: 'समय-सीमा और अनुस्मारक',
  },

  // Government Hierarchy & Levels
  'level.central': {
    en: 'Central Government',
    hi: 'केंद्र सरकार',
  },
  'level.state': {
    en: 'State Government',
    hi: 'राज्य सरकार',
  },
  'level.district': {
    en: 'District Level',
    hi: 'जिला स्तर',
  },

  // Farmer Categories
  'category.marginal': {
    en: 'Marginal Farmer (< 1 Ha / 2.47 Acres)',
    hi: 'सीमांत किसान (< 1 हेक्टेयर / 2.47 एकड़)',
  },
  'category.small': {
    en: 'Small Farmer (1-2 Ha / 2.47-4.94 Acres)',
    hi: 'लघु किसान (1-2 हेक्टेयर / 2.47-4.94 एकड़)',
  },
  'category.semi_medium': {
    en: 'Semi-Medium (2-4 Ha / 4.94-9.88 Acres)',
    hi: 'अर्ध-मध्यम किसान (2-4 हेक्टेयर / 4.94-9.88 एकड़)',
  },
  'category.medium': {
    en: 'Medium (4-10 Ha / 9.88-24.7 Acres)',
    hi: 'मध्यम किसान (4-10 हेक्टेयर / 9.88-24.7 एकड़)',
  },
  'category.large': {
    en: 'Large (> 10 Ha / > 24.7 Acres)',
    hi: 'बड़े किसान (> 10 हेक्टेयर / > 24.7 एकड़)',
  },
  'category.tenant': {
    en: 'Tenant Cultivator',
    hi: 'काश्तकार / पट्टेदार किसान',
  },
  'category.sharecropper': {
    en: 'Sharecropper',
    hi: 'बटाईदार किसान',
  },
  'category.women': {
    en: 'Women Farmer',
    hi: 'महिला किसान',
  },
  'category.sc_st': {
    en: 'SC / ST Farmer',
    hi: 'अनुसूचित जाति / जनजाति किसान',
  },
  'category.all': {
    en: 'All Farmers',
    hi: 'सभी किसान',
  },

  // Benefit Types
  'benefit.direct_benefit_transfer': {
    en: 'Direct Benefit Transfer (DBT)',
    hi: 'प्रत्यक्ष लाभ अंतरण (DBT)',
  },
  'benefit.interest_subvention': {
    en: 'Interest Subvention',
    hi: 'ब्याज अनुदान',
  },
  'benefit.input_subsidy': {
    en: 'Input Subsidy',
    hi: 'कृषि आदान सब्सिडी',
  },
  'benefit.infrastructure_grant': {
    en: 'Infrastructure Grant',
    hi: 'बुनियादी ढांचा अनुदान',
  },
  'benefit.crop_insurance': {
    en: 'Crop Insurance',
    hi: 'फसल बीमा',
  },
  'benefit.pension': {
    en: 'Farmer Pension',
    hi: 'किसान पेंशन',
  },
  'benefit.solar_pump_subsidy': {
    en: 'Solar Pump Subsidy',
    hi: 'सोलर पंप सब्सिडी',
  },
  'benefit.mechanization_subsidy': {
    en: 'Farm Mechanization Subsidy',
    hi: 'कृषि यंत्रीकरण सब्सिडी',
  },

  // Eligibility Evaluation Statuses
  'status.eligible': {
    en: 'Eligible',
    hi: 'पात्र',
  },
  'status.ineligible': {
    en: 'Ineligible',
    hi: 'अपात्र',
  },
  'status.potentially_eligible': {
    en: 'Potentially Eligible',
    hi: 'संभावित रूप से पात्र',
  },
  'status.potentially_ineligible': {
    en: 'Potentially Ineligible',
    hi: 'संभावित रूप से अपात्र',
  },
  'status.more_information_required': {
    en: 'More Information Required',
    hi: 'अतिरिक्त जानकारी आवश्यक',
  },
  'status.official_verification_required': {
    en: 'Official Verification Required',
    hi: 'आधिकारिक सत्यापन आवश्यक',
  },

  // Application Lifecycle Statuses
  'status.draft': {
    en: 'Draft',
    hi: 'मसौदा',
  },
  'status.preparing_documents': {
    en: 'Preparing Documents',
    hi: 'दस्तावेज तैयार करना',
  },
  'status.ready_to_apply': {
    en: 'Ready to Apply',
    hi: 'आवेदन के लिए तैयार',
  },
  'status.submitted': {
    en: 'Submitted',
    hi: 'जमा किया गया',
  },
  'status.under_review': {
    en: 'Under Review',
    hi: 'समीक्षाधीन',
  },
  'status.additional_info_required': {
    en: 'Additional Info Required',
    hi: 'अतिरिक्त जानकारी आवश्यक',
  },
  'status.approved': {
    en: 'Approved',
    hi: 'स्वीकृत',
  },
  'status.rejected': {
    en: 'Rejected',
    hi: 'अस्वीकृत',
  },
  'status.closed': {
    en: 'Closed',
    hi: 'बंद',
  },

  // Application Availability
  'availability.open': {
    en: 'Applications Open',
    hi: 'आवेदन खुले हैं',
  },
  'availability.seasonal': {
    en: 'Seasonal Window',
    hi: 'मौसमी अवधि',
  },
  'availability.closed': {
    en: 'Applications Closed',
    hi: 'आवेदन बंद हैं',
  },
  'availability.ongoing': {
    en: 'Ongoing / Year-Round',
    hi: 'निरंतर / पूरे वर्ष',
  },

  // Verification Badges
  'badge.verified': {
    en: 'Official & Verified',
    hi: 'आधिकारिक एवं सत्यापित',
  },
  'badge.unverified': {
    en: 'Unverified / Community',
    hi: 'असत्यापित / समुदाय',
  },
  'badge.user_reported': {
    en: 'Farmer Reported',
    hi: 'किसान द्वारा दर्ज',
  },
  'badge.official_confirmed': {
    en: 'Govt Confirmed',
    hi: 'सरकारी पुष्टि',
  },

  // Document Types & Requirements
  'doc.aadhaar': {
    en: 'Aadhaar Card (UIDAI)',
    hi: 'आधार कार्ड (UIDAI)',
  },
  'doc.land_record': {
    en: 'Land Record (7/12 / Khatauni / Jamabandi)',
    hi: 'भूलेख (खतौनी / 7/12 / जमाबंदी)',
  },
  'doc.bank_passbook': {
    en: 'Bank Passbook (Aadhaar Seeded & NPCI Active)',
    hi: 'बैंक पासबुक (आधार लिंक एवं NPCI सक्रिय)',
  },
  'doc.sowing_certificate': {
    en: 'Crop Sowing Certificate / Patwari Report',
    hi: 'फसल बुवाई प्रमाण पत्र / पटवारी रिपोर्ट',
  },
  'doc.caste_certificate': {
    en: 'Caste Certificate (SC/ST/OBC)',
    hi: 'जाति प्रमाण पत्र (SC/ST/OBC)',
  },
  'doc.quotation': {
    en: 'Equipment / Solar Quotation from Authorized Dealer',
    hi: 'अधिकृत डीलर से उपकरण / सोलर कोटेशन',
  },
  'doc.tenancy_proof': {
    en: 'Registered Lease Agreement / Cultivator NOC',
    hi: 'पट्टा अनुबंध / भूस्वामी अनापत्ति प्रमाण',
  },
  'doc.photo': {
    en: 'Passport Size Photograph',
    hi: 'पासपोर्ट आकार की फोटो',
  },
  'doc.electricity_bill': {
    en: 'Electricity Bill or No-Dues Certificate',
    hi: 'बिजली बिल अथवा बकाया-रहित प्रमाण पत्र',
  },
  'doc.mandatory': {
    en: 'Mandatory Document',
    hi: 'अनिवार्य दस्तावेज',
  },
  'doc.optional': {
    en: 'Optional / Supporting',
    hi: 'वैकल्पिक / सहायक',
  },
  'doc.available': {
    en: 'Available in DigiLocker / Physical',
    hi: 'डिजिलॉकर / भौतिक रूप से उपलब्ध',
  },
  'doc.missing': {
    en: 'Missing / Needed',
    hi: 'अनुपलब्ध / आवश्यक',
  },
  'doc.in_progress': {
    en: 'In Progress / Applied',
    hi: 'प्रक्रियाधीन / आवेदन किया गया',
  },

  // UI Actions & Controls
  'action.apply': {
    en: 'Apply on Official Portal',
    hi: 'आधिकारिक पोर्टल पर आवेदन करें',
  },
  'action.checkEligibility': {
    en: 'Check My Eligibility',
    hi: 'मेरी पात्रता जांचें',
  },
  'action.viewDetails': {
    en: 'View Scheme Details',
    hi: 'योजना का विवरण देखें',
  },
  'action.askAI': {
    en: 'Ask AI Assistant',
    hi: 'एआई सहायक से पूछें',
  },
  'action.downloadChecklist': {
    en: 'Download Document Checklist',
    hi: 'दस्तावेज चेकलिस्ट डाउनलोड करें',
  },
  'action.trackApplication': {
    en: 'Track Application Status',
    hi: 'आवेदन की स्थिति ट्रैक करें',
  },
  'action.filter': {
    en: 'Filter Schemes',
    hi: 'योजनाएं फ़िल्टर करें',
  },
  'action.search': {
    en: 'Search schemes by name, crop, or benefit...',
    hi: 'योजना के नाम, फसल या लाभ से खोजें...',
  },
  'action.allSchemes': {
    en: 'All Schemes',
    hi: 'सभी योजनाएं',
  },
  'action.selectScheme': {
    en: 'Select Scheme',
    hi: 'योजना चुनें',
  },
  'action.sendMessage': {
    en: 'Ask Question',
    hi: 'प्रश्न पूछें',
  },
  'action.clearChat': {
    en: 'Clear Chat',
    hi: 'बातचीत साफ करें',
  },
  'action.retry': {
    en: 'Try Again',
    hi: 'पुनः प्रयास करें',
  },
  'action.close': {
    en: 'Close',
    hi: 'बंद करें',
  },
  'action.back': {
    en: 'Back',
    hi: 'वापस जाएं',
  },
  'action.copyLink': {
    en: 'Copy Official Link',
    hi: 'आधिकारिक लिंक कॉपी करें',
  },

  // Security, Anti-Fraud & Legal Disclaimers
  'disclaimer.ai': {
    en: 'AgriDOST AI provides informational assistance based on official government guidelines. Never share OTPs, bank passwords, or full Aadhaar numbers.',
    hi: 'एग्रीदोस्त एआई आधिकारिक सरकारी दिशा-निर्देशों के आधार पर जानकारी प्रदान करता है। कभी भी ओटीपी, बैंक पासवर्ड या पूर्ण आधार नंबर साझा न करें।',
  },
  'disclaimer.eligibility': {
    en: 'Eligibility results are indicative and based on published government criteria. Final sanction is subject to official verification by designated departments.',
    hi: 'पात्रता परिणाम सांकेतिक हैं और प्रकाशित सरकारी मानदंडों पर आधारित हैं। अंतिम स्वीकृति संबंधित विभाग के सत्यापन पर निर्भर है।',
  },
  'disclaimer.official_portal': {
    en: 'AgriDOST does not submit applications on your behalf. Always complete and verify your application directly on the official government portal.',
    hi: 'एग्रीदोस्त आपकी ओर से आवेदन जमा नहीं करता है। हमेशा आधिकारिक सरकारी पोर्टल पर जाकर ही अपना आवेदन पूरा और सत्यापित करें।',
  },
  'disclaimer.anti_fraud': {
    en: 'Government schemes do not charge unauthorized agent fees. Beware of fake agents, fraudulent phone calls, and unofficial APKs.',
    hi: 'सरकारी योजनाओं के लिए कोई अनधिकृत एजेंट शुल्क न दें। फर्जी एजेंटों, धोखाधड़ी वाली कॉल और अनधिकृत ऐप्स से सावधान रहें।',
  },
  'disclaimer.offline': {
    en: 'Operating in offline mode. Responses are generated using verified local registry data.',
    hi: 'ऑफ़लाइन मोड में कार्य कर रहा है। उत्तर स्थानीय सत्यापित रजिस्ट्री डेटा पर आधारित हैं।',
  },
  'disclaimer.no_guarantee': {
    en: 'AgriDOST never guarantees subsidy approval, disbursement timelines, or payment amounts.',
    hi: 'एग्रीदोस्त कभी भी सब्सिडी स्वीकृति, भुगतान समय-सीमा या राशि की गारंटी नहीं देता है।',
  },
  'disclaimer.unknown_scheme': {
    en: 'This scheme is not officially verified in AgriDOST registry. Please consult your local Krishi Vigyan Kendra (KVK) or CSC center.',
    hi: 'यह योजना एग्रीदोस्त रजिस्ट्री में आधिकारिक रूप से सत्यापित नहीं है। कृपया अपने नजदीकी कृषि विज्ञान केंद्र (KVK) या जन सेवा केंद्र (CSC) से संपर्क करें।',
  },
};

/**
 * Translate a key into the requested language with fallback to English.
 * If the key does not exist, returns the key itself as a fallback.
 */
export function t(key: string, lang: SupportedLanguage = 'en'): string {
  const item = SCHEMES_DICTIONARY[key];
  if (!item) {
    return key;
  }
  return item[lang] || item.en || key;
}

/**
 * Get all available translations for a given language.
 */
export function getDictionary(lang: SupportedLanguage = 'en'): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(SCHEMES_DICTIONARY)) {
    result[k] = v[lang] || v.en;
  }
  return result;
}

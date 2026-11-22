/**
 * AgriDOST 4.0: Security, SSRF Prevention & Source Provenance Classifier
 * Enforces strict containment around external web research data.
 */

import { SourceClassification } from './types';
import { TinyFishSSRFError } from './errors';

// Disallowed hostnames and metadata endpoints
const DISALLOWED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254',
  'instance-data',
]);

const DISALLOWED_HOSTNAME_SUFFIXES = [
  '.local',
  '.internal',
  '.lan',
  '.home',
  '.corp',
  '.cluster.local',
];

/**
 * Validates a target URL against SSRF vulnerabilities.
 * Throws TinyFishSSRFError if the URL targets loopback, private RFC-1918 networks,
 * cloud metadata endpoints, or unsupported protocols.
 */
export function validateSafeUrl(urlString: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new TinyFishSSRFError(`Invalid URL string: '${urlString}'`);
  }

  // Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TinyFishSSRFError(`Prohibited protocol '${parsed.protocol}'. Only http: and https: are allowed.`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Explicit blacklisted hostnames
  if (DISALLOWED_HOSTNAMES.has(hostname)) {
    throw new TinyFishSSRFError(`Prohibited host '${hostname}' (loopback or cloud metadata endpoint).`);
  }

  // Blacklisted suffixes
  for (const suffix of DISALLOWED_HOSTNAME_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      throw new TinyFishSSRFError(`Prohibited internal network domain: '${hostname}'.`);
    }
  }

  // IPv4 Private Range Validation
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octet1 = parseInt(ipv4Match[1], 10);
    const octet2 = parseInt(ipv4Match[2], 10);

    // 127.0.0.0/8 (Loopback)
    if (octet1 === 127) {
      throw new TinyFishSSRFError(`Prohibited loopback IPv4 address: '${hostname}'.`);
    }
    // 10.0.0.0/8 (Private RFC 1918)
    if (octet1 === 10) {
      throw new TinyFishSSRFError(`Prohibited private IPv4 address: '${hostname}'.`);
    }
    // 172.16.0.0/12 (Private RFC 1918)
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) {
      throw new TinyFishSSRFError(`Prohibited private IPv4 address: '${hostname}'.`);
    }
    // 192.168.0.0/16 (Private RFC 1918)
    if (octet1 === 192 && octet2 === 168) {
      throw new TinyFishSSRFError(`Prohibited private IPv4 address: '${hostname}'.`);
    }
    // 169.254.0.0/16 (Link Local & Cloud Metadata)
    if (octet1 === 169 && octet2 === 254) {
      throw new TinyFishSSRFError(`Prohibited link-local/cloud metadata IPv4 address: '${hostname}'.`);
    }
    // 0.0.0.0/8
    if (octet1 === 0) {
      throw new TinyFishSSRFError(`Prohibited broadcast IPv4 address: '${hostname}'.`);
    }
  }

  // IPv6 checks
  if (hostname.startsWith('[') || hostname.includes(':')) {
    if (hostname.includes('::1') || hostname.startsWith('fc') || hostname.startsWith('fe80')) {
      throw new TinyFishSSRFError(`Prohibited IPv6 address: '${hostname}'.`);
    }
  }

  return parsed;
}

/**
 * Classifies an agricultural information source URL into verified categories.
 */
export function classifySource(urlString: string): {
  classification: SourceClassification;
  isOfficial: boolean;
  domain: string;
} {
  try {
    const url = new URL(urlString);
    const domain = url.hostname.toLowerCase().replace(/^www\./, '');

    // 1. Official Central & State Government (.gov.in, .nic.in, and core portals)
    if (
      domain.endsWith('.gov.in') ||
      domain.endsWith('.nic.in') ||
      domain === 'pmkisan.gov.in' ||
      domain === 'agmarknet.gov.in' ||
      domain === 'data.gov.in' ||
      domain === 'pmindia.gov.in' ||
      domain === 'pib.gov.in' ||
      domain === 'india.gov.in' ||
      domain === 'enam.gov.in' ||
      domain === 'upagripardarshi.gov.in' ||
      domain === 'agriharyana.gov.in' ||
      domain === 'krishi.maharashtra.gov.in'
    ) {
      const isStateDept = domain.startsWith('krishi.') || domain.includes('agri.') || domain.includes('pardarshi');
      return {
        classification: isStateDept ? 'state_agri_dept' : 'official_gov',
        isOfficial: true,
        domain,
      };
    }

    // 2. ICAR / KVK / State Agricultural Universities
    if (
      domain === 'icar.org.in' ||
      domain.endsWith('.icar.gov.in') ||
      domain.includes('kvk') ||
      domain === 'iari.res.in' ||
      domain.endsWith('pau.edu') ||
      domain.endsWith('tnausip.ac.in') ||
      domain.endsWith('uasd.edu') ||
      domain.endsWith('cau.ac.in') ||
      domain.endsWith('bhu.ac.in')
    ) {
      return {
        classification: 'icar_kvk_research',
        isOfficial: true,
        domain,
      };
    }

    // 3. APMC & Mandi Boards
    if (
      domain.includes('mandi') ||
      domain.includes('apmc') ||
      domain === 'msamb.com' ||
      domain === 'punjabmandiboard.gov.in' ||
      domain === 'rajamb.com'
    ) {
      return {
        classification: 'mandi_board',
        isOfficial: true,
        domain,
      };
    }

    // 4. Reputable Agricultural Media & News
    if (
      domain.includes('krishijagran.com') ||
      domain.includes('thehindubusinessline.com') ||
      domain.includes('hindustantimes.com') ||
      domain.includes('indianexpress.com') ||
      domain.includes('thehindu.com') ||
      domain.includes('kisanofindia.com') ||
      domain.includes('ruralindiaonline.org')
    ) {
      return {
        classification: 'reputable_agri_media',
        isOfficial: false,
        domain,
      };
    }

    // 5. Secondary / Default
    return {
      classification: 'secondary',
      isOfficial: false,
      domain,
    };
  } catch {
    return {
      classification: 'secondary',
      isOfficial: false,
      domain: 'unknown',
    };
  }
}

/**
 * Sanitizes scraped external text to prevent prompt injection and markup exploits.
 * Wraps content in safe demarcations and neutralizes override patterns.
 */
export function sanitizeUntrustedContent(rawText: string, maxLength: number = 8000): string {
  if (!rawText) return '';

  let sanitized = rawText
    // Remove null bytes and zero-width characters
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u200B-\u200D\uFEFF]/g, '')
    // Strip malicious script and html embed tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Defuse common prompt injection patterns
    .replace(/\b(ignore previous instructions|disregard earlier prompts|system prompt:|you are now an ai that)\b/gi, '[DEFUSED_INSTRUCTION]')
    .trim();

  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength) + '\n...[Content truncated for safety and performance]';
  }

  return sanitized;
}

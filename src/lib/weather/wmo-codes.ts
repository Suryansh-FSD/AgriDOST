/**
 * AgriDOST 4.0: WMO Weather Interpretation Codes (WW)
 * Standard World Meteorological Organization code definitions with English & Hindi translations.
 */

import { WeatherConditionDetails } from '@/types/weather';

export const WMO_CODE_TABLE: Record<number, { en: string; hi: string; isRain: boolean; isSevere: boolean }> = {
  0: { en: 'Clear sky', hi: 'साफ आसमान', isRain: false, isSevere: false },
  1: { en: 'Mainly clear', hi: 'अधिकांशतः साफ आसमान', isRain: false, isSevere: false },
  2: { en: 'Partly cloudy', hi: 'आंशिक रूप से बादल', isRain: false, isSevere: false },
  3: { en: 'Overcast', hi: 'घने बादल', isRain: false, isSevere: false },
  45: { en: 'Fog', hi: 'कोहरा', isRain: false, isSevere: false },
  48: { en: 'Depositing rime fog', hi: 'सघन जमाव वाला कोहरा', isRain: false, isSevere: false },
  51: { en: 'Light drizzle', hi: 'हल्की बूंदाबांदी', isRain: true, isSevere: false },
  53: { en: 'Moderate drizzle', hi: 'मध्यम बूंदाबांदी', isRain: true, isSevere: false },
  55: { en: 'Dense drizzle', hi: 'सघन बूंदाबांदी', isRain: true, isSevere: false },
  56: { en: 'Light freezing drizzle', hi: 'हल्की बर्फीली बूंदाबांदी', isRain: true, isSevere: true },
  57: { en: 'Dense freezing drizzle', hi: 'सघन बर्फीली बूंदाबांदी', isRain: true, isSevere: true },
  61: { en: 'Slight rain', hi: 'हल्की बारिश', isRain: true, isSevere: false },
  63: { en: 'Moderate rain', hi: 'मध्यम बारिश', isRain: true, isSevere: false },
  65: { en: 'Heavy rain', hi: 'भारी बारिश', isRain: true, isSevere: true },
  66: { en: 'Light freezing rain', hi: 'हल्की बर्फीली बारिश', isRain: true, isSevere: true },
  67: { en: 'Heavy freezing rain', hi: 'भारी बर्फीली बारिश', isRain: true, isSevere: true },
  71: { en: 'Slight snow fall', hi: 'हल्की बर्फबारी', isRain: false, isSevere: false },
  73: { en: 'Moderate snow fall', hi: 'मध्यम बर्फबारी', isRain: false, isSevere: true },
  75: { en: 'Heavy snow fall', hi: 'भारी बर्फबारी', isRain: false, isSevere: true },
  77: { en: 'Snow grains', hi: 'बर्फ के दाने', isRain: false, isSevere: false },
  80: { en: 'Slight rain showers', hi: 'हल्की बौछारें', isRain: true, isSevere: false },
  81: { en: 'Moderate rain showers', hi: 'मध्यम बौछारें', isRain: true, isSevere: false },
  82: { en: 'Violent rain showers', hi: 'तेज मूसलाधार बौछारें', isRain: true, isSevere: true },
  85: { en: 'Slight snow showers', hi: 'हल्की हिम बौछारें', isRain: false, isSevere: false },
  86: { en: 'Heavy snow showers', hi: 'भारी हिम बौछारें', isRain: false, isSevere: true },
  95: { en: 'Thunderstorm', hi: 'गरज के साथ आंधी/तूफान', isRain: true, isSevere: true },
  96: { en: 'Thunderstorm with slight hail', hi: 'हल्के ओलों के साथ आंधी', isRain: true, isSevere: true },
  99: { en: 'Thunderstorm with heavy hail', hi: 'भारी ओलावृष्टि के साथ भीषण आंधी', isRain: true, isSevere: true },
};

/**
 * Returns bilingual human-friendly weather description
 */
export function getWmoWeatherDescription(code: number): { en: string; hi: string } {
  const match = WMO_CODE_TABLE[code];
  if (match) {
    return { en: match.en, hi: match.hi };
  }
  return { en: `Weather code ${code}`, hi: `मौसम कोड ${code}` };
}

/**
 * Returns structured details about a given weather code
 */
export function getWmoDetails(code: number): WeatherConditionDetails {
  const match = WMO_CODE_TABLE[code];
  if (match) {
    return {
      code,
      descriptionEn: match.en,
      descriptionHi: match.hi,
      isRain: match.isRain,
      isSevere: match.isSevere,
    };
  }
  return {
    code,
    descriptionEn: `Condition ${code}`,
    descriptionHi: `स्थिति ${code}`,
    isRain: false,
    isSevere: false,
  };
}

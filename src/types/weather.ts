/**
 * AgriDOST 4.0: Comprehensive Weather & Agro-Meteorological Type Definitions
 * Integrates Open-Meteo API, agro-climatic caching, and CIBRC drone spray safety guidelines.
 */

import { DataFreshnessMetadata, IntegrationHealthResponse } from './integrations';

/**
 * Geographic coordinates for farm weather queries
 */
export interface WeatherCoordinates {
  latitude: number;
  longitude: number;
  label?: string;
  elevation?: number;
}

/**
 * Standard WMO Weather Code interpretation
 */
export interface WeatherConditionDetails {
  code: number;
  descriptionEn: string;
  descriptionHi: string;
  isRain: boolean;
  isSevere: boolean;
}

/**
 * Core farm current weather data model
 */
export interface FarmWeatherData {
  temperature: number; // °C (2m above ground)
  relativeHumidity: number; // % (2m above ground)
  precipitation: number; // mm
  precipitationProbability: number; // %
  windSpeed: number; // km/h (10m above ground, converted from m/s or km/h)
  windDirection: number; // degrees (0-360)
  weatherCode: number; // WMO weather code (0-99)
  uvIndex: number; // UV index (0-11+)
  conditionText: string; // Human-readable English description
  conditionTextHi: string; // Human-readable Hindi description
  isDay?: boolean; // Whether current observation is daytime
  time: string; // ISO 8601 string
}

/**
 * Hourly forecast item (for upcoming 24 - 168 hours)
 */
export interface HourlyForecastItem {
  time: string; // ISO 8601 string
  temperature: number; // °C
  relativeHumidity: number; // %
  precipitation: number; // mm
  precipitationProbability: number; // %
  windSpeed: number; // km/h
  windDirection: number; // degrees
  weatherCode: number; // WMO code
  uvIndex: number;
  conditionText: string;
}

/**
 * Daily forecast item (for upcoming 7 days)
 */
export interface DailyForecastItem {
  date: string; // YYYY-MM-DD
  maxTemperature: number; // °C
  minTemperature: number; // °C
  precipitationSum: number; // mm
  precipitationProbabilityMax: number; // %
  maxWindSpeed: number; // km/h
  weatherCode: number; // WMO code
  uvIndexMax: number;
  sunrise?: string; // ISO 8601
  sunset?: string; // ISO 8601
  conditionText: string;
}

/**
 * Parameter-specific safety evaluation status
 */
export type SprayConditionStatus = 'optimal' | 'marginal' | 'hazardous';

/**
 * Detailed breakdown per parameter evaluated against CIBRC rules
 */
export interface SprayParameterAssessment {
  value: number;
  unit: string;
  status: SprayConditionStatus;
  message: string;
  cibrcThreshold: string;
}

/**
 * Drone spray safety assessment based on CIBRC & DGCA agricultural aviation SOPs
 */
export interface SpraySafetyAssessment {
  status: SprayConditionStatus; // Overall safety status
  suitability: SprayConditionStatus; // Alias for seamless backwards compatibility
  driftIndex: number; // 0 (lowest drift risk) to 100 (extreme drift hazard)
  warnings: string[]; // List of specific hazards or cautions
  cibrGuidelinesMet: boolean; // True if within CIBRC guidelines (optimal or marginal)
  cibrcGuidelinesMet: boolean; // Alias for CIBRC guidelines conformity
  
  /**
   * CRITICAL SAFETY RULE: Under DGCA & CIBRC regulations, drone spraying
   * must NEVER be initiated autonomously. Licensed Remote Pilot-in-Command (RPIC)
   * must inspect field boundaries and verify local anemometer readings.
   */
  humanVerificationRequired: true;
  advisoryStatement: string; // Explicit human-verification warning text
  advisoryStatementHi: string; // Hindi warning text

  parameters: {
    wind: SprayParameterAssessment;
    temperature: SprayParameterAssessment;
    humidity: SprayParameterAssessment;
    precipitation: SprayParameterAssessment;
  };

  evaluatedAt: string; // ISO 8601 timestamp
}

/**
 * Evaluated hourly spray opportunity slot
 */
export interface SprayWindowSlot {
  time: string; // ISO 8601 timestamp
  status: SprayConditionStatus;
  driftIndex: number;
  windSpeed: number; // km/h
  temperature: number; // °C
  relativeHumidity: number; // %
  precipitationProbability: number; // %
  warnings: string[];
  recommendation: string;
}

/**
 * Complete consolidated farm weather response with metadata and spray assessment
 */
export interface FarmWeatherResponse {
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone: string;
  current: FarmWeatherData;
  hourly: HourlyForecastItem[];
  daily: DailyForecastItem[];
  sprayAssessment: SpraySafetyAssessment;
  upcomingSprayWindows: SprayWindowSlot[];
  attribution: string; // Required attribution: "Weather data by Open-Meteo.com (CC-BY 4.0)"
  freshness: DataFreshnessMetadata;
}

/**
 * API route wrapper response
 */
export interface WeatherApiResponse {
  success: boolean;
  data?: FarmWeatherResponse;
  health: IntegrationHealthResponse;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Open-Meteo raw API response types for typing upstream data
 */
export interface OpenMeteoRawResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current?: {
    time: string;
    interval?: number;
    temperature_2m: number;
    relative_humidity_2m: number;
    precipitation: number;
    precipitation_probability?: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    is_day?: number;
    uv_index?: number;
  };
  current_weather?: {
    time: string;
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
    is_day?: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    precipitation: number[];
    precipitation_probability: number[];
    weather_code: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    uv_index?: number[];
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
    uv_index_max?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
}

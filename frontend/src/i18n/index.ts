import en from './locales/en.json';
import kn from './locales/kn.json';
import hi from './locales/hi.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import mr from './locales/mr.json';
import ml from './locales/ml.json';
import bn from './locales/bn.json';
import gu from './locales/gu.json';
import pa from './locales/pa.json';
import od from './locales/od.json';
import { RegionalLanguage } from '../types';

export const SUPPORTED_LANGUAGES: RegionalLanguage[] = [
  { code: 'en-IN', name: 'English', native_name: 'English', is_default: true },
  { code: 'kn-IN', name: 'Kannada', native_name: 'ಕನ್ನಡ (Kannada)', is_priority: true },
  { code: 'hi-IN', name: 'Hindi', native_name: 'हिन्दी (Hindi)' },
  { code: 'ta-IN', name: 'Tamil', native_name: 'தமிழ் (Tamil)' },
  { code: 'te-IN', name: 'Telugu', native_name: 'తెలుగు (Telugu)' },
  { code: 'mr-IN', name: 'Marathi', native_name: 'मराठी (Marathi)' },
  { code: 'ml-IN', name: 'Malayalam', native_name: 'മലയാളം (Malayalam)' },
  { code: 'bn-IN', name: 'Bengali', native_name: 'বাংলা (Bengali)' },
  { code: 'gu-IN', name: 'Gujarati', native_name: 'ગુજરાતી (Gujarati)' },
  { code: 'pa-IN', name: 'Punjabi', native_name: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'od-IN', name: 'Odia', native_name: 'ଓଡ଼ିଆ (Odia)' }
];

export const LOCALES: Record<string, any> = {
  'en-IN': en,
  'kn-IN': kn,
  'hi-IN': hi,
  'ta-IN': ta,
  'te-IN': te,
  'mr-IN': mr,
  'ml-IN': ml,
  'bn-IN': bn,
  'gu-IN': gu,
  'pa-IN': pa,
  'od-IN': od
};

/**
 * Translates a key by looking into nested objects (e.g. 'forms.farmerName' or 'stages.Application Submitted')
 * or by scanning top-level dictionary entries. If missing, cleanly falls back to English, then original key.
 */
export function translate(key: string, langCode: string = 'en-IN'): string {
  if (!key) return '';
  if (langCode === 'en-IN' && !key.includes('.')) {
    // Check if flat english key exists in en locale
    const directEn = findInObject(LOCALES['en-IN'], key);
    return directEn || key;
  }

  const locale = LOCALES[langCode] || LOCALES['en-IN'];
  
  // 1. Dotted path lookup
  if (key.includes('.')) {
    const parts = key.split('.');
    let cur = locale;
    for (const part of parts) {
      if (cur && typeof cur === 'object' && part in cur) {
        cur = cur[part];
      } else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === 'string') return cur;

    // Fallback to English dotted path
    let curEn = LOCALES['en-IN'];
    for (const part of parts) {
      if (curEn && typeof curEn === 'object' && part in curEn) {
        curEn = curEn[part];
      } else {
        curEn = undefined;
        break;
      }
    }
    if (typeof curEn === 'string') return curEn;
  }

  // 2. Direct search in locale sections
  const found = findInObject(locale, key);
  if (found) return found;

  // 3. Fallback to English
  const foundEn = findInObject(LOCALES['en-IN'], key);
  if (foundEn) return foundEn;

  return key;
}

function findInObject(obj: any, targetKey: string): string | null {
  if (!obj || typeof obj !== 'object') return null;

  // Exact match on immediate key
  if (targetKey in obj && typeof obj[targetKey] === 'string') {
    return obj[targetKey];
  }

  // Check in common sub-sections: stages, statuses, dashboard, forms, nav, profile, assistant, claims, damage
  for (const section of Object.keys(obj)) {
    const sub = obj[section];
    if (sub && typeof sub === 'object') {
      if (targetKey in sub && typeof sub[targetKey] === 'string') {
        return sub[targetKey];
      }
    }
  }

  return null;
}


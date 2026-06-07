export const SUPPORTED_LANGUAGES = {
  hi: { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  mr: { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  ta: { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  te: { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  kn: { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  bn: { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  gu: { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  ml: { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  pa: { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  ur: { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  ar: { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  ne: { code: 'ne', name: 'Nepali', nativeName: 'नेपाली' },
  sa: { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्' },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

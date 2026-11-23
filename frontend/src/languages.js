export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", native: "English", label: "English (English)" },
  { code: "hi-IN", name: "Hindi", native: "हिन्दी", label: "Hindi (हिन्दी)" },
  { code: "bn-IN", name: "Bengali", native: "বাংলা", label: "Bengali (বাংলা)" },
  { code: "gu-IN", name: "Gujarati", native: "ગુજરાતી", label: "Gujarati (ગુજરાતી)" },
  { code: "kn-IN", name: "Kannada", native: "ಕನ್ನಡ", label: "Kannada (ಕನ್ನಡ)" },
  { code: "ml-IN", name: "Malayalam", native: "മലയാളം", label: "Malayalam (മലയാളം)" },
  { code: "mr-IN", name: "Marathi", native: "मराठी", label: "Marathi (मराठी)" },
  { code: "od-IN", name: "Odia", native: "ଓଡ଼ିଆ", label: "Odia (ଓଡ଼ିଆ)" },
  { code: "pa-IN", name: "Punjabi", native: "ਪੰਜਾਬੀ", label: "Punjabi (ਪੰਜਾਬੀ)" },
  { code: "ta-IN", name: "Tamil", native: "தமிழ்", label: "Tamil (தமிழ்)" },
  { code: "te-IN", name: "Telugu", native: "తెలుగు", label: "Telugu (తెలుగు)" },
  { code: "as-IN", name: "Assamese", native: "অসমীয়া", label: "Assamese (অসমীয়া)" },
  { code: "brx-IN", name: "Bodo", native: "बड़ो", label: "Bodo (बड़ो)" },
  { code: "doi-IN", name: "Dogri", native: "डोगरी", label: "Dogri (डोगरी)" },
  { code: "kok-IN", name: "Konkani", native: "कोंकणी", label: "Konkani (कोंकणी)" },
  { code: "ks-IN", name: "Kashmiri", native: "کٲشُر", label: "Kashmiri (کٲشُر)" },
  { code: "mai-IN", name: "Maithili", native: "मैथिली", label: "Maithili (मैथिली)" },
  { code: "mni-IN", name: "Manipuri", native: "মৈতৈলোন্", label: "Manipuri (মৈতৈলোন্)" },
  { code: "ne-IN", name: "Nepali", native: "नेपाली", label: "Nepali (नेपाली)" },
  { code: "sa-IN", name: "Sanskrit", native: "संस्कृतम्", label: "Sanskrit (संस्कृतम्)" },
  { code: "sat-IN", name: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ", label: "Santali (ᱥᱟᱱᱛᱟᱲᱤ)" },
  { code: "sd-IN", name: "Sindhi", native: "سنڌي", label: "Sindhi (سنڌي)" },
  { code: "ur-IN", name: "Urdu", native: "اردو", label: "Urdu (اردو)" },
];

export const DEFAULT_LANGUAGE = "en";
export const languageLabel = (code) =>
  SUPPORTED_LANGUAGES.find((language) => language.code === code)?.label || "English";

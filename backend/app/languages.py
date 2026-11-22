"""Canonical language codes supported by Eventure's site translation.

Sarvam Translate currently documents English plus 22 Indian languages.
"""
LANGUAGES = {
    "en": {"name": "English", "native": "English"},
    "hi-IN": {"name": "Hindi", "native": "हिन्दी"},
    "bn-IN": {"name": "Bengali", "native": "বাংলা"},
    "gu-IN": {"name": "Gujarati", "native": "ગુજરાતી"},
    "kn-IN": {"name": "Kannada", "native": "ಕನ್ನಡ"},
    "ml-IN": {"name": "Malayalam", "native": "മലയാളം"},
    "mr-IN": {"name": "Marathi", "native": "मराठी"},
    "od-IN": {"name": "Odia", "native": "ଓଡ଼ିଆ"},
    "pa-IN": {"name": "Punjabi", "native": "ਪੰਜਾਬੀ"},
    "ta-IN": {"name": "Tamil", "native": "தமிழ்"},
    "te-IN": {"name": "Telugu", "native": "తెలుగు"},
    "as-IN": {"name": "Assamese", "native": "অসমীয়া"},
    "brx-IN": {"name": "Bodo", "native": "बड़ो"},
    "doi-IN": {"name": "Dogri", "native": "डोगरी"},
    "kok-IN": {"name": "Konkani", "native": "कोंकणी"},
    "ks-IN": {"name": "Kashmiri", "native": "کٲشُر"},
    "mai-IN": {"name": "Maithili", "native": "मैथिली"},
    "mni-IN": {"name": "Manipuri", "native": "মৈতৈলোন্"},
    "ne-IN": {"name": "Nepali", "native": "नेपाली"},
    "sa-IN": {"name": "Sanskrit", "native": "संस्कृतम्"},
    "sat-IN": {"name": "Santali", "native": "ᱥᱟᱱᱛᱟᱲᱤ"},
    "sd-IN": {"name": "Sindhi", "native": "سنڌي"},
    "ur-IN": {"name": "Urdu", "native": "اردو"},
}
SUPPORTED_LANGUAGE_CODES = frozenset(LANGUAGES)

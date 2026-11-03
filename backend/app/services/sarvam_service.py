import os
import json
import logging
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional
from backend.app.config import settings

logger = logging.getLogger(__name__)

# Supported regional languages mapping (Official Sarvam AI BCP-47 codes)
SUPPORTED_LANGUAGES = [
    {"code": "en-IN", "name": "English", "native_name": "English", "is_default": True},
    {"code": "kn-IN", "name": "Kannada", "native_name": "ಕನ್ನಡ", "is_priority": True},
    {"code": "hi-IN", "name": "Hindi", "native_name": "हिन्दी"},
    {"code": "ta-IN", "name": "Tamil", "native_name": "தமிழ்"},
    {"code": "te-IN", "name": "Telugu", "native_name": "తెలుగు"},
    {"code": "mr-IN", "name": "Marathi", "native_name": "मराठी"},
    {"code": "ml-IN", "name": "Malayalam", "native_name": "മലയാളം"},
    {"code": "bn-IN", "name": "Bengali", "native_name": "বাংলা"},
    {"code": "gu-IN", "name": "Gujarati", "native_name": "ગુજરાતી"},
    {"code": "pa-IN", "name": "Punjabi", "native_name": "ਪੰਜਾਬੀ"},
    {"code": "od-IN", "name": "Odia", "native_name": "ଓଡ଼ିଆ"}
]

# Static high-fidelity farmer-friendly translation dictionary (Fallback & fast cache)
FALLBACK_DICTIONARY: Dict[str, Dict[str, str]] = {
    # Headings & Welcome
    "Welcome to CropInsure!": {
        "kn-IN": "ಕ್ರಾಪ್‌ಇನ್ಶೂರ್‌ಗೆ ಸುಸ್ವಾಗತ!",
        "hi-IN": "क्रॉपइन्श्योर में आपका स्वागत है!",
        "ta-IN": "கிராப்இன்ஷுவருக்கு நல்வரவு!",
        "te-IN": "క్రాప్‌ఇన్సూర్‌కి స్వాగతం!",
        "mr-IN": "क्रॉपइन्शुरन्स मध्ये आपले स्वागत आहे!"
    },
    "Understand your crop insurance and track your claim easily.": {
        "kn-IN": "ನಿಮ್ಮ ಬೆಳೆ ವಿಮೆಯನ್ನು ಸುಲಭವಾಗಿ ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ ಮತ್ತು ನಿಮ್ಮ ಅರ್ಜಿಯನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಿ.",
        "hi-IN": "अपनी फसल बीमा को आसानी से समझें और अपने दावे को ट्रैक करें।",
        "ta-IN": "உங்கள் பயிர் காப்பீட்டை எளிதாகப் புரிந்து கொண்டு உங்கள் கோரிக்கையைக் கண்காணிக்கவும்.",
        "te-IN": "మీ పంట బీమాను సులభంగా అర్థం చేసుకోండి మరియు మీ దావాను ట్రాక్ చేయండి.",
        "mr-IN": "आपला पीक विमा सहज समजून घ्या आणि आपल्या दाव्याचा मागोवा घ्या."
    },
    "My Crop Details": {
        "kn-IN": "ನನ್ನ ಬೆಳೆ ವಿವರಗಳು",
        "hi-IN": "मेरी फसल का विवरण",
        "ta-IN": "என் பயிர் விவரங்கள்",
        "te-IN": "నా పంట వివరాలు",
        "mr-IN": "माझे पीक तपशील"
    },
    "YOUR CLAIM PROGRESS": {
        "kn-IN": "ನಿಮ್ಮ ವಿಮಾ ಅರ್ಜಿಯ ಪ್ರಗತಿ",
        "hi-IN": "आपके दावे की प्रगति",
        "ta-IN": "உங்கள் கோரிக்கையின் முன்னேற்றம்",
        "te-IN": "మీ క్లెయిమ్ పురోగతి",
        "mr-IN": "आपल्या दाव्याची प्रगती"
    },
    "Information About My Crop Damage": {
        "kn-IN": "ನನ್ನ ಬೆಳೆ ಹಾನಿಯ ಮಾಹಿತಿ",
        "hi-IN": "मेरी फसल के नुकसान की जानकारी",
        "ta-IN": "என் பயிர் சேதம் பற்றிய தகவல்",
        "te-IN": "నా పంట నష్టం గురించిన సమాచారం",
        "mr-IN": "माझ्या पिकाच्या नुकसानीची माहिती"
    },
    "Why Was My Claim Assessed This Way?": {
        "kn-IN": "ನನ್ನ ಅರ್ಜಿಯನ್ನು ಈ ರೀತಿಯಾಗಿ ಏಕೆ ಪರಿಶೀಲಿಸಲಾಯಿತು?",
        "hi-IN": "मेरे दावे का इस तरह से मूल्यांकन क्यों किया गया?",
        "ta-IN": "என் கோரிக்கை ஏன் இவ்வாறு மதிப்பிடப்பட்டது?",
        "te-IN": "నా క్లెయిమ్ ఎందుకు ఈ విధంగా అంచనా వేయబడింది?",
        "mr-IN": "माझ्या दाव्याचे असे मूल्यांकन का केले गेले?"
    },
    "Main Reasons Considered for My Claim": {
        "kn-IN": "ನನ್ನ ಅರ್ಜಿಗಾಗಿ ಪರಿಗಣಿಸಲಾದ ಮುಖ್ಯ ಕಾರಣಗಳು",
        "hi-IN": "मेरे दावे के लिए माने गए मुख्य कारण",
        "ta-IN": "என் கோரிக்கைக்குக் கருதப்பட்ட முக்கிய காரணங்கள்",
        "te-IN": "నా క్లెయిమ్ కోసం పరిగణించబడిన ప్రధాన కారణాలు",
        "mr-IN": "माझ्या दाव्यासाठी विचारात घेतलेली मुख्य कारणे"
    },
    "How Different Factors Influenced This Claim": {
        "kn-IN": "ವಿವಿಧ ಅಂಶಗಳು ಈ ಅರ್ಜಿಯ ಮೇಲೆ ಹೇಗೆ ಪ್ರಭಾವ ಬೀರಿವೆ",
        "hi-IN": "विभिन्न कारकों ने इस दावे को कैसे प्रभावित किया",
        "ta-IN": "பல்வேறு காரணிகள் இந்த கோரிக்கையை எவ்வாறு பாதித்தன",
        "te-IN": "వివిధ కారకాలు ఈ క్లెయిమ్‌ను ఎలా ప్రభావితం చేశాయి",
        "mr-IN": "विविध घटकांनी या दाव्यावर कसा प्रभाव टाकला"
    },
    "What Should I Do Next?": {
        "kn-IN": "ನಾನು ಮುಂದೆ ಏನು ಮಾಡಬೇಕು?",
        "hi-IN": "मुझे आगे क्या करना चाहिए?",
        "ta-IN": "நான் அடுத்து என்ன செய்ய வேண்டும்?",
        "te-IN": "నేను తర్వాత ఏమి చేయాలి?",
        "mr-IN": "मी पुढे काय करावे?"
    },
    "Need Help With Your Claim?": {
        "kn-IN": "ನಿಮ್ಮ ಕ್ಲೈಮ್ ಬಗ್ಗೆ ಸಹಾಯ ಬೇಕೇ?",
        "hi-IN": "क्या आपको अपने दावे के लिए मदद चाहिए?",
        "ta-IN": "உங்கள் கோரிக்கைக்கு உதவி தேவையா?",
        "te-IN": "మీ క్లెయిమ్ కోసం సహాయం కావాలా?",
        "mr-IN": "आपल्या दाव्यासाठी मदत हवी आहे का?"
    },
    "How Crop Insurance Works": {
        "kn-IN": "ಬೆಳೆ ವಿಮೆ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
        "hi-IN": "फसल बीमा कैसे काम करता है",
        "ta-IN": "பயிர் காப்பீடு எவ்வாறு செயல்படுகிறது",
        "te-IN": "పంట బీమా ఎలా పనిచేస్తుంది",
        "mr-IN": "पीक विमा कसा कार्य करतो"
    },
    "Frequently Asked Questions": {
        "kn-IN": "ಸಾಮಾನ್ಯವಾಗಿ ಕೇಳಲಾಗುವ ಪ್ರಶ್ನೆಗಳು (FAQ)",
        "hi-IN": "अक्सर पूछे जाने वाले सवाल (FAQ)",
        "ta-IN": "அடிக்கடி கேட்கப்படும் கேள்விகள் (FAQ)",
        "te-IN": "తరచుగా అడిగే ప్రశ్నలు (FAQ)",
        "mr-IN": "वारंवार विचारले जाणारे प्रश्न (FAQ)"
    },

    # Workflow Stages
    "Application Submitted": {
        "kn-IN": "ಅರ್ಜಿ ಸಲ್ಲಿಸಲಾಗಿದೆ",
        "hi-IN": "आवेदन जमा किया गया",
        "ta-IN": "விண்ணப்பம் சமர்ப்பிக்கப்பட்டது",
        "te-IN": "దరఖాస్తు సమర్పించబడింది",
        "mr-IN": "अर्ज सादर केला"
    },
    "Documents Checked": {
        "kn-IN": "ದಾಖಲೆಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗಿದೆ",
        "hi-IN": "दस्तावेज़ों की जाँच की गई",
        "ta-IN": "ஆவணங்கள் சரிபார்க்கப்பட்டன",
        "te-IN": "పత్రాలు తనిఖీ చేయబడ్డాయి",
        "mr-IN": "कागदपत्रे तपासली"
    },
    "Claim Under Assessment": {
        "kn-IN": "ಅರ್ಜಿ ಮೌಲ್ಯಮಾಪನದಲ್ಲಿದೆ",
        "hi-IN": "दावे का मूल्यांकन जारी है",
        "ta-IN": "கோரிக்கை மதிப்பீட்டில் உள்ளது",
        "te-IN": "క్లెయిమ్ అంచనాలో ఉంది",
        "mr-IN": "दाव्याचे मूल्यांकन सुरू आहे"
    },
    "Officer Reviewing": {
        "kn-IN": "ಅಧಿಕಾರಿಗಳ ಪರಿಶೀಲನೆ ನಡೆಯುತ್ತಿದೆ",
        "hi-IN": "अधिकारी समीक्षा कर रहे हैं",
        "ta-IN": "அதிகாரி மதிப்பாய்வு செய்கிறார்",
        "te-IN": "అధికారి సమీక్షిస్తున్నారు",
        "mr-IN": "अधिकारी पुनरावलोकन करत आहेत"
    },
    "Decision Recorded": {
        "kn-IN": "ಅಂತಿಮ ತೀರ್ಮಾನ ದಾಖಲಾಗಿದೆ",
        "hi-IN": "निर्णय दर्ज किया गया",
        "ta-IN": "முடிவு பதிவு செய்யப்பட்டது",
        "te-IN": "నిర్ణయం నమోదు చేయబడింది",
        "mr-IN": "निर्णय नोंदवला गेला"
    },
    "Payment Processing": {
        "kn-IN": "ಪಾವತಿ ಪ್ರಕ್ರಿಯೆಯಲ್ಲಿದೆ",
        "hi-IN": "भुगतान प्रक्रियाधीन है",
        "ta-IN": "பணம் செலுத்தும் செயல்முறை நடக்கிறது",
        "te-IN": "చెల్లింపు ప్రాసెసింగ్‌లో ఉంది",
        "mr-IN": "पेमेंट प्रक्रियेत आहे"
    },
    "Payment Completed": {
        "kn-IN": "ಪಾವತಿ ಪೂರ್ಣಗೊಂಡಿದೆ",
        "hi-IN": "भुगतान पूरा हुआ",
        "ta-IN": "பணம் செலுத்தப்பட்டது",
        "te-IN": "చెల్లింపు పూర్తయింది",
        "mr-IN": "पेमेंट पूर्ण झाले"
    },

    # Status Cards
    "Your Claim Is Being Checked": {
        "kn-IN": "ನಿಮ್ಮ ವಿಮಾ ಅರ್ಜಿಯನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ",
        "hi-IN": "आपके दावे की जाँच की जा रही है",
        "ta-IN": "உங்கள் கோரிக்கை சரிபார்க்கப்படுகிறது",
        "te-IN": "మీ క్లెయిమ్ తనిఖీ చేయబడుతోంది",
        "mr-IN": "आपल्या दाव्याची तपासणी केली जात आहे"
    },
    "Your Claim Has Been Approved": {
        "kn-IN": "ನಿಮ್ಮ ವಿಮಾ ಅರ್ಜಿಯು ಅನುಮೋದನೆಗೊಂಡಿದೆ",
        "hi-IN": "आपका दावा स्वीकृत हो गया है",
        "ta-IN": "உங்கள் கோரிக்கை அங்கீகரிக்கப்பட்டது",
        "te-IN": "మీ క్లెయిమ్ ఆమోదించబడింది",
        "mr-IN": "आपला दावा मंजूर झाला आहे"
    },
    "Your Claim Needs Attention": {
        "kn-IN": "ನಿಮ್ಮ ಅರ್ಜಿಗೆ ಗಮನ ನೀಡುವ ಅಗತ್ಯವಿದೆ",
        "hi-IN": "आपके दावे पर ध्यान देने की आवश्यकता है",
        "ta-IN": "உங்கள் கோரிக்கைக்கு கவனம் தேவை",
        "te-IN": "మీ క్లెయిమ్‌కు శ్రద్ధ అవసరం",
        "mr-IN": "आपल्या दाव्याकडे लक्ष देणे आवश्यक आहे"
    },
    "More Information Is Needed": {
        "kn-IN": "ಹೆಚ್ಚಿನ ಮಾಹಿತಿ ಅಗತ್ಯವಿದೆ",
        "hi-IN": "अधिक जानकारी की आवश्यकता है",
        "ta-IN": "கூடுதல் தகவல் தேவைப்படுகிறது",
        "te-IN": "మరింత సమాచారం అవసరం",
        "mr-IN": "अधिक माहिती आवश्यक आहे"
    },
    "No Claim Submitted Yet": {
        "kn-IN": "ಇನ್ನೂ ಯಾವುದೇ ಕ್ಲೈಮ್ ಸಲ್ಲಿಸಿಲ್ಲ",
        "hi-IN": "अभी तक कोई दावा जमा नहीं किया गया है",
        "ta-IN": "இதுவரை எந்தக் கோரிக்கையும் சமர்ப்பிக்கப்படவில்லை",
        "te-IN": "ఇంకా ఎటువంటి క్లెయిమ్ సమర్పించలేదు",
        "mr-IN": "अद्याप कोणताही दावा सादर केलेला नाही"
    },

    # Common terms
    "Farmer's Name": {"kn-IN": "ರೈತರ ಹೆಸರು", "hi-IN": "किसान का नाम", "ta-IN": "விவசாயியின் பெயர்", "te-IN": "రైతు పేరు"},
    "Crop Name": {"kn-IN": "ಬೆಳೆಯ ಹೆಸರು", "hi-IN": "फसल का नाम", "ta-IN": "பயிரின் பெயர்", "te-IN": "పంట పేరు"},
    "Claim Number": {"kn-IN": "ವಿಮಾ ಅರ್ಜಿ ಸಂಖ್ಯೆ", "hi-IN": "दावा संख्या", "ta-IN": "கோரிக்கை எண்", "te-IN": "క్లెయిమ్ సంఖ్య"},
    "Village / District": {"kn-IN": "ಗ್ರಾಮ / ಜಿಲ್ಲೆ", "hi-IN": "गाँव / ज़िला", "ta-IN": "கிராமம் / மாவட்டம்", "te-IN": "గ్రామం / జిల్లా"},
    "Date Submitted": {"kn-IN": "ಸಲ್ಲಿಸಿದ ದಿನಾಂಕ", "hi-IN": "जमा करने की तिथि", "ta-IN": "சமர்ப்பிக்கப்பட்ட தேதி", "te-IN": "సమర్పించిన తేదీ"},
    "Insured Land Area": {"kn-IN": "ವಿಮೆ ಮಾಡಿಸಲಾದ ಜಮೀನಿನ ವಿಸ್ತೀರ್ಣ", "hi-IN": "बीमित भूमि क्षेत्र", "ta-IN": "காப்பீடு செய்யப்பட்ட நிலப்பரப்பு", "te-IN": "బీమా చేయబడిన భూభాగం"},
    "Policy Number": {"kn-IN": "ಪಾಲಿಸಿ ಸಂಖ್ಯೆ", "hi-IN": "पॉलिसी संख्या", "ta-IN": "பாலிசி எண்", "te-IN": "పాలసీ సంఖ్య"},
    "Reported Crop Damage": {"kn-IN": "ವರದಿ ಮಾಡಿದ ಬೆಳೆ ಹಾನಿ", "hi-IN": "दर्ज कराया गया फसल नुकसान", "ta-IN": "தெரிவிக்கப்பட்ட பயிர் சேதம்", "te-IN": "నివేదించబడిన పంట నష్టం"},

    # Statutory disclaimers
    "The AI helps assess your claim. It does not make the final insurance decision. An authorized insurance officer reviews the evidence and makes the final decision.": {
        "kn-IN": "ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ (AI) ನಿಮ್ಮ ಅರ್ಜಿಯನ್ನು ಪರೀಕ್ಷಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ. ಆದರೆ ಇದು ಅಂತಿಮ ತೀರ್ಮಾನವನ್ನು ತೆಗೆದುಕೊಳ್ಳುವುದಿಲ್ಲ. ಅಧಿಕೃತ ವಿಮಾ ಅಧಿಕಾರಿ ದಾಖಲೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ ಅಂತಿಮ ತೀರ್ಮಾನವನ್ನು ತೆಗೆದುಕೊಳ್ಳುತ್ತಾರೆ.",
        "hi-IN": "एआई (AI) आपके दावे के आकलन में सहायता करता है। यह अंतिम बीमा निर्णय नहीं लेता है। अधिकृत बीमा अधिकारी साक्ष्यों की समीक्षा करके अंतिम निर्णय लेते हैं।",
        "ta-IN": "AI உங்கள் கோரிக்கையை மதிப்பிட உதவுகிறது. இது இறுதி காப்பீட்டு முடிவை எடுக்காது. அங்கீகரிக்கப்பட்ட காப்பீட்டு அதிகாரி ஆதாரங்களை ஆய்வு செய்து இறுதி முடிவை எடுப்பார்.",
        "te-IN": "AI మీ క్లెయిమ్‌ను అంచనా వేయడానికి సహాయపడుతుంది. ఇది తుది బీమా నిర్ణయాన్ని తీసుకోదు. అధికారిక బీమా అధికారి ఆధారాలను పరిశీలించి తుది నిర్ణయం తీసుకుంటారు."
    }
}

class SarvamService:
    def __init__(self):
        self.api_key = settings.SARVAM_API_KEY.strip()
        self.base_url = settings.SARVAM_BASE_URL.rstrip('/')
        self._cache: Dict[str, str] = {}

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 5)

    def get_supported_languages(self) -> List[Dict[str, Any]]:
        return SUPPORTED_LANGUAGES

    def translate_text(
        self,
        text: str,
        target_lang: str,
        source_lang: str = "en-IN"
    ) -> Dict[str, Any]:
        """
        Translates text using Sarvam AI translation API.
        Falls back to comprehensive dictionary and graceful fallback if API is not configured or fails.
        """
        if not text or not text.strip():
            return {"translated_text": text, "source_lang": source_lang, "target_lang": target_lang, "source": "empty"}

        # If already target language
        if target_lang == source_lang or target_lang == "en-IN" and source_lang == "en-IN":
            return {"translated_text": text, "source_lang": source_lang, "target_lang": target_lang, "source": "same_language"}

        trimmed = text.strip()
        cache_key = f"{source_lang}:{target_lang}:{trimmed}"
        if cache_key in self._cache:
            return {
                "translated_text": self._cache[cache_key],
                "source_lang": source_lang,
                "target_lang": target_lang,
                "source": "cache"
            }

        # Check static fallback dictionary first for instantaneous response
        if trimmed in FALLBACK_DICTIONARY and target_lang in FALLBACK_DICTIONARY[trimmed]:
            translated = FALLBACK_DICTIONARY[trimmed][target_lang]
            self._cache[cache_key] = translated
            return {
                "translated_text": translated,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "source": "dictionary"
            }

        # If live API key is present, call Sarvam AI
        if self.is_configured():
            try:
                headers = {
                    "Content-Type": "application/json",
                    "api-subscription-key": self.api_key
                }
                payload = {
                    "input": trimmed[:1500],
                    "source_language_code": source_lang,
                    "target_language_code": target_lang,
                    "model": "sarvam-translate:v1"
                }
                req_data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    f"{self.base_url}/translate",
                    data=req_data,
                    headers=headers,
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=8.0) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode("utf-8"))
                        res_text = data.get("translated_text", "")
                        if res_text:
                            self._cache[cache_key] = res_text
                            return {
                                "translated_text": res_text,
                                "source_lang": source_lang,
                                "target_lang": target_lang,
                                "source": "sarvam_ai"
                            }
            except Exception as e:
                logger.error(f"Sarvam translation request failed: {e}")

        # Return original text as safe fallback so information is never hidden
        return {
            "translated_text": trimmed,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "source": "original_fallback",
            "notice": "Sarvam API translation unavailable. Displaying original text."
        }

    def text_to_speech(
        self,
        text: str,
        target_lang: str = "kn-IN"
    ) -> Dict[str, Any]:
        """
        Converts text into audio speech via Sarvam AI Text-to-Speech endpoint.
        """
        if not self.is_configured():
            return {
                "success": False,
                "message": "Sarvam API key not configured. Add SARVAM_API_KEY to .env to enable natural voice speech.",
                "audios": []
            }

        try:
            headers = {
                "Content-Type": "application/json",
                "api-subscription-key": self.api_key
            }
            payload = {
                "text": text[:500],
                "target_language_code": target_lang,
                "model": "bulbul:v4-flash"
            }
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                f"{self.base_url}/text-to-speech",
                data=req_data,
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=12.0) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    audios = data.get("audios", [])
                    return {
                        "success": True,
                        "audios": audios,
                        "format": "wav"
                    }
                else:
                    return {
                        "success": False,
                        "message": f"Sarvam TTS returned status {response.status}",
                        "audios": []
                    }
        except Exception as e:
            return {
                "success": False,
                "message": f"TTS request error: {str(e)}",
                "audios": []
            }

    def speech_to_text(
        self,
        audio_file_bytes: bytes,
        language_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcribes speech audio into text using Sarvam AI Speech-to-Text.
        """
        if not self.is_configured():
            return {
                "success": False,
                "message": "Sarvam API key not configured. Add SARVAM_API_KEY to .env to enable speech-to-text input.",
                "transcript": ""
            }

        try:
            # Build multipart/form-data boundary
            boundary = "----WebKitFormBoundaryXaiCropInsureSarvam"
            body = bytearray()
            
            # File field
            body.extend(f"--{boundary}\r\n".encode("utf-8"))
            body.extend(b'Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n')
            body.extend(b'Content-Type: audio/wav\r\n\r\n')
            body.extend(audio_file_bytes)
            body.extend(b"\r\n")
            
            # Model field
            body.extend(f"--{boundary}\r\n".encode("utf-8"))
            body.extend(b'Content-Disposition: form-data; name="model"\r\n\r\n')
            body.extend(b"saaras:v4\r\n")
            
            if language_code:
                body.extend(f"--{boundary}\r\n".encode("utf-8"))
                body.extend(b'Content-Disposition: form-data; name="language_code"\r\n\r\n')
                body.extend(language_code.encode("utf-8"))
                body.extend(b"\r\n")
                
            body.extend(f"--{boundary}--\r\n".encode("utf-8"))

            headers = {
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "api-subscription-key": self.api_key
            }
            req = urllib.request.Request(
                f"{self.base_url}/speech-to-text",
                data=bytes(body),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=15.0) as response:
                if response.status == 200:
                    res_data = json.loads(response.read().decode("utf-8"))
                    return {
                        "success": True,
                        "transcript": res_data.get("transcript", ""),
                        "language_code": res_data.get("language_code", "")
                    }
                else:
                    return {
                        "success": False,
                        "message": f"Sarvam STT returned status {response.status}",
                        "transcript": ""
                    }
        except Exception as e:
            return {
                "success": False,
                "message": f"STT error: {str(e)}",
                "transcript": ""
            }

# Singleton instance
sarvam_service = SarvamService()

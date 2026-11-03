import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';
import { UserProfile, RegionalLanguage } from '../types';
import { SUPPORTED_LANGUAGES, translate } from '../i18n';

export type UserRole = 'farmer' | 'officer';

// Comprehensive dictionary for instant client-side translation across all 11 languages
export const UI_DICTIONARY: Record<string, Record<string, string>> = {
  // Navigation & Headers
  "Welcome to CropInsure!": {
    "kn-IN": "ಕ್ರಾಪ್‌ಇನ್ಶೂರ್‌ಗೆ ಸುಸ್ವಾಗತ!",
    "hi-IN": "क्रॉपइन्श्योर में आपका स्वागत है!",
    "ta-IN": "கிராப்இன்ஷுவருக்கு நல்வரவு!",
    "te-IN": "క్రాప్‌ఇన్సూర్‌కి స్వాగతం!",
    "mr-IN": "क्रॉपइन्शुरन्स मध्ये आपले स्वागत आहे!",
    "ml-IN": "ക്രോപ്പ് ഇൻഷുറിലേക്ക് സ്വാഗതം!",
    "bn-IN": "ক্রপইনশিওরে আপনাকে স্বাগতম!",
    "gu-IN": "ક્રોપઇન્સ્યોરમાં આપનું સ્વાગત છે!",
    "pa-IN": "ਕਰੋਪਇੰਸ਼ੋਰ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ!",
    "od-IN": "କ୍ରପଇନସ୍ୟୋରକୁ ସ୍ୱାଗତ!"
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
    "te-IN": "నా క్లెయిమ్ ఎందుకు ಈ విధంగా అంచనా వేయబడింది?",
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
  "Farmer AI Assistant": {
    "kn-IN": "ರೈತರ ಎಐ ಸಹಾಯಕ",
    "hi-IN": "किसान एआई सहायक",
    "ta-IN": "விவசாயி AI உதவியாளர்",
    "te-IN": "రైతు AI సహాయకుడు",
    "mr-IN": "शेतकरी AI सहाय्यक"
  },
  "How Crop Insurance Works": {
    "kn-IN": "ಬೆಳೆ ವಿಮೆ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
    "hi-IN": "फसल बीमा कैसे काम करता है",
    "ta-IN": "பயிர் காப்பீடு எவ்வாறு செயல்படுகிறது",
    "te-IN": "పంట బీమా ఎలా పనిచేస్తుంది",
    "mr-IN": "पीक विमा कसा कार्य करतो"
  },
  "Need Help With Your Claim?": {
    "kn-IN": "ನಿಮ್ಮ ಕ್ಲೈಮ್ ಬಗ್ಗೆ ಸಹಾಯ ಬೇಕೇ?",
    "hi-IN": "क्या आपको अपने दावे के लिए मदद चाहिए?",
    "ta-IN": "உங்கள் கோரிக்கைக்கு உதவி தேவையா?",
    "te-IN": "మీ క్లెయిమ్ కోసం సహాయం కావాలా?",
    "mr-IN": "आपल्या दाव्यासाठी मदत हवी आहे का?"
  },

  // Stages
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

  // Field Names
  "Farmer's Name": {"kn-IN": "ರೈತರ ಹೆಸರು", "hi-IN": "किसान का नाम", "ta-IN": "விவசாயியின் பெயர்", "te-IN": "రైతు పేరు"},
  "Crop Name": {"kn-IN": "ಬೆಳೆಯ ಹೆಸರು", "hi-IN": "फसल का नाम", "ta-IN": "பயிரின் பெயர்", "te-IN": "పంట పేరు"},
  "Claim Number": {"kn-IN": "ವಿಮಾ ಅರ್ಜಿ ಸಂಖ್ಯೆ", "hi-IN": "दावा संख्या", "ta-IN": "கோரிக்கை எண்", "te-IN": "క్లెయిమ్ సంఖ్య"},
  "Village / District": {"kn-IN": "ಗ್ರಾಮ / ಜಿಲ್ಲೆ", "hi-IN": "गाँव / ज़िला", "ta-IN": "கிராமம் / மாவட்டம்", "te-IN": "గ్రామం / జిల్లా"},
  "Date Submitted": {"kn-IN": "ಸಲ್ಲಿಸಿದ ದಿನಾಂಕ", "hi-IN": "जमा करने की तिथि", "ta-IN": "சமர்ப்பிக்கப்பட்ட தேதி", "te-IN": "సమర్పించిన తేదీ"},
  "Insured Land Area": {"kn-IN": "ವಿಮೆ ಮಾಡಿಸಲಾದ ಜಮೀನಿನ ವಿಸ್ತೀರ್ಣ", "hi-IN": "बीमित भूमि क्षेत्र", "ta-IN": "காப்பீடு செய்யப்பட்ட நிலப்பரப்பு", "te-IN": "బీమా చేయబడిన భూభాగం"},
  "Policy Number": {"kn-IN": "ಪಾಲಿಸಿ ಸಂಖ್ಯೆ", "hi-IN": "पॉलिसी संख्या", "ta-IN": "பாலிசி எண்", "te-IN": "పాలసీ సంఖ్య"},
  "Reported Crop Damage": {"kn-IN": "ವರದಿ ಮಾಡಿದ ಬೆಳೆ ಹಾನಿ", "hi-IN": "दर्ज कराया गया फसल नुकसान", "ta-IN": "தெரிவிக்கப்பட்ட பயிர் சேதம்", "te-IN": "నివేదించబడిన పంట నష్టం"},
  "Current Status": {"kn-IN": "ಪ್ರಸ್ತುತ ಸ್ಥಿತಿ", "hi-IN": "वर्तमान स्थिति", "ta-IN": "தற்போதைய நிலை", "te-IN": "ప్రస్తుత స్థితి"},
  "Next Expected Action": {"kn-IN": "ಮುಂದಿನ ನಿರೀಕ್ಷಿತ ಕ್ರಮ", "hi-IN": "अगली अपेक्षित कार्रवाई", "ta-IN": "அடுத்த எதிர்பார்க்கப்படும் நடவடிக்கை", "te-IN": "తదుపరి చర్య"},
  "Missing Documents": {"kn-IN": "ಬಾಕಿ ಇರುವ ದಾಖಲೆಗಳು", "hi-IN": "शेष दस्तावेज़", "ta-IN": "விடுபட்ட ஆவணங்கள்", "te-IN": "తప్పిపోయిన పత్రాలు"},

  // Status Cards
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
  }
};

export const SUPPORTED_LANGUAGES_LIST: RegionalLanguage[] = [
  { code: 'en-IN', name: 'English', native_name: 'English', is_default: true },
  { code: 'kn-IN', name: 'Kannada', native_name: 'ಕನ್ನಡ', is_priority: true },
  { code: 'hi-IN', name: 'Hindi', native_name: 'हिन्दी' },
  { code: 'ta-IN', name: 'Tamil', native_name: 'தமிழ்' },
  { code: 'te-IN', name: 'Telugu', native_name: 'తెలుగు' },
  { code: 'mr-IN', name: 'Marathi', native_name: 'मराठी' },
  { code: 'ml-IN', name: 'Malayalam', native_name: 'മലയാളം' },
  { code: 'bn-IN', name: 'Bengali', native_name: 'বাংলা' },
  { code: 'gu-IN', name: 'Gujarati', native_name: 'ગુજરાતી' },
  { code: 'pa-IN', name: 'Punjabi', native_name: 'ਪੰਜਾਬੀ' },
  { code: 'od-IN', name: 'Odia', native_name: 'ଓଡ଼ିଆ' }
];

interface RoleContextType {
  role: UserRole;
  user: UserProfile | null;
  language: string;
  demoUsers: UserProfile[];
  setRole: (role: UserRole) => void;
  setLanguage: (langCode: string) => void;
  switchDemoUser: (username: string) => Promise<void>;
  toggleRole: () => void;
  t: (key: string) => string;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem('xai_cropinsure_role');
    return (saved === 'officer' ? 'officer' : 'farmer') as UserRole;
  });

  const [language, setLanguageState] = useState<string>(() => {
    return localStorage.getItem('xai_cropinsure_lang') || 'en-IN';
  });

  const [user, setUser] = useState<UserProfile | null>(null);
  const [demoUsers, setDemoUsers] = useState<UserProfile[]>([]);

  // Initial authentication & demo users load
  useEffect(() => {
    api.auth.getDemoUsers().then((users) => {
      setDemoUsers(users);
      // Auto-login to saved user or default to Ramesh Patel
      const savedUser = localStorage.getItem('xai_cropinsure_username') || 'farmer_ramesh';
      switchDemoUser(savedUser);
    }).catch(() => {
      // Offline fallback
    });
  }, []);

  const switchDemoUser = async (username: string) => {
    try {
      const res = await api.auth.demoSwitch(username);
      localStorage.setItem('xai_cropinsure_token', res.access_token);
      localStorage.setItem('xai_cropinsure_username', res.user.username);
      localStorage.setItem('xai_cropinsure_role', res.user.role);
      setUser(res.user);
      setRoleState(res.user.role as UserRole);

      if (res.user.preferred_language) {
        setLanguageState(res.user.preferred_language);
        localStorage.setItem('xai_cropinsure_lang', res.user.preferred_language);
      }
    } catch (err) {
      console.error('Failed to switch demo user:', err);
    }
  };

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem('xai_cropinsure_role', newRole);
    // Auto-switch to matching user
    if (newRole === 'officer') {
      switchDemoUser('officer_verma');
    } else {
      switchDemoUser('farmer_ramesh');
    }
  };

  const setLanguage = (langCode: string) => {
    setLanguageState(langCode);
    localStorage.setItem('xai_cropinsure_lang', langCode);
    if (user) {
      api.auth.setLanguage(langCode).catch(() => {});
    }
  };

  const toggleRole = () => {
    setRole(role === 'farmer' ? 'officer' : 'farmer');
  };

  // Instant translation lookup helper with full 11-language locale support
  const t = (key: string): string => {
    if (!key) return '';
    // 1. Direct locale translation
    const localized = translate(key, language);
    if (localized && localized !== key) {
      return localized;
    }
    // 2. Legacy UI_DICTIONARY match
    if (UI_DICTIONARY[key] && UI_DICTIONARY[key][language]) {
      return UI_DICTIONARY[key][language];
    }
    // 3. Fallback to English translation or raw key
    return localized || key;
  };

  return (
    <RoleContext.Provider value={{
      role,
      user,
      language,
      demoUsers,
      setRole,
      setLanguage,
      switchDemoUser,
      toggleRole,
      t
    }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};

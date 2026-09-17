const STORAGE_KEY = 'omniagent-language';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'hi', label: 'हिन्दी' },
];

const STRINGS = {
  en: {
    placeholderChat: 'Message OmniAgent…',
    placeholderImage: 'Describe an image to generate…',
    placeholderFinance: 'Enter a stock symbol, e.g. AAPL…',
    placeholderNews: 'Search a news topic…',
    emptyTitle: 'How can I help?',
    emptySub: 'Type a message, pick a quick action below, or record your voice.',
    disclaimer: 'OmniAgent can make mistakes. Check important information before relying on it.',
    privacyLink: 'Privacy',
    privacyTitle: 'Privacy',
    privacyP1:
      "OmniAgent has no sign-in — a session is created anonymously the first time you open the app. Your messages, the answers you receive, and which backend/category handled each one are stored so your conversation survives a page reload, and can be viewed or exported at any time.",
    privacyP2:
      'A small number of durable facts (like your role or ongoing projects) may be extracted from your conversation and reused in later sessions to make answers more relevant. The extracted fact is stored only on this server, is never shown to anyone else, and is not used for advertising.',
    privacyP3:
      "Prompts are sent to whichever AI backend is answering that message (a local model on this server, or a cloud provider's API) purely to generate a response — never sold, and never used to build a profile for advertising. Pinning, feedback, and export are entirely your choice and only affect your own data.",
    pinnedTitle: 'Pinned answers',
    pinnedEmpty: 'Nothing pinned yet. Pin an answer with the pin icon on any response.',
    pinnedLoading: 'Loading…',
    unpin: 'Unpin',
  },
  es: {
    placeholderChat: 'Escribe un mensaje a OmniAgent…',
    placeholderImage: 'Describe una imagen para generar…',
    placeholderFinance: 'Ingresa un símbolo bursátil, p. ej. AAPL…',
    placeholderNews: 'Busca un tema de noticias…',
    emptyTitle: '¿En qué puedo ayudarte?',
    emptySub: 'Escribe un mensaje, elige una acción rápida abajo, o graba tu voz.',
    disclaimer: 'OmniAgent puede cometer errores. Verifica la información importante antes de confiar en ella.',
    privacyLink: 'Privacidad',
    privacyTitle: 'Privacidad',
    privacyP1:
      'OmniAgent no requiere inicio de sesión — se crea una sesión anónima la primera vez que abres la app. Tus mensajes, las respuestas que recibes, y qué backend/categoría manejó cada una se guardan para que tu conversación sobreviva a una recarga de página, y puedan verse o exportarse en cualquier momento.',
    privacyP2:
      'Un pequeño número de hechos duraderos (como tu rol o proyectos en curso) puede extraerse de tu conversación y reutilizarse en sesiones posteriores para hacer las respuestas más relevantes. El hecho extraído se guarda solo en este servidor, nunca se muestra a nadie más, y no se usa para publicidad.',
    privacyP3:
      'Los mensajes se envían al backend de IA que responda ese mensaje (un modelo local en este servidor, o la API de un proveedor en la nube) únicamente para generar una respuesta — nunca se venden, y nunca se usan para construir un perfil publicitario. Fijar, calificar y exportar son totalmente tu elección y solo afectan tus propios datos.',
    pinnedTitle: 'Respuestas fijadas',
    pinnedEmpty: 'Nada fijado todavía. Fija una respuesta con el icono de alfiler en cualquier respuesta.',
    pinnedLoading: 'Cargando…',
    unpin: 'Desfijar',
  },
  hi: {
    placeholderChat: 'OmniAgent को संदेश भेजें…',
    placeholderImage: 'बनाने के लिए एक इमेज का वर्णन करें…',
    placeholderFinance: 'स्टॉक सिंबल दर्ज करें, जैसे AAPL…',
    placeholderNews: 'समाचार विषय खोजें…',
    emptyTitle: 'मैं आपकी कैसे मदद कर सकता हूँ?',
    emptySub: 'एक संदेश टाइप करें, नीचे कोई त्वरित कार्रवाई चुनें, या अपनी आवाज़ रिकॉर्ड करें।',
    disclaimer: 'OmniAgent गलतियाँ कर सकता है। भरोसा करने से पहले महत्वपूर्ण जानकारी जांच लें।',
    privacyLink: 'गोपनीयता',
    privacyTitle: 'गोपनीयता',
    privacyP1:
      'OmniAgent में साइन-इन नहीं है — ऐप खोलते ही एक गुमनाम सत्र बन जाता है। आपके संदेश, प्राप्त उत्तर, और किस बैकएंड/श्रेणी ने उसे संभाला, यह सहेजा जाता है ताकि पेज रीलोड होने पर भी बातचीत बनी रहे, और इसे कभी भी देखा या निर्यात किया जा सके।',
    privacyP2:
      'कुछ स्थायी तथ्य (जैसे आपकी भूमिका या चल रही परियोजनाएँ) आपकी बातचीत से निकाले जा सकते हैं और बाद के सत्रों में उत्तर अधिक प्रासंगिक बनाने के लिए फिर से उपयोग किए जा सकते हैं। निकाला गया तथ्य केवल इस सर्वर पर संग्रहीत है, किसी और को नहीं दिखाया जाता, और विज्ञापन के लिए उपयोग नहीं होता।',
    privacyP3:
      'संदेश उस AI बैकएंड को भेजे जाते हैं जो उस संदेश का उत्तर दे रहा है (इस सर्वर पर एक स्थानीय मॉडल, या किसी क्लाउड प्रदाता का API) केवल उत्तर बनाने के लिए — कभी नहीं बेचा जाता, और विज्ञापन प्रोफ़ाइल बनाने के लिए कभी उपयोग नहीं होता। पिन करना, फीडबैक, और निर्यात पूरी तरह आपकी पसंद है और केवल आपके अपने डेटा को प्रभावित करते हैं।',
    pinnedTitle: 'पिन किए गए उत्तर',
    pinnedEmpty: 'अभी तक कुछ भी पिन नहीं किया गया। किसी भी उत्तर पर पिन आइकन से उसे पिन करें।',
    pinnedLoading: 'लोड हो रहा है…',
    unpin: 'अनपिन करें',
  },
};

export function getStoredLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredLanguage(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore storage failures (private browsing, etc.)
  }
}

export function initLanguage() {
  const stored = getStoredLanguage();
  return LANGUAGES.some((l) => l.code === stored) ? stored : 'en';
}

export function t(lang, key) {
  return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
}

export type GreetingLanguage = "en" | "hi" | "te" | "kn";
export type VoiceGender = "female" | "male";

export interface VoicePreferences {
  language: GreetingLanguage;
  voiceGender: VoiceGender;
  autoPlay: boolean;
  muted: boolean;
}

const STORAGE_KEY = "smart_mannequin_voice_preferences";
const PENDING_GREETING_KEY = "smart_mannequin_pending_greeting";

export const defaultVoicePreferences: VoicePreferences = {
  language: "en",
  voiceGender: "female",
  autoPlay: true,
  muted: false,
};

export function getVoicePreferences(): VoicePreferences {
  if (typeof window === "undefined") return defaultVoicePreferences;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultVoicePreferences;

    const parsed = JSON.parse(raw) as Partial<VoicePreferences>;
    return {
      language:
        parsed.language === "hi"
          ? "hi"
          : parsed.language === "te"
            ? "te"
            : parsed.language === "kn"
              ? "kn"
              : "en",
      voiceGender: parsed.voiceGender === "male" ? "male" : "female",
      autoPlay: parsed.autoPlay !== false,
      muted: !!parsed.muted,
    };
  } catch {
    return defaultVoicePreferences;
  }
}

export function saveVoicePreferences(next: Partial<VoicePreferences>) {
  if (typeof window === "undefined") return;

  const current = getVoicePreferences();
  const payload = { ...current, ...next };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function queueGreetingAfterLogin(
  name: string,
  language: GreetingLanguage,
  gender: VoiceGender,
) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    PENDING_GREETING_KEY,
    JSON.stringify({ name, language, gender, createdAt: Date.now() }),
  );
}

export function consumePendingGreeting():
  | { name: string; language: GreetingLanguage; gender: VoiceGender }
  | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(PENDING_GREETING_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<{
      name: string;
      language: GreetingLanguage;
      gender: VoiceGender;
    }>;

    if (!parsed.name || !parsed.language || !parsed.gender) {
      window.localStorage.removeItem(PENDING_GREETING_KEY);
      return null;
    }

    window.localStorage.removeItem(PENDING_GREETING_KEY);
    return {
      name: parsed.name,
      language:
        parsed.language === "hi"
          ? "hi"
          : parsed.language === "te"
            ? "te"
            : parsed.language === "kn"
              ? "kn"
              : "en",
      gender: parsed.gender === "male" ? "male" : "female",
    };
  } catch {
    window.localStorage.removeItem(PENDING_GREETING_KEY);
    return null;
  }
}

export function getLanguageLabel(language: GreetingLanguage) {
  if (language === "hi") return "Hindi";
  if (language === "te") return "Telugu";
  if (language === "kn") return "Kannada";
  return "English";
}

export function getGenderLabel(gender: VoiceGender) {
  return gender === "female" ? "Female" : "Male";
}

export function getGreetingText(name: string, language: GreetingLanguage) {
  const safeName =
    name?.trim() ||
    (language === "hi"
      ? "ऑपरेटर"
      : language === "te"
        ? "ఆపరేటర్"
        : language === "kn"
          ? "ಆಪರೇಟರ್"
          : "Operator");

  if (language === "hi") {
    return `नमस्ते ${safeName}, स्मार्ट मैनेक्विन सिस्टम में आपका स्वागत है।`;
  }

  if (language === "te") {
    return `హలో ${safeName}, స్మార్ట్ మానెక్విన్ సిస్టమ్‌కు స్వాగతం.`;
  }

  if (language === "kn") {
    return `ನಮಸ್ಕಾರ ${safeName}, ಸ್ಮಾರ್ಟ್ ಮ್ಯಾನೆಕ್ವಿನ್ ಸಿಸ್ಟಮ್‌ಗೆ ಸ್ವಾಗತ.`;
  }

  return `Welcome ${safeName}, to the Smart Mannequin System.`;
}

export function pickVoice(
  voices: SpeechSynthesisVoice[],
  language: GreetingLanguage,
  gender: VoiceGender,
): SpeechSynthesisVoice | undefined {
  const langPrefix =
    language === "hi" ? "hi" : language === "te" ? "te" : language === "kn" ? "kn" : "en";
  const matches = voices.filter((voice) => {
    const name = voice.name.toLowerCase();
    const lang = voice.lang.toLowerCase();

    if (lang.startsWith(langPrefix)) return true;

    if (language === "te") {
      return name.includes("telugu") || name.includes("telegu");
    }

    if (language === "hi") {
      return name.includes("hindi");
    }

    if (language === "kn") {
      return name.includes("kannada");
    }

    return name.includes("english");
  });

  if (matches.length === 0) {
    return undefined;
  }

  const preferredKeywords =
    gender === "female"
      ? [
          "female",
          "woman",
          "girl",
          "zira",
          "samantha",
          "aria",
          "victoria",
          "susan",
          "maya",
          "heera",
          "vani",
          "ramya",
          "swara",
          "telugu",
          "kannada",
        ]
      : [
          "male",
          "man",
          "boy",
          "david",
          "daniel",
          "mark",
          "paul",
          "aaron",
          "harry",
          "roger",
          "sundar",
          "srikanth",
          "telugu",
          "kannada",
        ];

  const matchByGender = matches.find((voice) =>
    preferredKeywords.some((keyword) => voice.name.toLowerCase().includes(keyword)),
  );

  return matchByGender ?? matches[0];
}

export function speakGreeting(
  name: string,
  language: GreetingLanguage,
  gender: VoiceGender,
  onEnd?: () => void,
) {
  const prefs = getVoicePreferences();
  if (prefs.muted || typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }

  const synthesis = window.speechSynthesis;

  const play = () => {
    synthesis.cancel();

    const voices = synthesis.getVoices();
    const voice = pickVoice(voices, language, gender);
    const utterance = new SpeechSynthesisUtterance(getGreetingText(name, language));
    const targetLang =
      language === "hi" ? "hi-IN" : language === "te" ? "te-IN" : language === "kn" ? "kn-IN" : "en-US";

    utterance.lang = targetLang;
    utterance.rate = 0.98;
    utterance.pitch = gender === "female" ? 1.2 : 0.9;
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();

    if (
      voice &&
      voice.lang
        .toLowerCase()
        .startsWith(language === "hi" ? "hi" : language === "te" ? "te" : language === "kn" ? "kn" : "en")
    ) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.voice = undefined;
    }

    synthesis.speak(utterance);
  };

  const voices = synthesis.getVoices();
  if (voices.length > 0) {
    play();
    return;
  }

  if ("addEventListener" in synthesis) {
    const onVoicesReady = () => {
      play();
      synthesis.removeEventListener("voiceschanged", onVoicesReady);
    };

    synthesis.addEventListener("voiceschanged", onVoicesReady, { once: true });
    return;
  }

  const previousVoiceHandler = synthesis.onvoiceschanged;
  synthesis.onvoiceschanged = () => {
    if (synthesis.getVoices().length > 0) {
      play();
      synthesis.onvoiceschanged = previousVoiceHandler ?? null;
    }
  };
}

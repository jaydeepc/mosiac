/**
 * Every tunable lives in .env.local. This module reads them once with sane fallbacks
 * so that a model swap is a one-line change in the env file.
 */
function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var ${name}`);
  }
  return v;
}

export const config = {
  appName: env("APP_NAME", "Mosaic"),
  appUrl: env("APP_URL", "http://localhost:3000"),
  mongoUri: () => env("MONGODB_URI"),
  mongoDb: env("MONGODB_DB", "mosaic"),
  authSecret: env("AUTH_SECRET", "mosaic-dev-secret"),
  admin: {
    email: env("ADMIN_EMAIL", "jaydeep.c1@gmail.com").toLowerCase(),
    password: env("ADMIN_PASSWORD", "admin123"),
    name: env("ADMIN_NAME", "Admin"),
  },
  allowSelfSignup: env("ALLOW_SELF_SIGNUP", "false") === "true",
  openrouter: {
    key: () => env("OPENROUTER_API_KEY"),
    baseUrl: env("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
  },
  models: {
    writer: env("MODEL_WRITER", "google/gemini-3.8-flash"),
    fast: env("MODEL_FAST", "google/gemini-3.5-flash-lite"),
    decision: env("MODEL_DECISION", "typesafe/jev-router"),
    research: env("MODEL_RESEARCH", "google/gemini-3.8-flash"),
    transcribe: env("MODEL_TRANSCRIBE", "google/gemini-3.5-flash-lite"),
    image: env("MODEL_IMAGE", "openai/gpt-image-2.5-sunburst"),
  },
  web: {
    engine: env("WEB_SEARCH_ENGINE", "native"),
    maxResults: Number(env("WEB_SEARCH_MAX_RESULTS", "8")),
  },
  image: {
    quality: env("IMAGE_QUALITY", "medium"),
    format: env("IMAGE_FORMAT", "webp"),
  },
  questionBudget: Number(env("QUESTION_BUDGET", "4")),
  maxUploadMb: Number(env("MAX_UPLOAD_MB", "15")),
};

export const LANGUAGES: { code: string; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "ur", label: "Urdu", native: "اردو" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "fr", label: "French", native: "Français" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "pt", label: "Portuguese", native: "Português" },
  { code: "it", label: "Italian", native: "Italiano" },
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "zh", label: "Chinese", native: "中文" },
  { code: "id", label: "Indonesian", native: "Bahasa Indonesia" },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt" },
  { code: "tr", label: "Turkish", native: "Türkçe" },
  { code: "ru", label: "Russian", native: "Русский" },
  { code: "nl", label: "Dutch", native: "Nederlands" },
  { code: "sw", label: "Swahili", native: "Kiswahili" },
];

export function languageLabel(code?: string | null): string {
  if (!code) return "English";
  return LANGUAGES.find((l) => l.code === code)?.native ?? code;
}
export function languageEnglishName(code?: string | null): string {
  if (!code) return "English";
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

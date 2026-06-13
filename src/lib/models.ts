// Selectable AI models (sent to the backend per request).
export interface ModelOption {
  id: string;
  label: string;
}

export const MODELS: ModelOption[] = [
  // Work immediately with the current Perplexity key.
  { id: "sonar", label: "Perplexity Sonar（現キーで即動作）" },
  { id: "sonar-pro", label: "Perplexity Sonar Pro（現キーで即動作）" },
  // Require AI_BASE_URL/AI_API_KEY pointed at OpenRouter or OpenAI.
  { id: "openai/gpt-5.5", label: "GPT-5.5（要 OpenRouter/OpenAI キー）" },
  { id: "openai/gpt-5.4-nano", label: "GPT-5.4 nano（要 OpenRouter/OpenAI キー）" },
];

// Default to a model that works with the current Perplexity key out of the box.
export const DEFAULT_MODEL = MODELS[0].id;

const STORAGE_KEY = "fmp.model";

export function getModel(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && MODELS.some((m) => m.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_MODEL;
}

export function setModel(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

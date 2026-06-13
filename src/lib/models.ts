// Selectable AI models (sent to the backend per request).
export interface ModelOption {
  id: string;
  label: string;
}

export const MODELS: ModelOption[] = [
  { id: "openai/gpt-5.5", label: "GPT-5.5" },
  { id: "openai/gpt-5.4-nano", label: "GPT-5.4 nano（高速・低コスト）" },
];

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

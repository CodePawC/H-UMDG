import type { EvidenceItem } from "../types";

const STORAGE_KEY = "hudmp.admin.evidence.v1";
export const EVIDENCE_CHANGED_EVENT = "hudmp:evidence-changed";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function notifyEvidenceChanged(): void {
  window.dispatchEvent(new CustomEvent(EVIDENCE_CHANGED_EVENT));
}

export function readEvidenceItems(): EvidenceItem[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is EvidenceItem => isRecord(item) && typeof item.id === "string");
  } catch {
    return [];
  }
}

function writeEvidenceItems(items: EvidenceItem[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 100)));
  notifyEvidenceChanged();
}

export function saveEvidenceFromText(evidenceText: string, fallbackTitle: string): EvidenceItem {
  let payload: Record<string, unknown> = {
    evidence_text: evidenceText
  };

  try {
    const parsed = JSON.parse(evidenceText);
    if (isRecord(parsed)) {
      payload = parsed;
    }
  } catch {
    // Keep the text payload. This should be rare because workbench evidence is JSON.
  }

  const item: EvidenceItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    title: asString(payload.title) ?? fallbackTitle,
    evidence_type: asString(payload.evidence_type) ?? "H_UMDG_ADMIN_UI_ALPHA",
    generated_at: asString(payload.generated_at) ?? new Date().toISOString(),
    trace_id: asString(payload.trace_id),
    http_status: asNumber(payload.http_status),
    ok: typeof payload.ok === "boolean" ? payload.ok : undefined,
    payload
  };

  writeEvidenceItems([item, ...readEvidenceItems()]);
  return item;
}

export async function copyAndSaveEvidence(evidenceText: string, fallbackTitle: string): Promise<string> {
  saveEvidenceFromText(evidenceText, fallbackTitle);

  try {
    await navigator.clipboard.writeText(evidenceText);
    return "Evidence copied and saved";
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Clipboard unavailable";
    return `Evidence saved; ${reason}`;
  }
}

export function removeEvidenceItem(id: string): void {
  writeEvidenceItems(readEvidenceItems().filter((item) => item.id !== id));
}

export function clearEvidenceItems(): void {
  writeEvidenceItems([]);
}

import type { AdminConfig } from "../types";
import { APP_VERSION_LABEL } from "./appIdentity";

const STORAGE_KEY = "humdg.admin.config.v1";
const LEGACY_API_BASE_URLS = new Set(["http://127.0.0.1:8000", "http://localhost:8000", "http://127.0.0.1:8101", "http://localhost:8101"]);
const LEGACY_CANDIDATE_VERSIONS = new Set(["dev", "试运行版", "v0.8.2", "v0.8.3", "v0.8.3+20260525.001", "v0.8.4+20260525.002"]);

const env = import.meta.env as Record<string, string | undefined>;

export const defaultConfig: AdminConfig = {
  apiBaseUrl: env.VITE_UMDG_API_BASE_URL ?? env.VITE_HUDMP_API_BASE_URL ?? "http://127.0.0.1:8101",
  apiKey: "",
  environmentName: env.VITE_UMDG_ENVIRONMENT_NAME ?? env.VITE_HUDMP_ENVIRONMENT_NAME ?? "本机服务",
  candidateVersion: env.VITE_UMDG_CANDIDATE_VERSION ?? env.VITE_HUDMP_CANDIDATE_VERSION ?? APP_VERSION_LABEL,
  language: "zh"
};

export function loadConfig(): AdminConfig {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultConfig;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AdminConfig>;
    return {
      ...defaultConfig,
      ...parsed,
      apiBaseUrl:
        !parsed.apiBaseUrl || LEGACY_API_BASE_URLS.has(parsed.apiBaseUrl)
          ? defaultConfig.apiBaseUrl
          : parsed.apiBaseUrl,
      apiKey: parsed.apiKey || "",
      environmentName:
        !parsed.environmentName || parsed.environmentName === "local"
          ? defaultConfig.environmentName
          : parsed.environmentName,
      candidateVersion:
        !parsed.candidateVersion || LEGACY_CANDIDATE_VERSIONS.has(parsed.candidateVersion)
          ? defaultConfig.candidateVersion
          : parsed.candidateVersion,
      language: "zh"
    };
  } catch {
    return defaultConfig;
  }
}

export function saveConfig(config: AdminConfig): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

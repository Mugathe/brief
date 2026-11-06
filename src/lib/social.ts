export const PLATFORMS = [
  { id: "x", label: "X" }, { id: "tiktok", label: "TikTok" }, { id: "instagram", label: "Instagram" }, { id: "facebook", label: "Facebook" },
  { id: "youtube", label: "YouTube" }, { id: "whatsapp", label: "WhatsApp" }, { id: "telegram", label: "Telegram" }, { id: "other", label: "Other" },
] as const;
export type PlatformId = (typeof PLATFORMS)[number]["id"];
export const platformLabel = (id: string) => PLATFORMS.find((p) => p.id === id)?.label ?? id;
export type SocialItem = { id: string; platform: string; topic: string; note: string; url: string | null; created_at: string; expires_at: string };

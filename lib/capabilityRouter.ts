export interface CapabilityProfile {
  text: boolean; code: boolean; vision: boolean;
  imageGen: boolean; video: boolean; music: boolean;
  transcription: boolean; embeddings: boolean;
}

export const DEFAULT_CAPABILITIES: CapabilityProfile = {
  text: true, code: true, vision: false,
  imageGen: false, video: false, music: false,
  transcription: false, embeddings: false,
};

export function detectCapabilities(providerName?: string): CapabilityProfile {
  switch (providerName) {
    case "groq": return { ...DEFAULT_CAPABILITIES, text: true, code: true, vision: true, imageGen: false, video: false, music: false, transcription: true, embeddings: true };
    case "gemini": return { ...DEFAULT_CAPABILITIES, text: true, vision: true, imageGen: true, video: true, music: false, transcription: true, embeddings: true };
    case "ollama": return { ...DEFAULT_CAPABILITIES, text: true, code: true, vision: false, imageGen: false, video: false, music: false, transcription: false, embeddings: false };
    default: return DEFAULT_CAPABILITIES;
  }
}

export function capabilityForTask(profile: CapabilityProfile, task: string): boolean {
  const t = task.toLowerCase();
  if (t.includes("image") || t.includes("generate img") || t.includes("photo")) return profile.imageGen || profile.vision;
  if (t.includes("music") || t.includes("audio")) return profile.music;
  if (t.includes("video") || t.includes("edit")) return profile.video || profile.vision;
  if (t.includes("code") || t.includes("script")) return profile.code;
  return profile.text;
}
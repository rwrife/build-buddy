export const PET_SKINS = ["duck", "cat", "ghost"] as const;
export type PetSkin = (typeof PET_SKINS)[number];

export const PET_MOODS = ["happy", "sad", "working", "unknown"] as const;
export type PetMood = (typeof PET_MOODS)[number];

export const DEFAULT_PET_SKIN: PetSkin = "duck";

export const PET_SKIN_FRAMES: Record<PetSkin, Record<PetMood, readonly string[]>> = {
  duck: {
    happy: ["🦆✨", "🦆🎉", "🦆🌟"],
    sad: ["🦆💧", "🦆🌧️", "🦆💔"],
    working: ["🦆⚙️", "🦆💻", "🦆🔨"],
    unknown: ["🦆❔"],
  },
  cat: {
    happy: ["😸✨", "😺🎉", "😸🌟"],
    sad: ["😿💧", "🙀🌧️", "😿💔"],
    working: ["😼⚙️", "🐈💻", "😼🔨"],
    unknown: ["🐈❔"],
  },
  ghost: {
    happy: ["👻✨", "👻🎉", "👻🌟"],
    sad: ["👻💧", "👻🌧️", "👻💔"],
    working: ["👻⚙️", "👻💻", "👻🔨"],
    unknown: ["👻❔"],
  },
};

export function isPetSkin(value: unknown): value is PetSkin {
  return typeof value === "string" && PET_SKINS.includes(value as PetSkin);
}

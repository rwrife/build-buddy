type BuddyMood = "happy" | "sad" | "working" | "unknown";
type BuddySkin = "duck" | "cat" | "ghost";

const buddyFrames: Record<BuddySkin, Record<BuddyMood, readonly string[]>> = {
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

const avatar = document.getElementById("buddyAvatar") as HTMLDivElement;
const face = document.getElementById("buddyFace") as HTMLSpanElement;
const sourceName = document.getElementById("sourceName") as HTMLDivElement;
const sourceDetail = document.getElementById("sourceDetail") as HTMLDivElement;
const moodDetail = document.getElementById("moodDetail") as HTMLDivElement;

let skin: BuddySkin = "duck";
let frameTimer: ReturnType<typeof setInterval> | null = null;

window.buddyApi.onInit((init) => {
  skin = init.skin;
  sourceName.textContent = init.name;
  sourceDetail.textContent = init.detail;
  avatar.classList.remove("skin-duck", "skin-cat", "skin-ghost");
  avatar.classList.add(`skin-${skin}`);
  renderMood("unknown", `${init.kind} source`);
});

window.buddyApi.onMood((update) => {
  renderMood(update.mood, update.detail);
});

function renderMood(mood: BuddyMood, detail: string): void {
  if (frameTimer) {
    clearInterval(frameTimer);
    frameTimer = null;
  }

  avatar.classList.remove("mood-happy", "mood-sad", "mood-working", "mood-unknown");
  avatar.classList.add(`mood-${mood}`);
  moodDetail.textContent = detail;

  const moodFrames = buddyFrames[skin][mood];
  let index = 0;
  const draw = (): void => {
    face.textContent = moodFrames[index % moodFrames.length];
    index += 1;
  };
  draw();
  if (moodFrames.length > 1) {
    frameTimer = setInterval(draw, mood === "working" ? 280 : 520);
  }
}

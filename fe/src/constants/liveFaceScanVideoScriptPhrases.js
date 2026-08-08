/** Random intro lines for live face scan fallback video — [Name] replaced with member first name. */
export const LIVE_FACE_SCAN_VIDEO_SCRIPT_PHRASES = [
  "Hi, I'm [Name], and I'm looking for someone to share my dessert with... or at least let me watch them eat theirs.",
  "Hey there, I'm [Name]! I promise I look exactly like my photos, except on Mondays.",
  "Hi, I'm [Name]. I'm fluent in sarcasm, movie quotes, and knowing exactly what I want for dinner.",
  "Greetings! I'm [Name], your future favorite hello and hardest goodbye.",
  "Hey, I'm [Name]. I love long walks to the fridge and spontaneous weekend adventures.",
  "Hi, I'm [Name]! If we match, I'll let you pick the movie for our first date. No pressure.",
  "Hello, I'm [Name], and I'm currently taking applications for a partner in crime.",
  "Hey, I'm [Name]! I'm easygoing, fun, and only mildly addicted to coffee.",
  "Hi, I'm [Name]. I'm looking for someone who can match my energy and tolerate my singing in the car.",
  "Greetings, I'm [Name]. I'm a big fan of good vibes, great food, and even better company.",
  "Hey there, I'm [Name]. I'm here to find my missing puzzle piece... or at least someone to help me look for it.",
  "Hi, I'm [Name], and I'm proof that you can be both a masterpiece and a work in progress.",
  "Hello! I'm [Name]. Let's skip the small talk and argue about which pizza topping is the best.",
  "Hey, I'm [Name]! I'm 50% sweetheart, 50% sarcasm, and 100% looking for a great date.",
  "Hi, I'm [Name]. I bring the fun, you bring the snacks, and we'll call it a match.",
  "Greetings! I'm [Name]. I'm looking for someone to make everyday moments feel like a vacation.",
  "Hey, I'm [Name]. I'm told I have a great laugh, but I'll let you be the judge of that.",
  "Hi, I'm [Name]. I'm ready to delete this app, but I need your help to do it.",
  "Hello, I'm [Name]! I'm basically a golden retriever in human form—loyal, fun, and easily distracted by food.",
  "Hey there, I'm [Name]. I'm hoping to find someone who thinks my quirks are cute instead of weird."
];

export function formatLiveFaceScanScriptFirstName(rawName) {
  const trimmed = String(rawName ?? '').trim();
  if (!trimmed) return 'Friend';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function pickRandomLiveFaceScanScriptPhrase(firstName) {
  const name = formatLiveFaceScanScriptFirstName(firstName);
  const index = Math.floor(Math.random() * LIVE_FACE_SCAN_VIDEO_SCRIPT_PHRASES.length);
  return LIVE_FACE_SCAN_VIDEO_SCRIPT_PHRASES[index].replace(/\[Name\]/g, name);
}

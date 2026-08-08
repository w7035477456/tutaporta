/**
 * Profile & Records (/profileRecords) page-instruction copy.
 * Keep TTS bake script in sync:
 *   be/scripts/generateProfilesRecordsInstructionTutorialGemini.js
 */
export const PROFILES_RECORDS_INSTRUCTION_CONTEXT_TITLE = 'Current Context Tutorial';
export const PROFILES_RECORDS_INSTRUCTION_CONTEXT_STEP = 'You are in Profile & Records Page.';

/** Flat narration text (matches ProfilesRecordsInstructionBody). */
export const PROFILES_RECORDS_INSTRUCTION_SPEAK_TEXT = [
  'Welcome to Profile and Records.',
  'This is your main dashboard for managing who you are on the site and how you interact with others.',
  'Profile: This is where you maintain your identity. You can change your alias, email, password, and mailing address here. We only need your address for delivering flowers; other members never see your real name or your street address, just your city.',
  'Buy Tokens: Keep your token balance topped up! Tokens allow you to unlock member information. Viewing a Brief Bio costs 1 token, and viewing a Full Bio costs 2 tokens.',
  'Balance History: Your go-to spot to track every token you have spent, refills you have purchased, and credits you have earned through referrals.',
  'Posting on FB: Want free tokens? Use this tab to easily generate a Facebook post featuring your unique sharing code. When friends sign up using your code, you get token credits you can use on any Tuta domain: Date, Notes, Photo Album, Professional Networks, Buy and Bid, or Classified.',
  'Refer Email: Prefer email? Generate a pre-written invitation to send to friends, including your unique sharing code. You get token credits, valid across all Tuta domains, for every successful sign-up using your code.',
  'Consent: Manage your sharing permissions. This tab shows you exactly which members you have approved and allows you to view past snapshots of your submitted self-reported biography.'
].join(' ');

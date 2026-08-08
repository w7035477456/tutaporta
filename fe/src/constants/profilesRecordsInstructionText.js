/**
 * Profile & Records (/profileRecords) page-instruction copy.
 * Keep TTS bake script in sync:
 *   be/scripts/generateProfilesRecordsInstructionTutorialGemini.js
 */
export const PROFILES_RECORDS_INSTRUCTION_CONTEXT_TITLE = 'Current Context Tutorial';
export const PROFILES_RECORDS_INSTRUCTION_CONTEXT_STEP = 'You are in Profile & Records Page.';

/** Flat narration text (matches ProfilesRecordsInstructionBody). */
export const PROFILES_RECORDS_INSTRUCTION_SPEAK_TEXT = [
  'Welcome to Your Dashboard!',
  'Profile Tab: You can update your alias, email and password, profile, and mailing address. Your safety matters: if a member ID has not been claimed, we recommend only providing first name / alias and general location, not full name / mailing address. However, once a Member ID is claimed, you can complete full name and address for account recovery. We highly recommend using a nickname for anonymity.',
  'Buy Tokens Tab: This is where you can reload your token balance anytime. To view another member\'s Brief Bio, it costs 1 token. For the Full Bio, it costs 2 tokens. For a 30-day "All Access Pass," it costs 2 extra tokens (4 total instead of 2). We recommend using the Full Bio option—it provides a complete picture.',
  'Balance History Tab: This is your go-to spot to review all your past token transactions, balance refills, and referral credits.',
  'Consent Tab: This is your personal archive where you can view a history of the members you have approved, as well as take a look at the self-reported bio snapshots you\'ve submitted in the past.'
].join(' ');

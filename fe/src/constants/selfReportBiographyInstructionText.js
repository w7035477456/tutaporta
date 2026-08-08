/**
 * My Self-Report-Bio (/selfReportBiography) page-instruction copy for TTS.
 * Keep bake script in sync:
 *   be/scripts/generateSelfReportBiographyInstructionTutorialGemini.js
 */
export const SELF_REPORT_BIOGRAPHY_INSTRUCTION_CONTEXT_TITLE = 'Current Context Tutorial';
export const SELF_REPORT_BIOGRAPHY_INSTRUCTION_CONTEXT_STEP =
  'You are in My Self-Reporting-Biography page.';

/** Flat narration text (matches SelfReportBiographyInstructionBody). */
export const SELF_REPORT_BIOGRAPHY_INSTRUCTION_SPEAK_TEXT = [
  'How it Works: Secure Bio Verification.',
  'Welcome to your Bio Verification control panel. To ensure maximum trust and safety while fully protecting your privacy, start with these two secure stages.',
  'Step 1 - Complete Your Profile Bios. Fill out the three biographical sections below: Brief Bio, Full Bio, and Miscellaneous Optional Bio. You have total control over what details you choose to self-report and reveal on your profile.',
  'Step 2 - Off-Site Secure Verification via 3rd-Party. Click the link to initiate your verification check with 3rd-Party, our reputable, nationwide third-party verification service.',
  'Complete Privacy: 3rd-Party will contact you directly via email. You will enter your sensitive personal information, such as your SSN and Date of Birth, securely on 3rd-Party\'s platform only.',
  'Zero Database Exposure: Our server never sees, collects, or has access to your sensitive PII.',
  'FCRA Protection: Once 3rd-Party completes their assessment, they transmit raw verification data to our secure server. Due to strict federal FCRA regulations, we never share or expose this raw data to anyone. We only use it internally to cross-check against the profile information you filled out on this page.'
].join(' ');

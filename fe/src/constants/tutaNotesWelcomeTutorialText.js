/**
 * TutaNotes welcome / header tutorial copy (ColorTemplate16 popup + Gemini TTS).
 * Keep bake script in sync:
 *   be/scripts/generateTutaNotesWelcomeTutorialGemini.js
 */

export const TUTANOTES_WELCOME_TUTORIAL_CONTEXT_TITLE = 'Current Context Tutorial';
export const TUTANOTES_WELCOME_TUTORIAL_CONTEXT_STEP = 'You are in TutaNotes.';

export const TUTANOTES_WELCOME_TUTORIAL_INTRO =
  'Welcome! We’ve created sample notes (SAMPLE NOTE1 and SAMPLE NOTE2) inside SAMPLE NOTEBOOK to help you get started (feel free to rename the titles)';

/** Numbered tutorial lines shown in the popup (bold labels + body). */
export const TUTANOTES_WELCOME_TUTORIAL_ITEMS = [
  {
    label: '1. Flexible Organization:',
    body: 'You can create multiple Notes within a single Notebook.'
  },
  {
    label: '2. Quick Access:',
    body: 'Drag any Notebook or Note to the Shortcuts panel on the right for fast access later.'
  },
  {
    label: '3. Powerful Search:',
    body: 'Search instantly across all titles and text within your Notes and Notebooks.'
  },
  {
    label: '4. Backup:',
    body: 'Easily back up your work by clicking “Backup/Restore OneDrive” to create a ZIP archive.'
  },
  {
    label: '5. Seamless File Transfer:',
    body: 'Drag and drop to copy or move Notes and Notebooks between OneDrive and a USB drive.'
  },
  {
    label: '6. Safe Disconnection:',
    body: 'Always click “Log off Cloud” or “Log off USB” before disconnecting to prevent data loss.'
  },
  {
    label: '7. Import & Export:',
    body: 'Seamlessly convert files to and from Markdown, HTML, and PDF using the File menu.'
  },
  {
    label: '8. Help & Dictation:',
    body: 'Click “Tutorial” in the top-right corner to access tutorials and voice dictation. Starter SAMPLE NOTE1 / SAMPLE NOTE2 can be edited or deleted anytime.'
  },
  {
    label: '9. Upgrade Speed:',
    body: 'Need faster performance? Click “Click Here” in the top-left corner to add high-priority server bandwidth (GB allocation).'
  },
  {
    label: '10. USB vs OneDrive:',
    body: 'USB is much faster than OneDrive, but requires USB Bridge — OneDrive is accessible on mobile.'
  }
];

/** Flat narration for Gemini TTS (matches popup body). */
export const TUTANOTES_WELCOME_TUTORIAL_SPEAK_TEXT = [
  TUTANOTES_WELCOME_TUTORIAL_INTRO,
  ...TUTANOTES_WELCOME_TUTORIAL_ITEMS.map((item) => `${item.label} ${item.body}`)
].join(' ');

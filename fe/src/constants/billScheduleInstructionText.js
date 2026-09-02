/**
 * Bill Schedule (Monthly / Yearly) context tutorial copy.
 * Keep bake script in sync:
 *   be/scripts/generateBillScheduleInstructionTutorialGemini.js
 */

export const BILL_SCHEDULE_INSTRUCTION_CONTEXT_TITLE = 'Current Context Tutorial';
export const BILL_SCHEDULE_INSTRUCTION_CONTEXT_STEP = 'You are in Bill Schedule.';
export const BILL_SCHEDULE_INSTRUCTION_BUTTON_LABEL = 'Tutorial';

/** Flat narration for Gemini TTS (matches popup body). */
export const BILL_SCHEDULE_INSTRUCTION_SPEAK_TEXT = [
  BILL_SCHEDULE_INSTRUCTION_CONTEXT_TITLE,
  BILL_SCHEDULE_INSTRUCTION_CONTEXT_STEP,
  'Monthly: The Monthly tab lists bills whose Due Date falls in the month you are viewing. Use the large calendar to see when each bill is due.',
  'Yearly: The Yearly tab lists bills due at any time during the year you are viewing. Mini-calendars show due dates across all twelve months.',
  'Today Date: red outline on the calendar.',
  'Manual Pay Note Due yet: black circle — manual bill not paid and not overdue.',
  'Auto pay: yellow — Type is Auto; payment is automatic.',
  'Manual Paid: green — you marked Action as Paid.',
  'Manual Not Paid Overdue or Late: red — manual bill past due and not paid.',
  'Click the Bill column to open Bills and Receipts. Use Add for a new row, the red X after Description to remove a row, and SAVE to store your changes.'
].join(' ');

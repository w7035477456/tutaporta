export const DEFAULT_BODY_TEXT = '';

/** Fresh vault after format cloud / USB: sample notebook (see recordVaultNewMemberSample). */
export const DEFAULT_NOTEBOOKS = ['SAMPLE MISC', 'SAMPLE TAX RECORDS'];

/** @deprecated Prefer SAMPLE NOTE1 from recordVaultNewMemberSample manifest. */
export const DEFAULT_SAMPLE_NOTE_NAME = 'SAMPLE NOTE1';

/**
 * @deprecated Prefer HTML files under be/assets/recordVaultNewMemberSample/.
 * Kept for older callers / docs; new vaults seed via seedRecordVaultNewMemberSampleDb (dm1 set).
 */
export const DEFAULT_SAMPLE_NOTE_BODY_HTML = [
  '<!-- rv-new-member-sample-v2 note=1 -->',
  '<p>Welcome! We’ve created sample notes (<strong>SAMPLE NOTE1</strong> and <strong>SAMPLE NOTE2</strong>) inside <strong>SAMPLE NOTEBOOK 1</strong> to help you get started (feel free to rename the titles)</p>'
].join('');

import { ensurePaidRecord, getPaidRecordAttachmentPreviewKind, uploadPaidRecordAttachment } from 'api/paidRecordFe';
import { MOBILE_UPLOAD_PRODUCT_TUTANOTES } from 'constants/mobileUploadProduct';
import {
  isRecordVaultMobileUploadDrag,
  materializeRecordVaultMobileUploadFile,
  readRecordVaultMobileUploadDragFileNames
} from './RecordVaultMobileUploadTray';

/** Mobile Upload thumbnails or files from the computer can be dropped on a bill row. */
export function isBillRowAttachDrag(dataTransfer) {
  const types = dataTransfer?.types ? Array.from(dataTransfer.types) : [];
  return isRecordVaultMobileUploadDrag(dataTransfer) || types.includes('Files');
}

/**
 * Must run synchronously inside the drop event: the browser empties dataTransfer afterwards.
 * @returns {{ mobileUploadNames: string[], files: File[] }}
 */
export function readBillRowDrop(dataTransfer) {
  const mobileUploadNames = isRecordVaultMobileUploadDrag(dataTransfer) ? readRecordVaultMobileUploadDragFileNames(dataTransfer) : [];
  const files = mobileUploadNames.length ? [] : Array.from(dataTransfer?.files || []);
  return { mobileUploadNames, files };
}

/**
 * Create/load the bill row's paid_record and upload every dropped item into it.
 * Mobile Upload photos are copied (they stay in the tray), same as dropping onto a note.
 * @returns {Promise<{ record: object | null, uploaded: number, skipped: number }>}
 */
export async function attachDropToBillRow(ensurePayload, storageType, { mobileUploadNames = [], files = [] }) {
  const gathered = [...files];
  for (const name of mobileUploadNames) {
    gathered.push(await materializeRecordVaultMobileUploadFile(name, MOBILE_UPLOAD_PRODUCT_TUTANOTES));
  }
  const toUpload = gathered.filter((file) => getPaidRecordAttachmentPreviewKind(file?.type, file?.name) != null);
  const unsupported = gathered.length - toUpload.length;
  if (!toUpload.length) return { record: null, uploaded: 0, skipped: 0, unsupported };

  const ensured = await ensurePaidRecord(ensurePayload, { storageType });
  const paidRecordId = Number(ensured?.paidRecordId);
  if (!paidRecordId) throw new Error('Unable to open this bill for attachments');

  let record = ensured;
  let uploaded = 0;
  let skipped = 0;
  for (const file of toUpload) {
    const result = await uploadPaidRecordAttachment(paidRecordId, file);
    record = result;
    if (result?.skipped) skipped += 1;
    else uploaded += 1;
  }
  return {
    record: {
      ...record,
      monthlyBillId: record?.monthlyBillId || ensured?.monthlyBillId,
      yearlyBillId: record?.yearlyBillId || ensured?.yearlyBillId
    },
    uploaded,
    skipped,
    unsupported
  };
}

export function billRowDropResultMessage({ uploaded, skipped, unsupported }, billLabel) {
  const target = String(billLabel || '').trim() || 'this bill';
  const parts = [];
  if (uploaded) parts.push(`Attached ${uploaded} file${uploaded === 1 ? '' : 's'} to ${target}`);
  if (skipped) parts.push(`skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}`);
  if (unsupported) parts.push(`ignored ${unsupported} unsupported file${unsupported === 1 ? '' : 's'} (images, PDF, DOCX only)`);
  return parts.join(', ') || 'Nothing to attach';
}

import api from './axios';

/** @returns {'image'|'pdf'|'docx'|null} */
export function getPaidRecordAttachmentPreviewKind(mime, fileName) {
  const m = String(mime || '').toLowerCase();
  const n = String(fileName || '').toLowerCase();
  if (m.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|heic)$/i.test(n)) return 'image';
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (
    m.includes('wordprocessingml.document') ||
    m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    n.endsWith('.docx')
  ) {
    return 'docx';
  }
  return null;
}

function isPreviewable(mime, fileName) {
  return getPaidRecordAttachmentPreviewKind(mime, fileName) != null;
}

function mapAttachment(row) {
  if (!row) return null;
  const attachmentId = Number(
    row.attachmentId ?? row.paid_record_attachment_id ?? row.attachment_id
  );
  const originalFileName = row.originalFileName ?? row.original_file_name ?? '';
  const mimeType = row.mimeType ?? row.mime_type ?? 'application/octet-stream';
  return {
    attachmentId: Number.isFinite(attachmentId) ? attachmentId : null,
    paidRecordId: Number(row.paidRecordId ?? row.paid_record_id) || null,
    originalFileName,
    storedFileName: row.storedFileName ?? row.stored_file_name ?? '',
    mimeType,
    byteSize: Number(row.byteSize ?? row.byte_size) || 0,
    checksum: row.checksum ? String(row.checksum).toLowerCase() : null,
    relativePath: row.relativePath ?? row.relative_path ?? '',
    createdAt: row.createdAt ?? row.created_at ?? null,
    previewKind: getPaidRecordAttachmentPreviewKind(mimeType, originalFileName),
    previewable: row.previewable != null ? Boolean(row.previewable) : isPreviewable(mimeType, originalFileName)
  };
}

function mapPaidRecord(data) {
  if (!data) return null;
  const paidRecordId = Number(data.paidRecordId ?? data.paid_record_id);
  const attachments = Array.isArray(data.attachments)
    ? data.attachments.map(mapAttachment).filter(Boolean)
    : [];
  const notesText = data.notesText ?? data.notes_text ?? '';
  const hasBillContent =
    data.hasBillContent != null
      ? Boolean(data.hasBillContent)
      : data.has_bill_content != null
        ? Boolean(data.has_bill_content)
        : String(notesText).trim().length > 0 || attachments.length > 0;
  return {
    ok: data.ok,
    paidRecordId: Number.isFinite(paidRecordId) && paidRecordId > 0 ? paidRecordId : null,
    scheduleKind: data.scheduleKind ?? data.schedule_kind ?? null,
    monthlyBillId: Number(data.monthlyBillId ?? data.monthly_bill_id) || null,
    yearlyBillId: Number(data.yearlyBillId ?? data.yearly_bill_id) || null,
    storageBackend: data.storageBackend ?? data.storage_backend ?? null,
    notesText,
    attachments,
    hasBillContent,
    uploadedAttachmentId:
      Number(data.uploadedAttachmentId ?? data.attachment?.paid_record_attachment_id) || null,
    createdAt: data.createdAt ?? data.created_at ?? null,
    updatedAt: data.updatedAt ?? data.updated_at ?? null
  };
}

/** POST /api/paidRecord/ensure — create/link paid_record for a bill row. */
export async function ensurePaidRecord(payload, { storageType } = {}) {
  const body = { ...(payload || {}) };
  if (storageType != null) {
    body.storageType = storageType;
    body.storage_backend = storageType;
  }
  const { data } = await api.post('/api/paidRecord/ensure', body);
  return mapPaidRecord(data);
}

/** GET /api/paidRecord/:id */
export async function fetchPaidRecord(paidRecordId) {
  const { data } = await api.get(`/api/paidRecord/${encodeURIComponent(paidRecordId)}`);
  return mapPaidRecord(data);
}

/** PUT /api/paidRecord/:id/notes */
export async function savePaidRecordNotes(paidRecordId, notesText) {
  const { data } = await api.put(`/api/paidRecord/${encodeURIComponent(paidRecordId)}/notes`, {
    notes_text: notesText ?? ''
  });
  // Keep existing attachments client-side; only notes/hasBillContent change here
  return {
    ...mapPaidRecord({ ...data, paid_record_id: paidRecordId }),
    attachments: undefined
  };
}

/** POST /api/paidRecord/:id/attachments — multipart file */
export async function uploadPaidRecordAttachment(paidRecordId, file) {
  const form = new FormData();
  form.append('file', file, file?.name || 'file');
  const { data } = await api.post(
    `/api/paidRecord/${encodeURIComponent(paidRecordId)}/attachments`,
    form
  );
  // Re-fetch full record so notes + attachments stay in sync
  const full = await fetchPaidRecord(paidRecordId);
  full.skipped = Boolean(data?.skipped);
  full.skipMessage =
    data?.message || data?.error || (data?.skipped ? 'Skipping upload duplicate file' : '');
  if (data?.attachment) {
    const att = mapAttachment(data.attachment);
    full.uploadedAttachmentId = att?.attachmentId || null;
  } else {
    full.uploadedAttachmentId =
      Number(data?.uploadedAttachmentId) ||
      full.attachments?.[full.attachments.length - 1]?.attachmentId ||
      null;
  }
  return full;
}

/** Fetch attachment bytes (cookie auth) for in-app PDF/DOCX preview. */
export async function fetchPaidRecordAttachmentBlob(paidRecordId, attachmentId) {
  const { data } = await api.get(
    `/api/paidRecord/${encodeURIComponent(paidRecordId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { responseType: 'blob' }
  );
  return data;
}

/** Inline preview URL (same-origin cookie auth). */
export function paidRecordAttachmentUrl(paidRecordId, attachmentId) {
  return `/api/paidRecord/${encodeURIComponent(paidRecordId)}/attachments/${encodeURIComponent(attachmentId)}`;
}

/** @deprecated alias — use paidRecordAttachmentUrl */
export function paidRecordAttachmentPreviewUrl(paidRecordId, attachmentId) {
  return paidRecordAttachmentUrl(paidRecordId, attachmentId);
}

/** Download URL. */
export function paidRecordAttachmentDownloadUrl(paidRecordId, attachmentId) {
  return `/api/paidRecord/${encodeURIComponent(paidRecordId)}/attachments/${encodeURIComponent(attachmentId)}/download`;
}

/** DELETE /api/paidRecord/:id/attachments/:attachmentId */
export async function deletePaidRecordAttachment(paidRecordId, attachmentId) {
  await api.delete(
    `/api/paidRecord/${encodeURIComponent(paidRecordId)}/attachments/${encodeURIComponent(attachmentId)}`
  );
  return fetchPaidRecord(paidRecordId);
}

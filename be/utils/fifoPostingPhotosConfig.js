/** Max posting photos kept per user (FIFO). Unset or invalid → feature disabled. */
export function getFifoMaxKeepCountPostingPhotos() {
  const raw = String(process.env.FIFO_MAX_KEEP_COUNT_POSTING_PHOTOS ?? '').trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.trunc(n);
}

/** @deprecated Use DB-backed oldest-sequence selection in getMyPicks.js instead. */
export function planPostingPhotoFifoDeletions(currentSequence, photosToAddCount, maxKeep) {
  const max = Number(maxKeep);
  const addCount = Number(photosToAddCount);
  if (!Number.isFinite(max) || max < 1 || !Number.isFinite(addCount) || addCount < 1) {
    return [];
  }
  const deletions = [];
  let current = Number(currentSequence) || 0;
  for (let i = 0; i < addCount; i += 1) {
    const nextSeq = current + 1;
    if (nextSeq > max) {
      deletions.push(nextSeq - max);
    }
    current = nextSeq;
  }
  return deletions;
}

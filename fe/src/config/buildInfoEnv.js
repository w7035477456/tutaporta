/**
 * Build stamp from /build-info.json (written when Vite finishes start/build).
 * Same file the CLI (`showbuild` / print-build-info.mjs) reads.
 */

/** @returns {Promise<string>} full stamp or '' */
export async function fetchBuildLabel() {
  try {
    const res = await fetch(`/build-info.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return '';
    const data = await res.json();
    if (typeof data?.label === 'string' && data.label.trim()) return data.label.trim();
    const datetime = typeof data?.datetime === 'string' ? data.datetime.trim() : '';
    const commit = typeof data?.commit === 'string' ? data.commit.trim() : '';
    const src =
      (typeof data?.sourceChecksum === 'string' ? data.sourceChecksum.trim() : '') ||
      (typeof data?.checksum === 'string' ? data.checksum.trim() : '');
    if (datetime && commit && src) return `${datetime} · commit ${commit} · src ${src}`;
    if (datetime && src) return `${datetime} · src ${src}`;
    return '';
  } catch {
    return '';
  }
}

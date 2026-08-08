const PREFIX = '[PhotoAlbumsCloud]';

function formatDetail(detail) {
  if (detail == null) return undefined;
  if (typeof detail === 'string') return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

export function rvCloudLog(provider, step, detail) {
  const msg = formatDetail(detail);
  if (msg !== undefined) console.log(`${PREFIX}:${provider}`, step, msg);
  else console.log(`${PREFIX}:${provider}`, step);
}

export function rvCloudWarn(provider, step, detail) {
  const msg = formatDetail(detail);
  if (msg !== undefined) console.warn(`${PREFIX}:${provider}`, step, msg);
  else console.warn(`${PREFIX}:${provider}`, step);
}

export function rvCloudError(provider, step, err, extra) {
  console.error(`${PREFIX}:${provider}`, step, {
    message: err?.message || String(err || 'unknown'),
    status: err?.response?.status ?? null,
    responseData: err?.response?.data ?? null,
    extra: extra ?? null
  });
}

export function rvCloudAxiosError(provider, step, err) {
  rvCloudError(provider, step, err, {
    url: err?.config?.url ?? null,
    method: err?.config?.method ?? null
  });
}

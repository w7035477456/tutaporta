import api from './axios';

export async function fetchMeasureOneEducationStatus() {
  const { data } = await api.get('/api/measureone/education/status');
  return data;
}

export async function startMeasureOneEducationVerification() {
  const { data } = await api.post('/api/measureone/education/start');
  return data;
}

export async function syncMeasureOneEducationVerification(datarequestId) {
  const { data } = await api.post('/api/measureone/education/sync', { datarequestId });
  return data;
}

export async function simulateMeasureOneEducationVerification(body = {}) {
  const { data } = await api.post('/api/measureone/education/simulate', body);
  return data;
}

export function loadMeasureOneLinkScript(scriptUrl) {
  const src = String(scriptUrl ?? '').trim();
  if (!src) {
    return Promise.reject(new Error('MeasureOne widget script URL is missing'));
  }

  const existing = document.querySelector(`script[data-measureone-link="true"]`);
  if (existing?.getAttribute('src') === src && window.customElements?.get('m1-link')) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.measureoneLink = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load MeasureOne Link widget'));
    document.head.appendChild(script);
  });
}

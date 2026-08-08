import useSWR, { mutate } from 'swr';
import api from './axios';

const endpoints = {
  key: 'api/singlesPreferences',
  get: '/api/singlesPreferences',
  update: '/api/singlesPreferences'
};

const fetcher = async (url) => {
  const response = await api.get(url);
  return response.data;
};

export function useSinglesPreferences() {
  const { data, error, isLoading, mutate } = useSWR(endpoints.get, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true
  });

  return {
    preferences: data || null,
    preferencesLoading: isLoading,
    preferencesError: error,
    refetchPreferences: mutate
  };
}

export async function saveSinglesPreferences(payload = {}) {
  const body = {};
  const allowedKeys = [
    'search_partner_type',
    'search_partner_age_from',
    'search_partner_age_to',
    'search_partner_zipcode',
    'theme',
    'graphic'
  ];

  allowedKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key) && payload[key] !== undefined) {
      body[key] = payload[key];
    }
  });

  const response = await api.post(endpoints.update, body);
  await mutate(endpoints.get, response.data, { revalidate: false });
  return response.data;
}


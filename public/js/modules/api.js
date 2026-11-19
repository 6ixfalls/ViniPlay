import { showNotification } from './ui.js';
import { guideState } from './state.js';
import { readPreferences, writePreference } from './preferences.js';

export async function apiFetch(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        const error = await response.json().catch(() => ({}));
        showNotification(error.error || 'The server request failed.', true);
    } catch { showNotification('Could not connect to the server.', true); }
    return null;
}
export async function fetchConfig() {
    const response = await apiFetch('/api/config');
    if (!response) return null;
    const config = await response.json();
    config.settings = { ...config.settings, ...readPreferences() };
    return config;
}
export async function fetchAppVersion() {
    const response = await apiFetch('/api/version');
    return response ? (await response.json()).version : 'Unknown';
}
export async function savePreference(key, value) {
    try {
        const preferences = writePreference(key, value);
        Object.assign(guideState.settings, preferences);
        return guideState.settings;
    } catch { showNotification('Could not save this browser preference.', true); return null; }
}
export function getDeviceId() {
    try {
        let id = localStorage.getItem('viniplay_device_id');
        if (!id) { id = `dev_${crypto.randomUUID()}`; localStorage.setItem('viniplay_device_id', id); }
        return id;
    } catch { return 'local'; }
}
export function getDeviceSetting(key, fallback = null) {
    try {
        const value = localStorage.getItem(`viniplay_device_${getDeviceId()}_${key}`);
        if (value !== null) return JSON.parse(value);
    } catch { /* Use the in-memory or default preference when storage is unavailable. */ }
    return guideState.settings.deviceSettings?.[getDeviceId()]?.[key] ?? fallback;
}
export function saveDeviceSetting(key, value) {
    try { localStorage.setItem(`viniplay_device_${getDeviceId()}_${key}`, JSON.stringify(value)); }
    catch { showNotification('Could not save this browser preference.', true); }
}
export async function stopStream(url, profileId = null) {
    return !!await apiFetch('/api/stream/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, profileId }) });
}

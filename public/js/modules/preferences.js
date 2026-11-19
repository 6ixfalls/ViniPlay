const STORAGE_KEY = 'viniplay_preferences';
const KEYS = new Set(['favorites', 'recentChannels', 'multiviewLayouts', 'playerDimensions', 'programDetailsDimensions', 'channelColumnWidth', 'deviceSettings']);

export function readPreferences(storage) {
    try {
        const values = JSON.parse((storage || globalThis.localStorage).getItem(STORAGE_KEY) || '{}');
        if (!values || typeof values !== 'object' || Array.isArray(values)) return {};
        return Object.fromEntries(Object.entries(values).filter(([key]) => KEYS.has(key)));
    } catch { return {}; }
}
export function writePreference(key, value, storage) {
    if (!KEYS.has(key)) throw new Error('Unsupported browser preference.');
    const values = { ...readPreferences(storage), [key]: value };
    (storage || globalThis.localStorage).setItem(STORAGE_KEY, JSON.stringify(values));
    return values;
}

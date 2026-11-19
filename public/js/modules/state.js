export const appState = {
    appInitialized: false, player: null, searchDebounceTimer: null,
    fuseChannels: null, fusePrograms: null, isNavigating: false
};
export const guideState = {
    channels: [], programs: {},
    settings: { favorites: [], recentChannels: [], multiviewLayouts: [], channelColumnWidth: window.innerWidth < 768 ? 64 : 180, timezoneOffset: Math.round(-new Date().getTimezoneOffset() / 60) },
    guideDurationHours: 48, hourWidthPixels: window.innerWidth < 768 ? 200 : 300,
    currentDate: new Date(), channelGroups: new Set(), channelSources: new Set(),
    visibleChannels: [], scrollHandler: null
};
export const UIElements = {};

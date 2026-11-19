

import { appState, guideState, UIElements } from './modules/state.js';
import { apiFetch, fetchConfig, getDeviceSetting, saveDeviceSetting } from './modules/api.js'; // IMPORTED fetchConfig & device settings
import { initializeApplication } from './modules/bootstrap.js';
import { handleGuideLoad, finalizeGuideLoad, setupGuideEventListeners } from './modules/guide.js';
//-- ENHANCEMENT: Import playChannel to handle the remote channel change event.
import { setupPlayerEventListeners, playChannel, stopAndCleanupPlayer, shouldMaintainAspectRatio } from './modules/player.js';

// MODIFIED: Imported showBroadcastMessage
import { makeModalResizable, handleRouteChange, switchTab, handleConfirm, closeModal, makeColumnResizable, openMobileMenu, closeMobileMenu, showNotification, showConfirm } from './modules/ui.js';
// MODIFIED: Import navigateToProgramInGuide to handle deep links from notifications.

import { handleMultiViewChannelClick, populateChannelSelector, initMultiView } from './modules/multiview.js';

import { ICONS } from './modules/icons.js'; // MODIFIED: Import the new icon library

// The initializeCastApi function is no longer called directly from here,
// but the cast.js module will handle its own initialization via the window callback.

// NEW: Global variable to hold navigation target from a notification click

/**
 * NEW: Finds all icon placeholders in the document and injects the SVG markup.
 */
function renderIcons() {
    console.log('[MAIN] Rendering all icons from placeholders...');
    const iconPlaceholders = document.querySelectorAll('[data-icon]');
    iconPlaceholders.forEach(placeholder => {
        const iconName = placeholder.dataset.icon;
        if (ICONS[iconName]) {
            // Replace the placeholder itself with the SVG element
            const template = document.createElement('template');
            template.innerHTML = ICONS[iconName].trim();
            const svgElement = template.content.firstChild;

            // Copy any existing classes from the placeholder to the SVG
            if (placeholder.className) {
                svgElement.classList.add(...placeholder.className.split(' '));
            }

            // Replace the placeholder in the DOM
            placeholder.parentNode.replaceChild(svgElement, placeholder);
        } else {
            console.warn(`[ICONS] Icon not found in library: ${iconName}`);
        }
    });
}

/**
 * NEW: Connects to the server for real-time events using Server-Sent Events (SSE).
 * This allows the server to push updates to the client, such as invalidating a push subscription.
 */
function initializeSse() {
    const events = new EventSource('/api/events');
    events.addEventListener('feeds-updated', async () => {
        const config = await fetchConfig();
        if (config) {
            Object.assign(guideState.settings, config.settings);
            await handleGuideLoad(config.m3uContent, config.epgContent);
        }
    });
}

export async function initMainApp() {
    console.log('[MAIN] Initializing main application...');
    // 2. Setup all event listeners for the main app
    console.log('[MAIN] Setting up all event listeners...');
    setupCoreEventListeners();
    setupGuideEventListeners();
    setupPlayerEventListeners();

    // REMOVED: The direct call to initializeCastApi() is no longer needed here.
    // The cast.js module will now be initialized automatically by the Google Cast SDK callback.
    console.log('[MAIN] All event listeners set up.');

    // MODIFIED: Render all icons now that the DOM is ready.
    renderIcons();

    // 3. Load initial configuration and guide data
    try {
        console.log('[MAIN] Fetching initial configuration from server via api.js...');
        // REFACTORED: Use the centralized fetchConfig from api.js
        const config = await fetchConfig();
        if (!config) {
            throw new Error(`Could not load configuration from server. Check logs for details.`);
        }

        console.log('[MAIN] Configuration loaded:', config);
        Object.assign(guideState.settings, config.settings || {}); // Merge server settings into guideState

        // Restore UI dimensions from settings
        restoreDimensions();
        // Populate timezone selector and update other settings UI

        UIElements.initialLoadingIndicator.classList.remove('hidden');
        UIElements.guidePlaceholder.classList.remove('hidden');

        if (config.m3uContent) {
            await handleGuideLoad(config.m3uContent, config.epgContent);
        } else {
            UIElements.initialLoadingIndicator.classList.add('hidden');
            UIElements.noDataMessage.classList.remove('hidden');
        }

        handleRouteChange();

        // NEW: Connect to the server for real-time events like notification updates.
        initializeSse();
        console.log('[MAIN] Server-Sent Events listener initialized.');

    } catch (e) {
        console.error('[MAIN] Application initialization failed:', e);
        showNotification("Initialization failed: " + e.message, true);
        UIElements.initialLoadingIndicator.classList.add('hidden');
        UIElements.noDataMessage.classList.remove('hidden'); // Ensure no data message is shown

    }
}

/**
 * Restores presentation preferences.
 */
/**
 * Restores the dimensions of resizable modals and the channel column from saved device settings.
 */
function restoreDimensions() {
    console.log('[MAIN] Restoring UI dimensions from device settings.');

    // 1. Player modal dimensions
    const playerDims = getDeviceSetting('playerDimensions', guideState.settings?.playerDimensions);
    if (playerDims && UIElements.videoModalContainer) {
        const { width, height } = playerDims;
        const maxWidth = Math.max(200, window.innerWidth - 16);
        const maxHeight = Math.max(150, window.innerHeight - 16);
        const safeWidth = Math.min(maxWidth, width);
        const safeHeight = Math.min(maxHeight, height);
        if (safeWidth) UIElements.videoModalContainer.style.width = `${safeWidth}px`;
        if (safeHeight) UIElements.videoModalContainer.style.height = `${safeHeight}px`;
        console.log(`[MAIN] Restored player dimensions for this device: ${safeWidth}x${safeHeight}`);
    }

    // 2. Program details modal dimensions
    const detailsDims = getDeviceSetting('programDetailsDimensions', guideState.settings?.programDetailsDimensions);
    if (detailsDims && UIElements.programDetailsContainer) {
        const { width, height } = detailsDims;
        const maxWidth = Math.max(200, window.innerWidth - 16);
        const maxHeight = Math.max(150, window.innerHeight - 16);
        const safeWidth = Math.min(maxWidth, width);
        const safeHeight = Math.min(maxHeight, height);
        if (safeWidth) UIElements.programDetailsContainer.style.width = `${safeWidth}px`;
        if (safeHeight) UIElements.programDetailsContainer.style.height = `${safeHeight}px`;
        console.log(`[MAIN] Restored program details dimensions for this device: ${safeWidth}x${safeHeight}`);
    }

    // 3. Channel column width
    const defaultChannelWidth = window.innerWidth < 768 ? 64 : 180;
    const channelWidth = getDeviceSetting('channelColumnWidth', guideState.settings?.channelColumnWidth || defaultChannelWidth);
    if (UIElements.guideGrid) {
        const safeWidth = Math.min(window.innerWidth - 80, Math.max(50, channelWidth));
        UIElements.guideGrid.style.setProperty('--channel-col-width', `${safeWidth}px`);
        if (guideState.settings) guideState.settings.channelColumnWidth = safeWidth;
        console.log(`[MAIN] Restored channel column width for this device: ${safeWidth}px`);
    }
}

/**
 * Sets up core application event listeners (navigation, modals, etc.).
 */
function setupCoreEventListeners() {
    console.log('[MAIN] Setting up core event listeners.');

    // --- Tab Navigation and Refresh Logic ---
    const setupTabListener = (tabElement, tabName, refreshFunction) => {
        if (!tabElement) return;
        tabElement.addEventListener('click', () => {
            if (tabElement.classList.contains('active')) {
                console.log(`[NAV] Refreshing ${tabName} tab data.`);
                if (refreshFunction) refreshFunction();
            } else {
                console.log(`[NAV] Switching to ${tabName} tab.`);
                switchTab(tabName);
            }
        });
    };

    // Desktop Tabs
    setupTabListener(UIElements.tabGuide, 'guide');
    setupTabListener(UIElements.tabMultiview, 'multiview', initMultiView);

     // NEW

    // Mobile Navigation
    UIElements.mobileMenuToggle?.addEventListener('click', openMobileMenu);
    UIElements.mobileMenuClose?.addEventListener('click', closeMobileMenu);
    UIElements.mobileMenuOverlay?.addEventListener('click', closeMobileMenu);

    UIElements.mobileNavGuide?.addEventListener('click', () => switchTab('guide'));
    UIElements.mobileNavMultiview?.addEventListener('click', () => switchTab('multiview'));

     // NEW

    // --- Browser and Document Listeners ---
    window.addEventListener('popstate', () => { console.log('[NAV] Popstate event (browser back/forward).'); handleRouteChange(); });

    // NEW: Refresh data when tab becomes visible again

    // --- Modal Listeners ---
    UIElements.confirmCancelBtn?.addEventListener('click', () => closeModal(UIElements.confirmModal));
    UIElements.confirmOkBtn?.addEventListener('click', handleConfirm);
    UIElements.detailsCloseBtn?.addEventListener('click', () => closeModal(UIElements.programDetailsModal));

    //-- ENHANCEMENT: Centralized Channel Selector Modal Listeners with Context Switching
    UIElements.multiviewChannelFilter?.addEventListener('change', () => populateChannelSelector());
    UIElements.channelSelectorSearch?.addEventListener('input', () => {
        clearTimeout(appState.searchDebounceTimer);
        appState.searchDebounceTimer = setTimeout(() => populateChannelSelector(), 250);
    });

    UIElements.channelSelectorList?.addEventListener('click', (e) => {
        const channelItem = e.target.closest('.channel-item');
        if (!channelItem) return;

        // Use a data attribute on the body to determine which function to call
        const context = document.body.dataset.channelSelectorContext;
        console.log(`[CHANNEL_SELECTOR] Click handled with context: ${context}`);

        handleMultiViewChannelClick(channelItem);

        // Clean up the context after use
        delete document.body.dataset.channelSelectorContext;
        closeModal(UIElements.multiviewChannelSelectorModal);
    });

    UIElements.channelSelectorCancelBtn?.addEventListener('click', () => {
        delete document.body.dataset.channelSelectorContext;
        closeModal(UIElements.multiviewChannelSelectorModal);
    });

    // --- Resizable Elements ---
    // --- Resizable Elements ---
    if (UIElements.videoResizeHandle && UIElements.videoModalContainer) {
        makeModalResizable(UIElements.videoResizeHandle, UIElements.videoModalContainer, 400, 300, 'playerDimensions', (newWidth) => {
            const isLocked = shouldMaintainAspectRatio();

            if (isLocked && UIElements.videoElement && UIElements.videoElement.videoWidth && UIElements.videoElement.videoHeight) {
                const videoRatio = UIElements.videoElement.videoWidth / UIElements.videoElement.videoHeight;

                if (!isFinite(videoRatio) || videoRatio === 0) return null;

                // Calculate header height to add to the total height
                const header = UIElements.videoModalContainer.querySelector('.flex.justify-between');
                const headerHeight = header ? header.offsetHeight : 0;

                // Calculate target height: (width / ratio) + headerHeight
                return (newWidth / videoRatio) + headerHeight;
            }
            return null;
        });
    }
    if (UIElements.detailsResizeHandle && UIElements.programDetailsContainer) {
        makeModalResizable(UIElements.detailsResizeHandle, UIElements.programDetailsContainer, 320, 250, 'programDetailsDimensions');
    }
    if (UIElements.channelColumnResizeHandle && UIElements.guideGrid && window.innerWidth >= 768) {
        makeColumnResizable(UIElements.channelColumnResizeHandle, UIElements.guideGrid, 100, 'channelColumnWidth', '--channel-col-width');
    }

    // --- Header Resize Observer ---
    if (UIElements.mainHeader && UIElements.unifiedGuideHeader) {
        const mainHeaderObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === UIElements.mainHeader) {
                    document.documentElement.style.setProperty('--main-header-height', `${entry.contentRect.height}px`);
                }
            }
        });
        mainHeaderObserver.observe(UIElements.mainHeader);
    }

    // monitor the processes of channel sources

}

// --- App Start ---
document.addEventListener('DOMContentLoaded', () => {
    navigator.serviceWorker?.getRegistration('/').then(registration => {
        if (registration?.active?.scriptURL === new URL('/sw.js', location.origin).href) registration.unregister();
    }).catch(() => {});
    initializeApplication();
});

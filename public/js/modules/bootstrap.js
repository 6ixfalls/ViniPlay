

import { UIElements, appState } from './state.js';
import { initMainApp } from '../main.js';

/**
 * Populates the UIElements object with references to DOM elements.
 * This is now called from showApp() to ensure the main container is visible.
 */
const initializeUIElements = () => {
    // Populate UIElements by querying all elements with an 'id' attribute
    // and converting their kebab-case IDs to camelCase keys.
    Object.assign(UIElements, Object.fromEntries(
        [...document.querySelectorAll('[id]')].map(el => [
            el.id.replace(/-(\w)/g, (match, letter) => letter.toUpperCase()),
            el
        ])
    ));

    // Add specific references that might not be picked up by generic ID mapping
    // or are critical and need direct assignment for clarity.
    UIElements.appContainer = document.getElementById('app-container');
    UIElements.mainHeader = document.getElementById('main-header');
    UIElements.unifiedGuideHeader = document.getElementById('unified-guide-header');
    UIElements.pageGuide = document.getElementById('page-guide');
    UIElements.guideDateDisplay = document.getElementById('guide-date-display');
    UIElements.stickyCorner = document.querySelector('.sticky-corner');
    UIElements.channelColumnResizeHandle = document.getElementById('channel-column-resize-handle');
    // NOTE: dvrSettingsSection is the entire settings div, not a separate element. Logic will handle visibility.

    // Program Details Modal and its Buttons
    UIElements.programDetailsModal = document.getElementById('program-details-modal');
    UIElements.programDetailsContainer = document.getElementById('program-details-container');
    UIElements.detailsResizeHandle = document.getElementById('details-resize-handle');

    // Mobile menu elements
    UIElements.mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    UIElements.mobileNavMenu = document.getElementById('mobile-nav-menu');
    UIElements.mobileMenuClose = document.getElementById('mobile-menu-close');
    UIElements.mobileNavGuide = document.getElementById('mobile-nav-guide');
    UIElements.mobileMenuOverlay = document.getElementById('mobile-menu-overlay');

    // Notification Tab/Page Elements
    UIElements.notificationModal = document.getElementById('notification-modal-wrapper');
    UIElements.notificationBox = document.getElementById('notification-box');
    UIElements.notificationMessage = document.getElementById('notification-message');

    // Multi-View Elements
    UIElements.pageMultiview = document.getElementById('page-multiview');
    UIElements.tabMultiview = document.getElementById('tab-multiview');
    UIElements.mobileNavMultiview = document.getElementById('mobile-nav-multiview');
    UIElements.multiviewHeader = document.getElementById('multiview-header');
    UIElements.multiviewContainer = document.getElementById('multiview-container');
    UIElements.multiviewAddPlayer = document.getElementById('multiview-add-player');
    UIElements.multiviewRemovePlayer = document.getElementById('multiview-remove-player');
    UIElements.layoutBtnAuto = document.getElementById('layout-btn-auto');
    UIElements.layoutBtn2x2 = document.getElementById('layout-btn-2x2');
    UIElements.layoutBtn1x3 = document.getElementById('layout-btn-1x3');
    UIElements.multiviewChannelSelectorModal = document.getElementById('multiview-channel-selector-modal');
    UIElements.channelSelectorList = document.getElementById('channel-selector-list');
    UIElements.channelSelectorSearch = document.getElementById('channel-selector-search');
    UIElements.channelSelectorCancelBtn = document.getElementById('channel-selector-cancel-btn');
    UIElements.multiviewSaveLayoutBtn = document.getElementById('multiview-save-layout-btn');
    UIElements.multiviewLoadLayoutBtn = document.getElementById('multiview-load-layout-btn');
    UIElements.multiviewDeleteLayoutBtn = document.getElementById('multiview-delete-layout-btn');
    UIElements.savedLayoutsSelect = document.getElementById('saved-layouts-select');
    UIElements.saveLayoutModal = document.getElementById('save-layout-modal');
    UIElements.saveLayoutForm = document.getElementById('save-layout-form');
    UIElements.saveLayoutName = document.getElementById('save-layout-name');
    UIElements.saveLayoutCancelBtn = document.getElementById('save-layout-cancel-btn');
    UIElements.multiviewChannelFilter = document.getElementById('multiview-channel-filter');
    // NEW: Multi-view custom URL elements

    // NEW: Player Page Elements

    // Video Player Modal Elements
    UIElements.videoModal = document.getElementById('video-modal');
    UIElements.videoModalContainer = document.getElementById('video-modal-container');
    UIElements.videoResizeHandle = document.getElementById('video-resize-handle');
    UIElements.videoElement = document.getElementById('videoElement');
    UIElements.audioElement = document.getElementById('audioElement');
    UIElements.videoTitle = document.getElementById('video-title');
    UIElements.closeModalBtn = document.getElementById('close-modal');

    // --- Resume Playback Modal Elements ---
};

export function initializeApplication() {
    document.getElementById('startup-container').classList.add('hidden');
    const container = document.getElementById('app-container');
    container.classList.remove('hidden');
    container.classList.add('flex');
    initializeUIElements();
    initMainApp();
    appState.appInitialized = true;
}

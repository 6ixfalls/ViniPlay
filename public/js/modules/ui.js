/**
 * ui.js
 * * Contains functions for managing the user interface.
 * This includes navigation, modals, notifications, and other DOM manipulations.
 */

import { UIElements, appState, guideState } from './state.js';

import { initMultiView, isMultiViewActive, cleanupMultiView } from './multiview.js';

import { stopAndCleanupPlayer } from './player.js';

import { finalizeGuideLoad, handleGuideLoad } from './guide.js';
import { fetchConfig, savePreference, saveDeviceSetting } from './api.js';

let confirmCallback = null;
let currentPage = '/';
let activeModalCloseListener = null;
let isResizing = false;
// FINAL FIX: Flag to temporarily block config reloads after a setting is saved.

// NEW: Exported variable to track if processing is running

/**
 * Shows a notification message at the top-right of the screen.
 * @param {string} message - The message to display.
 * @param {boolean} isError - If true, displays a red error notification.
 * @param {number} duration - How long the notification should be visible in ms.
 */
export const showNotification = (message, isError = false, duration = 3000) => {
    if (!UIElements.notificationBox || !UIElements.notificationMessage || !UIElements.notificationModal) {
        console.error('[UI_NOTIF] Notification elements not found in UIElements. Cannot display notification.');
        console.log('[UI_NOTIF] Message attempted: ', message);
        return;
    }

    UIElements.notificationMessage.textContent = message;

    UIElements.notificationBox.classList.remove('success-bg', 'error-bg');
    UIElements.notificationBox.classList.add(isError ? 'error-bg' : 'success-bg');

    UIElements.notificationModal.classList.remove('hidden');

    setTimeout(() => { UIElements.notificationModal.classList.add('hidden'); }, duration);
};

/**
 * Displays a modal.
 * @param {HTMLElement} modal - The modal element to show.
 */
export const openModal = (modal) => {
    modal.classList.replace('hidden', 'flex');
    document.body.classList.add('modal-open');

    const handleBackdropClick = (e) => {
        if (e.target === modal) {
            // If the player is locked or in PiP, ignore taps/clicks on backdrop to prevent closing
            if (modal.classList.contains('player-locked') || modal.classList.contains('pip-active') || document.pictureInPictureElement) {
                return;
            }

            const startTouch = e.touches ? e.touches[0] : null;
            const startX = startTouch ? startTouch.clientX : e.clientX;
            const startY = startTouch ? startTouch.clientY : e.clientY;
            const startTime = Date.now();

            // Bottom 36px exclusion zone: home gesture swipe area on modern iOS / Android
            if (startY > window.innerHeight - 36) {

                return;
            }

            const handleRelease = (upEvent) => {
                const touch = upEvent.changedTouches ? upEvent.changedTouches[0] : null;
                const endX = touch ? touch.clientX : upEvent.clientX;
                const endY = touch ? touch.clientY : upEvent.clientY;
                const duration = Date.now() - startTime;
                const distance = Math.hypot(endX - startX, endY - startY);

                // Ignore if it was a drag, swipe, or long press (>10px movement or >400ms duration)
                if (distance > 10 || duration > 400) {

                    cleanupListeners();
                    return;
                }

                const target = upEvent.target || (touch ? document.elementFromPoint(touch.clientX, touch.clientY) : null);
                if ((target === modal || upEvent.target === modal) && !isResizing) {
                    if (modal.classList.contains('player-locked')) {
                        cleanupListeners();
                        return;
                    }

                    if (modal === UIElements.videoModal || modal.id === 'video-modal') {
                        stopAndCleanupPlayer();
                    } else {
                        closeModal(modal);
                    }
                }
                cleanupListeners();
            };

            const cleanupListeners = () => {
                document.removeEventListener('mouseup', handleRelease);
                document.removeEventListener('touchend', handleRelease);
                document.removeEventListener('touchcancel', cleanupListeners);
            };

            document.addEventListener('mouseup', handleRelease, { once: true });
            document.addEventListener('touchend', handleRelease, { once: true });
            document.addEventListener('touchcancel', cleanupListeners, { once: true });
        }
    };

    if (activeModalCloseListener && activeModalCloseListener.element) {
        activeModalCloseListener.element.removeEventListener('mousedown', activeModalCloseListener.handler);
        activeModalCloseListener.element.removeEventListener('touchstart', activeModalCloseListener.handler);
    }

    modal.addEventListener('mousedown', handleBackdropClick);
    modal.addEventListener('touchstart', handleBackdropClick, { passive: true });
    activeModalCloseListener = { element: modal, handler: handleBackdropClick };
};

/**
 * Hides a modal.
 * @param {HTMLElement} modal - The modal element to hide.
 */
export const closeModal = (modal) => {
    modal.classList.replace('flex', 'hidden');

    if (activeModalCloseListener && activeModalCloseListener.element === modal) {
        activeModalCloseListener.element.removeEventListener('mousedown', activeModalCloseListener.handler);
        activeModalCloseListener.element.removeEventListener('touchstart', activeModalCloseListener.handler);
        activeModalCloseListener = null;
    }

    if (!document.querySelector('.fixed.inset-0.flex')) {
        document.body.classList.remove('modal-open');
    }
};

/**
 * Shows a confirmation dialog.
 * @param {string} title - The title of the confirmation dialog.
 * @param {string} message - The message body of the dialog.
 * @param {Function} callback - The function to execute if the user confirms.
 */
export const showConfirm = (title, message, callback) => {
    UIElements.confirmTitle.textContent = title;
    UIElements.confirmMessage.innerHTML = message;
    confirmCallback = callback;
    openModal(UIElements.confirmModal);
};

/**
 * NEW: Displays a site-wide broadcast message banner at the top of the page.
 * @param {string} message - The message to display.
 */

export function handleConfirm() {
    if (confirmCallback) {
        confirmCallback();
    }
    closeModal(UIElements.confirmModal);
}

/**
 * Shows the Resume Playback modal dialog.
 * @param {object} options
 * @param {string} options.title - The title of the program / movie / episode.
 * @param {number} options.progressSeconds - Stored progress timestamp in seconds.
 * @param {number} [options.durationSeconds=0] - Total duration in seconds (if known).
 * @param {Function} options.onResume - Callback when user chooses to resume.
 * @param {Function} options.onStartOver - Callback when user chooses to start over from 0.
 * @param {Function} [options.onCancel] - Optional callback when user cancels without playing.
 */

/**
 * Sets the loading state of a button, showing a spinner.
 * @param {HTMLElement} buttonEl - The button element.
 * @param {boolean} isLoading - True to show loading state, false to restore.
 * @param {string} originalContent - The original HTML content of the button.
 */
export const setButtonLoadingState = (buttonEl, isLoading, originalContent) => {
    if (!buttonEl) return;
    buttonEl.disabled = isLoading;
    const btnContentEl = buttonEl.querySelector('span');
    if (btnContentEl) {
        btnContentEl.innerHTML = isLoading ?
            `<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Loading...</span>` :
            originalContent;
    }
};

/**
 * Makes a modal window resizable by dragging a handle.
 */
export const makeModalResizable = (handleEl, containerEl, minWidth, minHeight, settingKey, ratioCallback = null) => {
    if (!handleEl || !containerEl) return;

    let resizeDebounceTimer;

    const startResize = (clientX, clientY) => {
        isResizing = true;
        const startX = clientX;
        const startY = clientY;
        const startWidth = containerEl.offsetWidth;
        const startHeight = containerEl.offsetHeight;

        // Ensure inline maxWidth/maxHeight do not artificially constrain resizing
        containerEl.style.maxWidth = '98vw';
        containerEl.style.maxHeight = '95vh';
        document.body.style.userSelect = 'none';

        // Temporarily disable pointer events on media/iframes so dragging is responsive
        const nestedMedia = containerEl.querySelectorAll('video, iframe');
        nestedMedia.forEach(el => el.style.pointerEvents = 'none');

        const doResize = (moveEvent) => {
            // Handle both mouse and touch events for coordinates
            const currentX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const currentY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;

            const isMobile = window.innerWidth < 768;
            const effectiveMinWidth = isMobile ? Math.min(minWidth, Math.max(200, window.innerWidth - 32)) : minWidth;
            const effectiveMinHeight = isMobile ? Math.min(minHeight, Math.max(150, window.innerHeight - 32)) : minHeight;
            const maxAllowedWidth = Math.max(effectiveMinWidth, window.innerWidth - 16);
            const maxAllowedHeight = Math.max(effectiveMinHeight, window.innerHeight - 16);

            let newWidth = Math.min(maxAllowedWidth, Math.max(isMobile ? 200 : effectiveMinWidth, startWidth + currentX - startX));
            let newHeight = Math.min(maxAllowedHeight, Math.max(isMobile ? 150 : effectiveMinHeight, startHeight + currentY - startY));

            // Apply aspect ratio if callback is provided
            if (ratioCallback) {
                const calculatedHeight = ratioCallback(newWidth);
                if (calculatedHeight) {
                    newHeight = Math.min(maxAllowedHeight, calculatedHeight);
                }
            }

            containerEl.style.width = `${newWidth}px`;
            containerEl.style.height = `${newHeight}px`;
        };

        const stopResize = () => {
            window.removeEventListener('mousemove', doResize);
            window.removeEventListener('mouseup', stopResize);
            window.removeEventListener('touchmove', doResize);
            window.removeEventListener('touchend', stopResize);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            nestedMedia.forEach(el => el.style.pointerEvents = '');

            isResizing = false;

            if (settingKey) {
                clearTimeout(resizeDebounceTimer);
                resizeDebounceTimer = setTimeout(() => {
                    saveDeviceSetting(settingKey, {
                        width: containerEl.offsetWidth,
                        height: containerEl.offsetHeight,
                    });
                }, 500);
            }
        };

        document.body.style.cursor = 'se-resize';
        window.addEventListener('mousemove', doResize);
        window.addEventListener('mouseup', stopResize);
        window.addEventListener('touchmove', doResize, { passive: false });
        window.addEventListener('touchend', stopResize);
    };

    handleEl.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
        startResize(e.clientX, e.clientY);
    }, false);

    handleEl.addEventListener('touchstart', e => {
        e.preventDefault(); // Prevent scrolling while resizing
        e.stopPropagation();
        startResize(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
};

/**
 * Makes a column resizable horizontally by dragging a handle.
 */
export const makeColumnResizable = (handleEl, targetEl, minWidth, settingKey, cssVarName) => {
    Promise.all([
        import('./api.js'),
        import('./guide.js')
    ]).then(([{ saveDeviceSetting }, { updateNowLinePosition }]) => {
        let resizeDebounceTimer;
        let startWidth;
        let startX;

        if (!targetEl) {
            console.error('makeColumnResizable: targetEl is null. Cannot apply resize logic.');
            return;
        }

        const startResize = (clientX) => {
            isResizing = true;
            startX = clientX;
            startWidth = parseInt(getComputedStyle(targetEl).getPropertyValue(cssVarName)) || minWidth;

            const doResize = (moveEvent) => {
                const currentX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
                const newWidth = startWidth + (currentX - startX);
                const finalWidth = Math.max(minWidth, newWidth);
                targetEl.style.setProperty(cssVarName, `${finalWidth}px`);

                // CRITICAL: Update guideState immediately and recalculate NOW line position
                guideState.settings.channelColumnWidth = finalWidth;
                updateNowLinePosition();
            };

            const stopResize = () => {
                window.removeEventListener('mousemove', doResize);
                window.removeEventListener('mouseup', stopResize);
                window.removeEventListener('touchmove', doResize);
                window.removeEventListener('touchend', stopResize);
                document.body.style.cursor = '';
                isResizing = false;

                clearTimeout(resizeDebounceTimer);
                resizeDebounceTimer = setTimeout(() => {
                    const currentWidth = parseInt(getComputedStyle(targetEl).getPropertyValue(cssVarName));
                    saveDeviceSetting(settingKey, currentWidth);
                }, 500);
            };

            document.body.style.cursor = 'ew-resize';
            window.addEventListener('mousemove', doResize);
            window.addEventListener('mouseup', stopResize);
            window.addEventListener('touchmove', doResize, { passive: false });
            window.addEventListener('touchend', stopResize);
        };

        handleEl.addEventListener('mousedown', e => {
            e.preventDefault();
            startResize(e.clientX);
        }, false);

        handleEl.addEventListener('touchstart', e => {
            e.preventDefault();
            startResize(e.touches[0].clientX);
        }, { passive: false });
    });
};

/**
 * Opens the mobile navigation menu.
 */
export const openMobileMenu = () => {
    if (UIElements.mobileNavMenu) {
        UIElements.mobileNavMenu.classList.remove('hidden');
        UIElements.mobileNavMenu.classList.remove('-translate-x-full');
        UIElements.mobileNavMenu.classList.add('translate-x-0');
    }
    if (UIElements.mobileMenuOverlay) {
        UIElements.mobileMenuOverlay.classList.remove('hidden');
    }
    document.body.classList.add('overflow-hidden');
};

/**
 * Closes the mobile navigation menu.
 */
export const closeMobileMenu = () => {
    if (UIElements.mobileNavMenu) {
        UIElements.mobileNavMenu.classList.add('-translate-x-full');
        UIElements.mobileNavMenu.classList.remove('translate-x-0');
        UIElements.mobileNavMenu.addEventListener('transitionend', function handler() {
            UIElements.mobileNavMenu.classList.add('hidden');
            UIElements.mobileNavMenu.removeEventListener('transitionend', handler);
        });
    }
    if (UIElements.mobileMenuOverlay) {
        UIElements.mobileMenuOverlay.classList.add('hidden');
    }
    document.body.classList.remove('overflow-hidden');
};

// FINAL FIX: This function will be called whenever a setting is saved.
/**
 * Temporarily blocks the automatic config reload that happens on navigation.
 * This prevents the UI from overwriting a user's new setting with old data from the server.
 */

/**
 * Handles client-side routing by showing/hiding pages.
 */
export const handleRouteChange = () => {
    let path = window.location.pathname;
    if (!['/', '/tvguide', '/multiview'].includes(path)) {
        path = '/tvguide';
        window.history.replaceState({}, '', path);
    }
    if (currentPage.startsWith('/multiview') && path !== '/multiview') cleanupMultiView();
    proceedWithRouteChange(path);
};
async function proceedWithRouteChange(path) {
    const isGuide = path !== '/multiview';
    closeMobileMenu();
    UIElements.tabGuide?.classList.toggle('active', isGuide);
    UIElements.mobileNavGuide?.classList.toggle('active', isGuide);
    UIElements.tabMultiview?.classList.toggle('active', !isGuide);
    UIElements.mobileNavMultiview?.classList.toggle('active', !isGuide);
    UIElements.pageGuide.classList.toggle('hidden', !isGuide);
    UIElements.pageGuide.classList.toggle('flex', isGuide);
    UIElements.pageMultiview.classList.toggle('hidden', isGuide);
    UIElements.pageMultiview.classList.toggle('flex', !isGuide);
    if (isGuide) {
        const config = await fetchConfig();
        if (config) {
            Object.assign(guideState.settings, config.settings);
            await handleGuideLoad(config.m3uContent, config.epgContent);
        }
    } else initMultiView();
    currentPage = path;
}

export const navigate = (path) => {
    if (window.location.pathname !== path) {
        window.history.pushState({}, path, window.location.origin + path);
    }
    handleRouteChange();
};

/**
 * Switches between the tabs.
 * @param {string} activeTab - The tab to switch to.
 */
export const switchTab = tab => navigate(tab === 'multiview' ? '/multiview' : '/tvguide');

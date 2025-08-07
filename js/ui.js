// ui.js - Fixed user interface controls and indicators with improved event handling

// Initialize UI elements
function initUI() {
    // Remove or repurpose old quality buttons if they are redundant with settings panel
    const qualityLowBtn = document.getElementById('qualityLow');
    const qualityHighBtn = document.getElementById('qualityHigh');

    // If keeping these buttons, make them use the new preset system
    if (qualityLowBtn && typeof window.applyPixelRatioPreset === 'function') {
        EventManager.addListener('ui', qualityLowBtn, 'click', (e) => {
            e.preventDefault(); e.stopPropagation();
            window.applyPixelRatioPreset('MEDIUM'); // Example: Low button maps to Medium preset
        });
    } else if (qualityLowBtn) {
        qualityLowBtn.style.display = 'none'; // Hide if system not ready or button unused
        console.warn("Quality Low button present but applyPixelRatioPreset not found.");
    }

     if (qualityHighBtn && typeof window.applyPixelRatioPreset === 'function') {
        EventManager.addListener('ui', qualityHighBtn, 'click', (e) => {
             e.preventDefault(); e.stopPropagation();
            window.applyPixelRatioPreset('FULL'); // Example: High button maps to Full preset
        });
    } else if (qualityHighBtn) {
        qualityHighBtn.style.display = 'none'; // Hide if system not ready or button unused
        console.warn("Quality High button present but applyPixelRatioPreset not found.");
    }


    // Panel toggle buttons
    const settingsToggle = document.getElementById('toggleSettings');
    const infoToggle = document.getElementById('toggleInfo');
    const joystickToggle = document.getElementById('toggleJoystick');
    const fullscreenToggle = document.getElementById('toggleFullscreen');

    if (settingsToggle) {
        EventManager.addListener('ui', settingsToggle, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePanel('settingsPanel', 'toggleSettings');
        });
    }

    if (infoToggle) {
        EventManager.addListener('ui', infoToggle, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePanel('infoPanel', 'toggleInfo');
        });
    }

    // Ensure joystick toggle button correctly updates active state if joystick is toggled elsewhere (e.g., 'J' key)
    if (joystickToggle) {
        EventManager.addListener('ui', joystickToggle, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof toggleJoystick === 'function') {
                toggleJoystick(); // toggleJoystick should handle its own state/UI update
                 // Update button active state based on joystick visibility
                 joystickToggle.classList.toggle('active', window.joystickVisible);
            } else {
                console.warn('toggleJoystick function not found.');
            }
        });
         // Update button state initially and on resize/load if needed
         // We might need a listener or callback from joystick.js if its state changes externally
         joystickToggle.classList.toggle('active', window.joystickVisible); // Initial state check
    }

    if (fullscreenToggle) {
        EventManager.addListener('ui', fullscreenToggle, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFullscreen(); // toggleFullscreen handles its own UI update via listener
        });
    }

    // Panel close buttons (Ensure settings panel close button is handled in manual-lod.js if added there)
    document.querySelectorAll('.panel .panel-close').forEach(button => {
        // Check if this button belongs to a panel managed here (e.g., infoPanel)
        const panel = button.closest('.panel');
        if (panel && panel.id !== 'settingsPanel') { // Exclude settings panel if its close button is managed elsewhere
             EventManager.addListener('ui', button, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                 // Find the panel this button belongs to and close it
                 if (panel) {
                     panel.classList.remove('active');
                     // Deactivate corresponding toggle button
                     const toggleButtonId = panel.id.replace('Panel', ''); // e.g., infoPanel -> info
                     const toggleButton = document.getElementById(`toggle${toggleButtonId.charAt(0).toUpperCase() + toggleButtonId.slice(1)}`); // e.g., toggleInfo
                     if (toggleButton) {
                         toggleButton.classList.remove('active');
                     }
                 }
                 // Using closeAllPanels might be simpler if that's the desired behavior
                 // closeAllPanels();
            });
        }
    });

    // Adding touchstart event for mobile (keep this)
    addTouchEvents();

    // Setup fullscreen change event listener (keep this)
    setupFullscreenChangeListener();
}

// Apply current pixel ratio setting - *REMOVED* (Functionality moved into setPixelRatio)
// function applyPixelRatio() { ... }

// Add touchstart events for all interactive elements (keep this)
function addTouchEvents() {
    const allButtons = document.querySelectorAll('.action-button, .panel-close, .button-group button');

    allButtons.forEach(button => {
         if (!button._touchHandlerAttached) { // Prevent adding listener multiple times
             const handler = function(e) {
                e.preventDefault();
                this.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                setTimeout(() => {
                    this.style.backgroundColor = '';
                }, 150);
                // Use a small delay to ensure visual feedback before click simulation
                 setTimeout(() => this.click(), 50);
            };
            EventManager.addListener('ui', button, 'touchstart', handler, { passive: false });
            button._touchHandlerAttached = true; // Mark as attached
         }
    });
}

// Toggle fullscreen mode (keep this)
function toggleFullscreen() {
    if (!document.fullscreenElement &&
        !document.mozFullScreenElement &&
        !document.webkitFullscreenElement &&
        !document.msFullscreenElement) {
        // Enter fullscreen
        const docEl = document.documentElement;
        const requestMethod = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
        if (requestMethod) {
            requestMethod.call(docEl).catch(err => console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`));
        } else {
            console.error("Fullscreen API is not supported.");
        }
    } else {
        // Exit fullscreen
        const exitMethod = document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen || document.msExitFullscreen;
         if (exitMethod) {
             exitMethod.call(document).catch(err => console.error(`Error attempting to disable full-screen mode: ${err.message} (${err.name})`));
         } else {
              console.error("Fullscreen API is not supported (for exiting).");
         }
    }
}

// Setup listener for fullscreen change (keep this)
function setupFullscreenChangeListener() {
    const fullscreenChangeHandler = () => updateFullscreenButton();
    const fullscreenEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    fullscreenEvents.forEach(eventName => {
        // Ensure listener isn't added multiple times if initUI runs again
        EventManager.removeCategory(`fullscreen-${eventName}`); // Remove previous listeners for this specific event
        EventManager.addListener(`fullscreen-${eventName}`, document, eventName, fullscreenChangeHandler); // Add with specific category
    });
     // Initial check in case page loads in fullscreen
     updateFullscreenButton();
}

// Update fullscreen button appearance (keep this)
function updateFullscreenButton() {
    const fullscreenBtn = document.getElementById('toggleFullscreen');
    const isFullscreen = !!(document.fullscreenElement ||
                         document.webkitFullscreenElement ||
                         document.mozFullScreenElement ||
                         document.msFullscreenElement);

    if (fullscreenBtn) {
        const icon = fullscreenBtn.querySelector('i');
        if (icon) {
            icon.className = isFullscreen ? 'fas fa-compress' : 'fas fa-expand';
        }
        fullscreenBtn.classList.toggle('active', isFullscreen);
    }

    // Resizing engine should happen on window resize, but a small delay here can help catch edge cases
    setTimeout(() => {
        if (window.engine) {
            window.engine.resize();
        }
         // Update joystick dimensions if fullscreen changes layout significantly
         if (typeof updateJoystickDimensions === 'function' && window.joystickVisible) {
             updateJoystickDimensions();
         }
    }, 150); // Increased delay slightly
}

// Set rendering pixel ratio - CENTRALIZED FUNCTION
function setPixelRatio(ratio) {
    // Ensure ratio is a valid number and within reasonable bounds (e.g., 0.1 to 1.0 or higher if super-sampling)
    const minRatio = 0.1;
    const maxRatio = 1.5; // Allow slight super-sampling if needed, but 1.0 is typical max
    if (typeof ratio !== 'number' || ratio < minRatio || ratio > maxRatio) {
        console.warn(`Invalid pixel ratio value received: ${ratio}. Clamping or using default.`);
        // Clamp or default logic:
        const defaultRatio = (CONFIG?.SCENE?.DEFAULT_PIXEL_RATIO) ?? 0.5;
        ratio = Math.max(minRatio, Math.min(maxRatio, ratio)); // Clamp the invalid value
        // Alternatively, force default: ratio = defaultRatio;
        console.warn(`Using clamped ratio: ${ratio}`);
    }

    // Only proceed if the ratio actually needs changing (performance)
    if (Math.abs(window.currentPixelRatio - ratio) < 0.01) {
        // console.log(`Pixel ratio already ${ratio}, no change needed.`);
        return; // Avoid redundant updates
    }

    // Store the ratio in the global scope - THIS IS THE SOURCE OF TRUTH
    window.currentPixelRatio = ratio;

    // Only update if the engine exists
    if (window.engine) {
        // Calculate and apply the hardware scaling level
        const scalingLevel = 1.0 / window.currentPixelRatio;
        engine.setHardwareScalingLevel(scalingLevel);

        if (CONFIG?.DEBUG?.ENABLE_LOGGING ?? false) { // Check config exists
             console.log(`Pixel ratio set to: ${window.currentPixelRatio.toFixed(2)} (Engine Scaling: ${scalingLevel.toFixed(2)})`);
        }
    } else {
        console.warn("Engine not available, pixel ratio set globally but not applied to engine yet.");
    }

    // Ensure the UI buttons (in settings panel) reflect this change
    // Need to ensure updateButtonActiveStates exists and is callable
    if (typeof window.updateButtonActiveStates === 'function') {
        window.updateButtonActiveStates();
    } else {
        // This might happen if ui.js loads before manual-lod.js defines the function
        // console.warn("updateButtonActiveStates function not found when setting pixel ratio.");
    }

     // Update performance indicator immediately if it exists
     if (typeof window.updatePerformanceIndicator === 'function') {
         window.updatePerformanceIndicator();
     }
}

// Close all panels and popups
function closeAllPanels() {
    // Close UI panels
    document.querySelectorAll('.panel.active').forEach(panel => {
        panel.classList.remove('active');
    });

    // Deactivate corresponding action buttons, except fullscreen if active
    document.querySelectorAll('.action-button.active').forEach(button => {
        const isFullscreenActive = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        if (button.id !== 'toggleFullscreen' || !isFullscreenActive) {
            button.classList.remove('active');
        }
    });

    // Hide the art info popup menu
    if (typeof hidePopup === 'function') {
        hidePopup();
    } else if (window.hidePopup) { // Fallback check
        window.hidePopup();
    } else {
        console.warn("hidePopup function not available to closeAllPanels.");
    }
}

// Toggle specific panel visibility
function togglePanel(panelId, buttonId) {
    const panel = document.getElementById(panelId);
    const button = document.getElementById(buttonId);

    if (!panel || !button) {
        console.warn(`TogglePanel: Panel ('${panelId}') or Button ('${buttonId}') not found.`);
        return;
    }

    const isActive = panel.classList.contains('active');

    // Always close all panels first for simpler logic (unless multi-panel view is desired)
    closeAllPanels();

    // If the clicked panel wasn't active before, open it now
    if (!isActive) {
        panel.classList.add('active');
        button.classList.add('active');
    }
    // If it *was* active, closeAllPanels already handled closing it.
}

// Show loading indicator (keep this)
function showLoadingIndicator(message) {
    const displayMessage = message || (CONFIG?.LOADING?.DEFAULT_MESSAGE) || "Loading...";
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (!loadingIndicator) return;
    const loadingText = loadingIndicator.querySelector('.loading-text');
    if (loadingText) loadingText.textContent = displayMessage;
    loadingIndicator.style.display = 'flex';
    loadingIndicator.setAttribute('aria-hidden', 'false');
}

// Hide loading indicator (keep this)
function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
        loadingIndicator.setAttribute('aria-hidden', 'true');
    }
}

// Show error message to user (keep this)
function showError(message) {
    console.error("Application Error:", message); // Log detailed error to console
    alert(`Error: ${message}`); // Show simple alert to user
    hideLoadingIndicator(); // Ensure loading is hidden if error occurs during load
}

// Update collider status display (keep this)
function updateColliderStatus(loaded) {
    const statusContainer = document.querySelector('#infoPanel .status-container');
    if (!statusContainer) return;

    const indicator = statusContainer.querySelector('.status-indicator');
    const statusText = statusContainer.querySelector('#colliderStatus');
    if (!indicator || !statusText) return;

    indicator.classList.remove('status-good', 'status-warning');
    if (loaded) {
        indicator.classList.add('status-good');
        statusText.textContent = "Collider Active";
    } else {
        indicator.classList.add('status-warning');
        statusText.textContent = window.currentSplatMesh ? "Basic Collision" : "No Collider";
    }
}

// Expose necessary functions globally
window.setPixelRatio = setPixelRatio; // Central function for changing resolution
window.toggleFullscreen = toggleFullscreen;
window.closeAllPanels = closeAllPanels;
window.showLoadingIndicator = showLoadingIndicator;
window.hideLoadingIndicator = hideLoadingIndicator;
window.showError = showError;
window.updateColliderStatus = updateColliderStatus;

// Expose for manual-lod.js to call
// window.updateButtonActiveStates needs to be defined in manual-lod.js and attached to window there.
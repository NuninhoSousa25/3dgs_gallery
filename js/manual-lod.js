// manual-lod.js - Enhanced with Dynamic Resolution Scaling (DRS)

// Pixel ratio presets
const PIXEL_RATIO_PRESETS = {
    FULL: { pixelRatio: 1.0, label: "Full (100%)" },
    HIGH: { pixelRatio: 0.75, label: "High (75%)" },
    MEDIUM: { pixelRatio: 0.5, label: "Medium (50%)" },
    LOW: { pixelRatio: 0.35, label: "Low (35%)" }
};

// --- Dynamic Resolution State Variables ---
let isDynamicResolutionActive = false;
let currentPixelRatioPreset = null; // Track which MANUAL preset is active ('FULL', 'HIGH', etc.) or null if dynamic
let drsFrameCounter = 0;
const DRS_CHECK_INTERVAL = 5; // Only check every 5 frames


// --- Dynamic Resolution Configuration ---
let dynamicHighPixelRatio = PIXEL_RATIO_PRESETS.HIGH.pixelRatio; // Default high target (can be overridden in initWithDefaults)
let dynamicLowPixelRatio = PIXEL_RATIO_PRESETS.MEDIUM.pixelRatio; // Default low target (can be overridden)
const movementDetectionThresholdPosSq = 0.0005; // Squared distance threshold for position change (adjust sensitivity)
const movementDetectionThresholdRotDot = 0.99995; // Dot product threshold for rotation change (closer to 1 means less change allowed before detecting movement)
const timeUntilResolutionIncrease = 750; // Milliseconds of inactivity before increasing resolution
const joystickMovementThreshold = 0.1; // How much joystick deflection counts as moving

// --- Internal State ---
let movementTimeoutId = null; // Timer for increasing resolution after stopping
let lastCameraPosition = null; // Stores BABYLON.Vector3
let lastCameraRotationQ = null; // Stores BABYLON.Quaternion
let isConsideredMoving = false; // Tracks if the system currently thinks the camera is moving (used for timer logic)
let sceneBeforeRenderObserver = null; // Reference to the Babylon observer
let performanceIndicatorIntervalId = null; // Reference to the FPS update interval

// Initialize the combined manual/dynamic system
function initManualLOD() {
    // Make sure required functions are available
     if (typeof window.setPixelRatio !== 'function') {
         console.error("Manual LOD Error: window.setPixelRatio is required but not found. Ensure ui.js is loaded first.");
         return;
     }

    updateSettingsPanelUI(); // Create/update the UI controls in the settings panel
    initDynamicResolutionSystem(); // Setup observers/listeners for DRS logic
    addPerformanceIndicator(); // Add FPS/Resolution display

    console.log("Resolution control system initialized (Manual + Dynamic).");
}

// Create/Update the resolution controls in the settings panel
function updateSettingsPanelUI() {
    const settingsPanel = document.getElementById('settingsPanel');
    if (!settingsPanel) {
        console.warn("Settings panel not found, cannot add resolution controls.");
        return;
    }

    // Clear previous controls if re-initializing (optional)
    const existingSection = settingsPanel.querySelector('.resolution-settings-section');
    if (existingSection) existingSection.remove();

    // --- Create Resolution Section ---
    const resolutionSection = document.createElement('div');
    resolutionSection.className = 'settings-section resolution-settings-section'; // Add specific class
    resolutionSection.innerHTML = `
        <h3><i class="fas fa-tv"></i> Resolution</h3>
        <div class="button-group resolution-group">
            <button id="pixelRatioDynamic" title="Automatically lower resolution during movement for smoother performance.">Dynamic</button>
            <button id="pixelRatioFull" title="Render at full screen resolution (Best quality, highest performance cost).">${PIXEL_RATIO_PRESETS.FULL.label}</button>
            <button id="pixelRatioHigh" title="Render at 75% resolution (Good balance of quality and performance).">${PIXEL_RATIO_PRESETS.HIGH.label}</button>
            <button id="pixelRatioMedium" title="Render at 50% resolution (Better performance, noticeable quality reduction).">${PIXEL_RATIO_PRESETS.MEDIUM.label}</button>
            <button id="pixelRatioLow" title="Render at 35% resolution (Highest performance, lowest visual quality).">${PIXEL_RATIO_PRESETS.LOW.label}</button>
        </div>
        <div class="settings-tooltip">
            <i class="fas fa-info-circle"></i> Adjust clarity vs performance. Dynamic mode adapts automatically.
        </div>
    `;
    settingsPanel.appendChild(resolutionSection);

    // --- Add Close Button if not already present ---
    if (!settingsPanel.querySelector('.panel-close')) {
        const closeButton = document.createElement('button');
        closeButton.className = 'panel-close';
        closeButton.setAttribute('aria-label', 'Close settings');
        closeButton.innerHTML = '<i class="fas fa-times"></i>';
        EventManager.addListener('ui', closeButton, 'click', (e) => {
            e.preventDefault(); e.stopPropagation();
             settingsPanel.classList.remove('active');
            const toggleButton = document.getElementById('toggleSettings');
            if (toggleButton) toggleButton.classList.remove('active');
        });
        settingsPanel.prepend(closeButton); // Add to the top
    }


    // --- Add Event Listeners ---
    EventManager.addListener('ui', document.getElementById('pixelRatioDynamic'), 'click', activateDynamicResolution);
    EventManager.addListener('ui', document.getElementById('pixelRatioFull'), 'click', () => applyPixelRatioPreset('FULL'));
    EventManager.addListener('ui', document.getElementById('pixelRatioHigh'), 'click', () => applyPixelRatioPreset('HIGH'));
    EventManager.addListener('ui', document.getElementById('pixelRatioMedium'), 'click', () => applyPixelRatioPreset('MEDIUM'));
    EventManager.addListener('ui', document.getElementById('pixelRatioLow'), 'click', () => applyPixelRatioPreset('LOW'));

    updateButtonActiveStates(); // Reflect the current state immediately
}

// Apply a MANUAL pixel ratio preset
function applyPixelRatioPreset(presetName) {
    if (!PIXEL_RATIO_PRESETS[presetName]) {
        console.error(`Invalid pixel ratio preset: ${presetName}`);
        return;
    }

    // Deactivate dynamic mode FIRST (this also logs state change if needed)
    deactivateDynamicResolution();

    const preset = PIXEL_RATIO_PRESETS[presetName];
    currentPixelRatioPreset = presetName; // Track the *manual* preset name

    // Use the central function to apply the change
    window.setPixelRatio(preset.pixelRatio);

    console.log(`Applied MANUAL pixel ratio preset: ${presetName} (${preset.pixelRatio * 100}%)`);
    // Note: setPixelRatio calls updateButtonActiveStates indirectly
}

// Activate Dynamic Resolution Mode
function activateDynamicResolution() {
    if (isDynamicResolutionActive) return; // Already active

    // --- State Change ---
    isDynamicResolutionActive = true;
    currentPixelRatioPreset = null; // No manual preset is active

    console.log(`%cDRS Activated%c (Low: ${dynamicLowPixelRatio * 100}%, High: ${dynamicHighPixelRatio * 100}%)`, "color: #e89f17; font-weight: bold;", "color: default;");

    // Immediately set resolution based on current movement state
    const currentlyMoving = hasCameraMoved(true); // Pass true to force immediate check without updating last state

    // --- State Change & Logging ---
    if (currentlyMoving && !isConsideredMoving) {
         console.log("%cDRS State: Considered Moving: true%c (Initial state on activation)", "color: orange;", "color: default;");
    } else if (!currentlyMoving && isConsideredMoving) {
         console.log("%cDRS State: Considered Stationary: false%c (Initial state on activation)", "color: lightgreen;", "color: default;");
    }
    isConsideredMoving = currentlyMoving; // Update internal state flag


    if (currentlyMoving) {
        applyDynamicResolution(dynamicLowPixelRatio); // Start low if moving
    } else {
        applyDynamicResolution(dynamicHighPixelRatio); // Start high if stationary
        // If starting stationary, ensure no stray timer is running
        clearTimeout(movementTimeoutId);
        movementTimeoutId = null;
    }

    // Update UI (setPixelRatio calls this, but call explicitly if needed)
    updateButtonActiveStates();
}

// Deactivate Dynamic Resolution Mode (usually called by applyPixelRatioPreset)
function deactivateDynamicResolution() {
    if (!isDynamicResolutionActive || !engine || engine.isDisposed || document.hidden) return;


     // OPTIMIZATION: Only run DRS logic every N frames
     if (++drsFrameCounter % DRS_CHECK_INTERVAL !== 0) return
    // --- State Change ---
    isDynamicResolutionActive = false;
    clearTimeout(movementTimeoutId); // Stop any pending resolution increase
    movementTimeoutId = null;

    // --- Logging ---
    if (isConsideredMoving) {
         console.log("%cDRS State: Considered Stationary: false%c (DRS Deactivated)", "color: lightgreen;", "color: default;");
    }
    isConsideredMoving = false; // Reset movement consideration flag

    console.log("%cDRS Deactivated", "color: grey;");
    // The caller (applyPixelRatioPreset) will set the new manual ratio and update buttons
}

// Apply a specific resolution value (used internally by dynamic system)
function applyDynamicResolution(targetRatio) {
    // Use the central function to apply the change
    // setPixelRatio already checks if the ratio is different
    window.setPixelRatio(targetRatio);
    // Logging is handled within setPixelRatio
}

// Update the active state highlight on ALL resolution buttons
function updateButtonActiveStates() {
    const settingsPanel = document.getElementById('settingsPanel');
    if (!settingsPanel) return; // Panel might not exist yet

    const dynamicButton = settingsPanel.querySelector('#pixelRatioDynamic');
    const resolutionButtons = settingsPanel.querySelectorAll('.resolution-group button:not(#pixelRatioDynamic)');

    if (dynamicButton) {
        dynamicButton.classList.toggle('active', isDynamicResolutionActive);
    }

    resolutionButtons.forEach(button => {
        if (!isDynamicResolutionActive) {
            // Manual mode: highlight the selected preset
            const presetName = button.id.replace('pixelRatio', '').toUpperCase();
            button.classList.toggle('active', presetName === currentPixelRatioPreset);
        } else {
            // Dynamic mode: remove active class from all manual buttons
            button.classList.remove('active');
        }
    });
}
// Make it globally accessible for ui.js
window.updateButtonActiveStates = updateButtonActiveStates;


// Check if the camera has moved significantly since the last check
function hasCameraMoved(forceCheck = false) {
    if (!camera || !engine || engine.isDisposed) return false; // Guard clauses

    // Initialize last state on first run or if camera was reset
    if (lastCameraPosition === null || lastCameraRotationQ === null) {
        if (!camera.rotationQuaternion) {
            camera.rotationQuaternion = BABYLON.Quaternion.FromEulerVector(camera.rotation);
        }
        if (!lastCameraPosition) lastCameraPosition = new BABYLON.Vector3();
        if (!lastCameraRotationQ) lastCameraRotationQ = new BABYLON.Quaternion();

        lastCameraPosition.copyFrom(camera.position);
        lastCameraRotationQ.copyFrom(camera.rotationQuaternion);

         if (!forceCheck) {
             return false; // Assume not moved on the very first frame after init
         }
    }

    // --- Check for position change ---
    const posChangeSq = BABYLON.Vector3.DistanceSquared(camera.position, lastCameraPosition);
    const posChanged = posChangeSq > movementDetectionThresholdPosSq;

    // --- Check for rotation change ---
    if (!camera.rotationQuaternion) { // Ensure quaternion exists
        camera.rotationQuaternion = BABYLON.Quaternion.FromEulerVector(camera.rotation);
    }
    const rotDot = Math.abs(BABYLON.Quaternion.Dot(camera.rotationQuaternion, lastCameraRotationQ));
    const rotChanged = rotDot < movementDetectionThresholdRotDot;

    // --- Check for joystick input ---
    const joyX = window.joystickVector?.x ?? 0;
    const joyY = window.joystickVector?.y ?? 0;
    const joystickMoving = window.joystickActive && window.joystickVisible &&
                           (Math.abs(joyX) > joystickMovementThreshold || Math.abs(joyY) > joystickMovementThreshold);

    // --- Determine if moved ---
    const moved = posChanged || rotChanged || joystickMoving;

    // --- Update last known state *only if not forcing a check* ---
     if (!forceCheck) {
        // Update state regardless of movement *if DRS is active*, so stationary check works
        if (isDynamicResolutionActive || moved) { // Update if DRS is on OR if moved in manual mode (less critical but keeps state fresh)
             lastCameraPosition.copyFrom(camera.position);
             lastCameraRotationQ.copyFrom(camera.rotationQuaternion);
        }
     }

    return moved;
}

// Core logic executed before each frame render for dynamic resolution
function updateDynamicResolutionLogic() {
    // Exit if DRS is not active, engine/scene/camera aren't ready, or tab is hidden
    if (!isDynamicResolutionActive || !engine || engine.isDisposed || !scene || !camera || document.hidden) {
        if (!isDynamicResolutionActive && movementTimeoutId) {
             clearTimeout(movementTimeoutId);
             movementTimeoutId = null;
         }
        return;
    }

    const movedThisFrame = hasCameraMoved(); // This updates last position/rotation if needed

    if (movedThisFrame) {
        // --- Camera IS MOVING ---

        // --- Logging State Change ---
        if (!isConsideredMoving) {
            console.log("%cDRS State: Considered Moving: true%c (Movement Detected)", "color: orange;", "color: default;");
        }
        isConsideredMoving = true; // Set the flag

        // Apply low resolution immediately if not already applied
        if (Math.abs(window.currentPixelRatio - dynamicLowPixelRatio) > 0.01) {
             applyDynamicResolution(dynamicLowPixelRatio);
        }

        // Clear any pending timer that might try to increase resolution
        if (movementTimeoutId) {
            clearTimeout(movementTimeoutId);
            movementTimeoutId = null;
        }
    } else {
        // --- Camera IS STATIONARY (this frame) ---
        if (!movementTimeoutId) { // Start timer only if not already running
            movementTimeoutId = setTimeout(() => {
                // Timer expired: Apply high resolution IF DRS is still active
                if (isDynamicResolutionActive) {
                    applyDynamicResolution(dynamicHighPixelRatio);
                    // --- Logging State Change ---
                    console.log("%cDRS State: Considered Stationary: false%c (Timer Expired)", "color: lightgreen;", "color: default;");
                    isConsideredMoving = false; // Officially considered stationary now
                } else {
                    // If DRS got deactivated while timer was pending
                    isConsideredMoving = false; // Still update flag
                }
                movementTimeoutId = null; // Timer is done
            }, timeUntilResolutionIncrease);
        }    }
}

// Setup the Babylon.js observer for the dynamic resolution logic
function initDynamicResolutionSystem() {
    if (!scene) {
        console.warn("Scene not ready, cannot initialize dynamic resolution observer.");
        return;
    }

    // Cleanup previous observer if re-initializing
    if (sceneBeforeRenderObserver) {
        scene.onBeforeRenderObservable.remove(sceneBeforeRenderObserver);
        sceneBeforeRenderObserver = null;
         console.log("Removed previous dynamic resolution observer.");
    }

    // Add the observer
    sceneBeforeRenderObserver = scene.onBeforeRenderObservable.add(updateDynamicResolutionLogic);
    console.log("Dynamic resolution observer added.");

    // Initialize last camera state here, assuming camera is ready
    if (camera) {
        lastCameraPosition = camera.position.clone();
        if (!camera.rotationQuaternion) {
            camera.rotationQuaternion = BABYLON.Quaternion.FromEulerVector(camera.rotation);
        }
        lastCameraRotationQ = camera.rotationQuaternion.clone();
    } else {
        console.warn("Camera not ready during dynamic resolution system init. Movement check might be delayed.");
    }
}

// Set initial resolution state based on device type or config
function initWithDefaults() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    let initialModeIsDynamic = true; // START IN MANUAL MODE
    let initialManualPreset = 'MEDIUM'; // Default manual preset

    if (isMobile) {
        // Set lower targets for DRS if user enables it on mobile
        dynamicHighPixelRatio = PIXEL_RATIO_PRESETS.MEDIUM.pixelRatio;
        dynamicLowPixelRatio = PIXEL_RATIO_PRESETS.LOW.pixelRatio;
        console.log("Mobile detected: DRS targets set to Medium/Low.");
    } else {
        // Set default targets for DRS if user enables it on desktop
        dynamicHighPixelRatio = PIXEL_RATIO_PRESETS.FULL.pixelRatio; // Using Full for High target on desktop
        dynamicLowPixelRatio = PIXEL_RATIO_PRESETS.MEDIUM.pixelRatio; // Using Medium for Low target on desktop
        console.log("Desktop detected: DRS targets set to Full/Medium.");
    }

    // --- Apply Initial Setting ---
    if (initialModeIsDynamic) {
        // This block is now skipped by default, but kept for reference
        if (camera) {
            hasCameraMoved(true);
        }
        activateDynamicResolution();
    } else {
        // Apply the chosen manual preset
        applyPixelRatioPreset(initialManualPreset);
    }

     // Log the final starting state
     if (isDynamicResolutionActive) {
        console.log(`Initial state: Dynamic Resolution Active (Current Ratio: ${window.currentPixelRatio.toFixed(2)}, Targets: Low=${dynamicLowPixelRatio.toFixed(2)}, High=${dynamicHighPixelRatio.toFixed(2)})`);
    } else {
        console.log(`Initial state: Manual Preset '${currentPixelRatioPreset}' (Current Ratio: ${window.currentPixelRatio.toFixed(2)})`);
    }
}

// Add performance indicator (FPS and Resolution)
function addPerformanceIndicator() {
    // Remove existing one first to prevent duplicates
    const existingIndicator = document.getElementById('performanceIndicator');
    if (existingIndicator) existingIndicator.remove();

    const indicator = document.createElement('div');
    indicator.id = 'performanceIndicator';
    // Styles moved to css file (manual-lod-style.css) for better separation
    document.body.appendChild(indicator);

    // Clear previous interval if exists
    if (performanceIndicatorIntervalId) {
        clearInterval(performanceIndicatorIntervalId);
    }

    // Function to update the indicator text
    window.updatePerformanceIndicator = () => {
         if (!engine || engine.isDisposed || !indicator) return; // Add check for indicator element
         const fps = engine.getFps().toFixed(0);
         const resPercent = (window.currentPixelRatio * 100).toFixed(0);
         // Add (Dyn) suffix only if DRS is active
         const modeSuffix = isDynamicResolutionActive ? ' (Dyn)' : '';
         indicator.innerHTML = `FPS: ${fps} | Res: ${resPercent}%${modeSuffix}`;
    };

    // Update the indicator periodically
    performanceIndicatorIntervalId = setInterval(window.updatePerformanceIndicator, 500); // Update twice per second
    // Initial update
     window.updatePerformanceIndicator();
}

// --- Cleanup Function ---
function cleanupManualLOD() {
    console.log("Cleaning up Manual LOD system...");
    // Remove Babylon observer
    if (scene && !scene.isDisposed && sceneBeforeRenderObserver) { // Check scene !isDisposed
        scene.onBeforeRenderObservable.remove(sceneBeforeRenderObserver);
        sceneBeforeRenderObserver = null;
        console.log("Dynamic resolution observer removed.");
    }
    // Clear timers
    if (movementTimeoutId) {
        clearTimeout(movementTimeoutId);
        movementTimeoutId = null;
        console.log("Movement timer cleared.");
    }
    if (performanceIndicatorIntervalId) {
        clearInterval(performanceIndicatorIntervalId);
        performanceIndicatorIntervalId = null;
        console.log("Performance indicator interval cleared.");
    }
    // Remove performance indicator from DOM
    const indicator = document.getElementById('performanceIndicator');
    if (indicator) {
        indicator.remove();
        console.log("Performance indicator removed from DOM.");
    }

    // Reset state variables
    isDynamicResolutionActive = false;
    currentPixelRatioPreset = null; // Ensure this is reset
    lastCameraPosition = null;
    lastCameraRotationQ = null;
    isConsideredMoving = false;

    console.log("Manual LOD cleanup complete.");
}


// Expose necessary functions globally
window.initManualLOD = initManualLOD;
window.applyPixelRatioPreset = applyPixelRatioPreset; // Called by buttons
window.activateDynamicResolution = activateDynamicResolution; // Called by button
window.initWithDefaults = initWithDefaults; // Called by main.js
window.cleanupManualLOD = cleanupManualLOD; // Called by main.js cleanup
// window.updateButtonActiveStates is already exposed
// window.setPixelRatio is exposed by ui.js
// main.js - Primary application file with improved event handling and optimized render loop

// Global variables
let currentSplatMesh = null;
let colliderMesh = null;
let camera = null;
let scene = null; // Ensure scene is declared globally
let engine = null;

// Initialize global pixel ratio state *before* anything uses it
// Use value from config or a sensible default (e.g., Medium)
window.currentPixelRatio = (typeof CONFIG !== 'undefined' && CONFIG.SCENE && CONFIG.SCENE.DEFAULT_PIXEL_RATIO)
                        ? CONFIG.SCENE.DEFAULT_PIXEL_RATIO
                        : 0.5; // Default to Medium if config isn't loaded/set

let sceneReadyWarned = false; // Flag for render loop "scene not ready" warning

// Render loop optimization variables
let lastFrameTime = 0;
let frameCounter = 0;
let fps = 0;
let frameTimeTotal = 0;
const fpsUpdateInterval = 500; // Update FPS display every 500ms
let lastFpsUpdate = 0;
let isDeviceHighEnd = true; // Will be determined dynamically

// Initialize the application
async function init() {
    try {
        const canvas = document.getElementById('renderCanvas');
        if (!canvas) throw new Error("Render canvas not found!");

        // Create Babylon.js engine
        engine = new BABYLON.Engine(canvas, true, {
            preserveDrawingBuffer: false, // Set to true only if you need canvas snapshots
            stencil: false,
            antialias: false, 
            adaptToDeviceRatio: false // IMPORTANT: We handle pixel ratio manually via setHardwareScalingLevel
        });
        engine.loadingScreen = new BABYLON.DefaultLoadingScreen(canvas, "Loading Scene...", "black"); // Use default loading screen initially
        engine.displayLoadingUI();

        // Expose engine globally
        window.engine = engine;

        // --- Initialization Order ---
        showLoadingIndicator("Initializing Scene..."); // Use custom indicator
        scene = await initScene(); // Create scene, load default assets, optimize, setup observer
        if (!scene) {
            // initScene should have shown an error, but we throw to stop execution here
            throw new Error("Scene initialization failed! Check console for details.");
        }

        showLoadingIndicator("Initializing Camera...");
        initCamera(); // Depends on scene
        if (!camera) throw new Error("Camera initialization failed!");

        showLoadingIndicator("Initializing UI...");
        // ui.js must define setPixelRatio globally *before* manual-lod needs it
        if (typeof initUI !== 'function') throw new Error("initUI function not found!");
        initUI(); // Sets up buttons, panels etc.

        // manual-lod.js depends on ui.js (for setPixelRatio) and scene/camera
        if (typeof initManualLOD === 'function') {
            showLoadingIndicator("Initializing Resolution Controls...");
             initManualLOD(); // Initializes resolution controls, DRS observer, performance indicator
         } else {
             console.warn("initManualLOD function not found. Resolution controls unavailable.");
         }

         // Initialize systems that depend on UI/Scene
         if (typeof initJoystick === 'function') {
             showLoadingIndicator("Initializing Joystick...");
             initJoystick();
         }
         if (typeof initInteractions === 'function') {
              showLoadingIndicator("Initializing Interactions...");
              // Note: initInteractions itself might load art meshes asynchronously
              initInteractions();
         }

         // Apply initial resolution settings (Dynamic or Manual) based on device/defaults
         // This needs camera and manual-lod system to be ready.
         if (typeof initWithDefaults === 'function') {
             showLoadingIndicator("Applying Initial Settings...");
             initWithDefaults(); // Sets initial pixel ratio via dynamic or manual preset
         } else {
              console.warn("initWithDefaults function not found. Applying fallback resolution.");
              // Fallback: Explicitly set the initial ratio using the global value
              if(typeof window.setPixelRatio === 'function') {
                  window.setPixelRatio(window.currentPixelRatio);
              }
         }

        // Setup global listeners (resize, keyboard)
        setupEventListeners();

        // Detect device capability before starting render loop
        detectDeviceCapability();

        // Hide loading indicators (both custom and engine's default)
        hideLoadingIndicator();
        engine.hideLoadingUI();

        console.log("Initialization Complete. Starting Render Loop.");
        sceneReadyWarned = false; // Reset warning flag before loop starts

        // --- Start Optimized Render Loop ---
        engine.runRenderLoop(optimizedRenderLoop);

    } catch (error) {
        console.error("Initialization failed:", error);
        showError(`Application failed to initialize: ${error.message || error}`);
        // Hide loading indicators on failure too
        hideLoadingIndicator();
        if (engine && engine.hideLoadingUI) engine.hideLoadingUI();
        // Perform partial cleanup if possible / desired on init fail
         cleanup();
    }
}

// Detect device capability for adaptive performance
function detectDeviceCapability() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Check for low-end devices based on UA string or simple benchmark
    const isLowEndDevice = isMobile && (
        /iPhone\s(5|6|7|8|SE)|Android.*SM-G9|Android.*GT-/i.test(navigator.userAgent) || 
        (window.screen.width * window.screen.height < 1000000)
    );
    
    // Simple benchmark to check device performance (optional)
    let benchmarkStart = performance.now();
    let counter = 0;
    for (let i = 0; i < 100000; i++) {
        counter += Math.sqrt(i);
    }
    let benchmarkDuration = performance.now() - benchmarkStart;
    
    // Determine if this is a high-end device based on benchmark
    isDeviceHighEnd = !isLowEndDevice && benchmarkDuration < 50;
    
    console.log(`Device capability detected: ${isDeviceHighEnd ? 'High-end' : 'Low-end'}`);
    return isDeviceHighEnd;
}

// Optimized render loop function
function optimizedRenderLoop() {
    // OPTIMIZATION #1: Quick exit if these critical conditions aren't met
    if (!engine || engine.isDisposed || !scene || scene.isDisposed || !camera) {
        return;
    }
    
    // OPTIMIZATION #2: Skip rendering when tab is not visible
    if (document.hidden) {
        return;
    }
    
    // OPTIMIZATION #3: Frame time management
    const currentTime = performance.now();
    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;
    
    // Count frames for FPS calculation
    frameCounter++;
    frameTimeTotal += deltaTime;
    
    // Update FPS counter periodically
    if (currentTime - lastFpsUpdate >= fpsUpdateInterval) {
        fps = Math.round(1000 * frameCounter / frameTimeTotal);
        frameCounter = 0;
        frameTimeTotal = 0;
        lastFpsUpdate = currentTime;
        
        // Update FPS in performance indicator if available
        if (typeof window.updatePerformanceIndicator === 'function') {
            window.updatePerformanceIndicator();
        }
    }
    
    // OPTIMIZATION #4: Adaptive processing based on device capability
    // Skip non-essential processing on low-end devices when frame rate drops
    const isPerformanceIssue = !isDeviceHighEnd && fps < 30;
    
    // OPTIMIZATION #5: Apply joystick movement if active and visible
    // This is essential gameplay input so we always process it
    if (window.joystickActive && window.joystickVisible && typeof applyJoystickMovement === 'function') {
        applyJoystickMovement();
    }
    
    // OPTIMIZATION #6: Maintain camera height only when needed
    // Throttle on low-end devices or when performance is suffering
    if (camera && (!isPerformanceIssue || frameCounter % 2 === 0)) {
        // Inline the function for better performance
        const targetHeight = CONFIG.CAMERA.HEIGHT;
        if (Math.abs(camera.position.y - targetHeight) > 0.01) {
            camera.position.y = targetHeight;
        }
    }
    
    // OPTIMIZATION #7: Attempt to render even with missing meshes
    // This ensures something is always displayed even during loading
    try {
        // Render the scene
        scene.render();
    } catch (e) {
        // Only log errors that aren't related to loading or disposal
        if (!e.message.includes("disposed") && 
            !e.message.includes("loading") && 
            !e.message.includes("still initializing")) {
            console.error("Render error:", e);
        }
    }
}

// Setup global event listeners with EventManager
function setupEventListeners() {
    // Window resize
    EventManager.addListener('window', window, 'resize', () => {
        if (engine && !engine.isDisposed) {
            engine.resize();
        }
        if (typeof updateJoystickDimensions === 'function') {
            updateJoystickDimensions(); // Recalculate joystick bounds
        }
        // Fullscreen button state might need update on resize if windowed fullscreen changes
        if(typeof updateFullscreenButton === 'function') {
            updateFullscreenButton();
        }
    });

    // Keyboard shortcuts
    EventManager.addListener('document', window, 'keydown', (e) => {
        // Ignore keydowns if an input field is focused
         if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable)) {
            return;
        }

        const key = e.key.toLowerCase();

        // Toggle joystick visibility with 'J' key
        if (key === 'j') {
            e.preventDefault(); // Prevent potential default browser actions for 'j'
            if (typeof toggleJoystick === 'function') {
                toggleJoystick();
                 // Update button state accordingly
                 const joyToggleBtn = document.getElementById('toggleJoystick');
                 if(joyToggleBtn) joyToggleBtn.classList.toggle('active', window.joystickVisible);
            }
        }

        // Toggle fullscreen with 'F' key
        if (key === 'f') {
             e.preventDefault(); // Prevent potential default browser actions for 'f'
            if (typeof toggleFullscreen === 'function') toggleFullscreen();
        }

        // Close any open panels or popups with Escape key
        if (e.key === 'Escape') { // Use e.key for modern browsers
             e.preventDefault();
            if (typeof closeAllPanels === 'function') closeAllPanels();
            // hidePopup is called within closeAllPanels now
        }
    });
}

// Maintain camera at correct height
function maintainCameraHeight() {
    // Avoid function calls, math operations, and property access by using constants
    if (!camera) return;
    
    // PERFORMANCE BOOST: Only set when it actually changed
    // Use a small epsilon to avoid floating point issues and unnecessary assignments
    const targetHeight = CONFIG.CAMERA.HEIGHT;
    const currentHeight = camera.position.y;
    if (Math.abs(currentHeight - targetHeight) > 0.005) {
        camera.position.y = targetHeight;
    }
}

// Debug logging function
function debugLog(...args) {
    // Check CONFIG exists and has the DEBUG structure
    if (CONFIG?.DEBUG?.ENABLE_LOGGING) {
        console.log('[DEBUG]', ...args);
    }
}

// Cleanup function called on page unload or manual trigger
function cleanup() {
    console.log("%cPerforming application cleanup...", "color: orange; font-weight: bold;");

    // 1. Stop the render loop FIRST
    if (engine && !engine.isDisposed) {
        engine.stopRenderLoop();
        console.log("Render loop stopped.");
    }

    // 2. Call module cleanup functions (check existence before calling)
     if (typeof cleanupManualLOD === 'function') {
         cleanupManualLOD(); // Cleans up observer, timers, performance indicator
         console.log("Manual LOD system cleaned up.");
     } else { console.warn("cleanupManualLOD not found during cleanup."); }

    if (typeof disposeInteractions === 'function') {
        disposeInteractions();
        console.log("Interactions disposed.");
    } else { console.warn("disposeInteractions not found during cleanup."); }

    if (typeof cleanupJoystick === 'function') {
        cleanupJoystick();
        console.log("Joystick cleaned up.");
    } else { console.warn("cleanupJoystick not found during cleanup."); }

    // 3. Dispose Babylon Resources (Scene first, then Engine)

    // --- Remove Frustum Culling Observer ---
    // Assumes `frustumCullObserver` is a global variable defined/assigned in scene.js
    if (scene && !scene.isDisposed && typeof frustumCullObserver !== 'undefined' && frustumCullObserver) {
        scene.onBeforeRenderObservable.remove(frustumCullObserver);
        frustumCullObserver = null; // Clear the global reference
        console.log("Frustum culling observer removed.");
    } else if (typeof frustumCullObserver !== 'undefined' && frustumCullObserver){
        console.warn("Cleanup: Scene disposed or observer invalid, could not remove frustum observer.");
    }
    // --- End Observer Removal ---


    if (scene && !scene.isDisposed) {
        console.log("Disposing scene...");
        if (camera && camera.detachControl) {
             // Detach control cleanly before disposing scene
             try { camera.detachControl(); } catch (e) { console.warn("Error detaching camera control during cleanup:", e); }
             console.log("Camera control detached.");
         }
        scene.dispose();
        scene = null; // Nullify the global reference
        console.log("Scene disposed.");
    } else {
        console.log("Cleanup: Scene already disposed or never initialized.");
    }

    if (engine && !engine.isDisposed) {
        console.log("Disposing engine...");
        // Dispose of any engine-level resources if necessary (e.g., loading screen)
        engine.loadingScreen?.dispose?.(); // Dispose default loading screen if it exists and has dispose method
        engine.dispose();
        engine = null; // Nullify the global reference
        console.log("Engine disposed.");
    } else {
        console.log("Cleanup: Engine already disposed or never initialized.");
    }

    // 4. Clear global variables and state flags
    camera = null;
    currentSplatMesh = null; // Ensure mesh refs are cleared
    colliderMesh = null;
    window.currentPixelRatio = (CONFIG?.SCENE?.DEFAULT_PIXEL_RATIO) ?? 0.5; // Reset global state
    sceneReadyWarned = false; // Reset flag

    // 5. Remove all managed event listeners LAST
    EventManager.removeAll();
    console.log("All EventManager listeners removed.");

    // 6. Remove UI elements dynamically added if necessary (e.g., performance indicator if not handled by module cleanup)
    // Example: const perfIndicator = document.getElementById('performanceIndicator'); if (perfIndicator) perfIndicator.remove();


    console.log("%cCleanup complete.", "color: green; font-weight: bold;");
}

// Disable console logging in production (conditionally)
// Ensure CONFIG is checked before accessing DEBUG properties
if (typeof CONFIG !== 'undefined' && CONFIG.DEBUG && CONFIG.DEBUG.ENABLE_LOGGING === false) {
    // Check for console object existence before overriding
    if (typeof console !== 'undefined') {
        const noop = function() {};
        const originalError = console.error; // Keep error logging functional

        console.log = noop;
        console.info = noop;
        console.debug = noop;
        console.warn = noop;

        // Optional: provide a way to restore logging for debugging production issues
        window.restoreConsoleLogging = function() {
            delete console.log;
            delete console.info;
            delete console.debug;
            delete console.warn;
            console.log("Console logging restored.");
        };
        originalError("Non-error console logging has been disabled for production. Call window.restoreConsoleLogging() to re-enable.");
    }
}

// --- Global Error Handling ---
EventManager.addListener('window', window, 'error', (event) => {
    console.error('Unhandled Error:', event.message, 'at', event.filename, ':', event.lineno, event.error);
    // Avoid showing alert for ResizeObserver errors which are common and often harmless
    if (event.message && !event.message.includes('ResizeObserver')) {
         showError(`An unexpected error occurred: ${event.message}`);
    }
    // Optionally try to perform cleanup on unhandled errors, but be careful as state might be corrupt
    // cleanup();
});

EventManager.addListener('window', window, 'unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
     showError(`An unexpected promise error occurred: ${event.reason?.message || event.reason}`);
    // cleanup();
});


// Add cleanup handler for page unload/navigation
EventManager.addListener('window', window, 'beforeunload', cleanup);

// Initialize application when DOM is ready
// Use DOMContentLoaded for faster initialization than 'load'
EventManager.addListener('document', document, 'DOMContentLoaded', init);
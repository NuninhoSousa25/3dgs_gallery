// joystick.js - Optimized for mobile performance

// Joystick state variables - global for access elsewhere
window.joystickActive = false;
window.joystickVector = { x: 0, y: 0 };
window.joystickBaseRect = null;
window.baseRadius = 0;
window.maxHandleDistance = 0;
window.joystickVisible = false;

// Performance optimization variables
let lastMoveTime = 0;
let movementThrottle = 0; // ms (0 = no throttle)
let lastPositionX = 0;
let lastPositionY = 0;
let movementThreshold = 0; // px
let transformDirty = false;
let updateScheduled = false;
let rafId = null;
let joystickHandle = null;

// Initialize joystick
function initJoystick() {
    const joystickContainer = document.getElementById('joystickContainer');
    const joystickBase = document.getElementById('joystickBase');
    
    if (!joystickContainer || !joystickBase) {
        console.error("Joystick elements not found in the DOM");
        return;
    }

    // Cache joystick handle reference
    joystickHandle = document.getElementById('joystickHandle');
    if (!joystickHandle) {
        console.error("Joystick handle not found");
        return;
    }
    
    // Set performance parameters based on device capability
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isLowEndMobile = isMobile && (
        /iPhone\s(5|6|7|8|SE)|Android.*SM-G9|Android.*GT-/i.test(navigator.userAgent) || 
        (window.screen.width * window.screen.height < 1000000)
    );
    
    // Set appropriate throttling for the device
    if (isLowEndMobile) {
        movementThrottle = 16; // ~60fps
        movementThreshold = 2; // px
    } else if (isMobile) {
        movementThrottle = 8; // ~120fps
        movementThreshold = 1; // px
    } else {
        movementThrottle = 0; // No throttle on desktop
        movementThreshold = 0; // No threshold on desktop
    }
    
    // Show joystick automatically on mobile devices if configured
    if (CONFIG.JOYSTICK.AUTO_SHOW_ON_MOBILE && isMobile) {
        window.joystickVisible = true;
        joystickContainer.style.display = 'block';
    }
    
    // Set joystick position from config
    const [left, bottom] = CONFIG.JOYSTICK.POSITION;
    joystickContainer.style.left = `${left}px`;
    joystickContainer.style.bottom = `${bottom}px`;
    
    // Setup joystick dimensions
    updateJoystickDimensions();
    
    // Setup optimized event listeners
    setupJoystickEvents();
}

// Toggle joystick visibility
function toggleJoystick() {
    const joystickContainer = document.getElementById('joystickContainer');
    if (!joystickContainer) return;
    
    window.joystickVisible = !window.joystickVisible;
    joystickContainer.style.display = window.joystickVisible ? 'block' : 'none';
    
    // Cancel any active animations if hiding
    if (!window.joystickVisible) {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        updateScheduled = false;
        resetJoystick();
    } else {
        // If showing, update dimensions after display change
        setTimeout(updateJoystickDimensions, 10);
    }
}

// Setup optimized event listeners for joystick
function setupJoystickEvents() {
    const joystickBase = document.getElementById('joystickBase');
    if (!joystickBase) return;
    
    // First, ensure we clean up any existing joystick listeners
    EventManager.removeCategory('joystick');
    
    // Mouse events with optimized handlers
    EventManager.addListener('joystick', joystickBase, 'mousedown', startJoystick);
    EventManager.addListener('joystick', document, 'mousemove', moveJoystick);
    EventManager.addListener('joystick', document, 'mouseup', endJoystick);
    
    // Touch events with optimized handlers - using passive: false only where necessary
    EventManager.addListener('joystick', joystickBase, 'touchstart', handleTouchStart, { passive: false });
    EventManager.addListener('joystick', document, 'touchmove', handleTouchMove, { passive: false });
    EventManager.addListener('joystick', document, 'touchend', handleTouchEnd, { passive: true });
    EventManager.addListener('joystick', document, 'touchcancel', handleTouchEnd, { passive: true });
}

// Update joystick dimensions with optimized layout triggers
function updateJoystickDimensions() {
    const joystickBase = document.getElementById('joystickBase');
    if (!joystickBase || !joystickHandle) return;
    
    // Force recalculation of dimensions (unavoidable layout trigger)
    window.joystickBaseRect = joystickBase.getBoundingClientRect();
    window.baseRadius = window.joystickBaseRect.width / 2;
    window.maxHandleDistance = window.baseRadius * CONFIG.JOYSTICK.MAX_HANDLE_DISTANCE_FACTOR;
    
    // Reset handle position without causing layout thrashing
    resetJoystick();
}

// Start joystick movement with efficient event handling
function startJoystick(e) {
    if (!window.joystickVisible) return;
    e.preventDefault();
    
    // Always recalculate dimensions on start to handle any layout changes
    const joystickBase = document.getElementById('joystickBase');
    if (!joystickBase) return;
    
    window.joystickBaseRect = joystickBase.getBoundingClientRect();
    window.baseRadius = window.joystickBaseRect.width / 2;
    window.maxHandleDistance = window.baseRadius * CONFIG.JOYSTICK.MAX_HANDLE_DISTANCE_FACTOR;
    
    window.joystickActive = true;
    moveJoystick(e);
}

// Move joystick with performance optimizations
function moveJoystick(e) {
    // OPTIMIZATION: Immediate exit conditions first
    if (!window.joystickActive || !window.joystickVisible) return;
    
    // OPTIMIZATION: Skip processing based on time throttle
    const now = performance.now();
    if (movementThrottle > 0 && (now - lastMoveTime < movementThrottle)) {
        return;
    }
    lastMoveTime = now;
    
    // OPTIMIZATION: Handle must exist and be cached
    if (!joystickHandle || !window.joystickBaseRect) return;
    
    // Get mouse position relative to joystick base center
    const mouseX = e.clientX - (window.joystickBaseRect.left + window.baseRadius);
    const mouseY = e.clientY - (window.joystickBaseRect.top + window.baseRadius);
    
    // OPTIMIZATION: Skip tiny movements on mobile
    if (movementThreshold > 0) {
        const deltaX = Math.abs(mouseX - lastPositionX);
        const deltaY = Math.abs(mouseY - lastPositionY);
        if (deltaX < movementThreshold && deltaY < movementThreshold) {
            return;
        }
    }
    
    // Store last position
    lastPositionX = mouseX;
    lastPositionY = mouseY;
    
    // Calculate vector magnitude (distance from center)
    const distance = Math.sqrt(mouseX * mouseX + mouseY * mouseY);
    
    // Normalize to unit vector (direction) and apply max distance
    const normalizedDistance = Math.min(distance, window.maxHandleDistance);
    
    let nx = 0, ny = 0;
    if (distance > 0) {
        nx = (mouseX / distance) * normalizedDistance;
        ny = (mouseY / distance) * normalizedDistance;
    }
    
    // OPTIMIZATION: Update joystick vector immediately for gameplay logic
    window.joystickVector.x = nx / window.maxHandleDistance; // Right is positive X
    window.joystickVector.y = -ny / window.maxHandleDistance; // Up is positive Y (inverted for screen coords)
    
    // OPTIMIZATION: Use requestAnimationFrame for visual updates to prevent layout thrashing
    if (!updateScheduled) {
        updateScheduled = true;
        rafId = requestAnimationFrame(() => {
            // Update joystick handle position using transform for performance
            joystickHandle.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
            transformDirty = false;
            updateScheduled = false;
            rafId = null;
        });
    }
    
    e.preventDefault();
}

// End joystick movement with efficient cleanup
function endJoystick(e) {
    if (!window.joystickActive) return;
    
    window.joystickActive = false;
    
    // Reset joystick state
    resetJoystick();
    
    // Cancel any pending animation frame
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    updateScheduled = false;
    
    if (e && e.preventDefault) {
        e.preventDefault();
    }
}

// Reset joystick to center with optimized visual update
function resetJoystick() {
    // Reset joystick vector immediately for gameplay logic
    window.joystickVector.x = 0;
    window.joystickVector.y = 0;
    
    // Reset handle position using transform
    if (joystickHandle) {
        joystickHandle.style.transform = 'translate(-50%, -50%)';
    }
    
    // Reset tracking variables
    lastPositionX = 0;
    lastPositionY = 0;
    transformDirty = false;
}

// Touch event handlers with improved touch response
function handleTouchStart(e) {
    if (!window.joystickVisible || e.touches.length === 0) return;
    e.preventDefault();
    
    window.joystickActive = true;
    moveJoystickTouch(e.touches[0]);
}

function handleTouchMove(e) {
    if (!window.joystickActive || !window.joystickVisible || e.touches.length === 0) return;
    e.preventDefault();
    
    moveJoystickTouch(e.touches[0]);
}

function handleTouchEnd(e) {
    endJoystick(e);
}

// Process touch movement with performance optimizations
function moveJoystickTouch(touch) {
    // OPTIMIZATION: Skip processing based on time throttle
    const now = performance.now();
    if (movementThrottle > 0 && (now - lastMoveTime < movementThrottle)) {
        return;
    }
    lastMoveTime = now;
    
    // OPTIMIZATION: Required elements must exist
    if (!joystickHandle || !window.joystickBaseRect) return;
    
    // Get touch position relative to joystick base center
    const touchX = touch.clientX - (window.joystickBaseRect.left + window.baseRadius);
    const touchY = touch.clientY - (window.joystickBaseRect.top + window.baseRadius);
    
    // OPTIMIZATION: Skip tiny movements on mobile
    if (movementThreshold > 0) {
        const deltaX = Math.abs(touchX - lastPositionX);
        const deltaY = Math.abs(touchY - lastPositionY);
        if (deltaX < movementThreshold && deltaY < movementThreshold) {
            return;
        }
    }
    
    // Store last position
    lastPositionX = touchX;
    lastPositionY = touchY;
    
    // Calculate vector magnitude (distance from center)
    const distance = Math.sqrt(touchX * touchX + touchY * touchY);
    
    // Normalize to unit vector and apply max distance
    const normalizedDistance = Math.min(distance, window.maxHandleDistance);
    
    let nx = 0, ny = 0;
    if (distance > 0) {
        nx = (touchX / distance) * normalizedDistance;
        ny = (touchY / distance) * normalizedDistance;
    }
    
    // OPTIMIZATION: Update joystick vector immediately for gameplay logic
    window.joystickVector.x = nx / window.maxHandleDistance;
    window.joystickVector.y = -ny / window.maxHandleDistance;
    
    // OPTIMIZATION: Use requestAnimationFrame for visual updates
    if (!updateScheduled) {
        updateScheduled = true;
        rafId = requestAnimationFrame(() => {
            joystickHandle.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
            transformDirty = false;
            updateScheduled = false;
            rafId = null;
        });
    }
}

// Clean up joystick events - can be called when changing scenes or unloading
function cleanupJoystick() {
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    EventManager.removeCategory('joystick');
    window.joystickActive = false;
    window.joystickVector = { x: 0, y: 0 };
    updateScheduled = false;
    transformDirty = false;
    joystickHandle = null;
}
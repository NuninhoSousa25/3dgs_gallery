// config.js - Central configuration settings for the 3D Gaussian Splatting application

const cameraHeight = 1.8; // Matches CONFIG.CAMERA.HEIGHT for clarity
const ellipsoidRadiusY = 0.34; // Matches CONFIG.COLLISION.ELLIPSOID[1]
// Offset = desired ellipsoid center Y - camera origin Y
// We want the ellipsoid center at y = ellipsoidRadiusY for it to sit on the ground
const ellipsoidOffsetY = ellipsoidRadiusY - cameraHeight; // e.g., 0.34 - 1.8 = -1.46

const CONFIG = {
    // Camera settings
    CAMERA: {
        // Initial position [x, y, z]
        INITIAL_POSITION: [0, 1.7, -20], // Start slightly below target height? Check this. Should match HEIGHT?
        // Initial target/look-at position [x, y, z]
        INITIAL_TARGET: [0, 1.7, 0],   // Should match target height
        // Camera height from ground (meters) - This is the camera's origin Y
        HEIGHT: cameraHeight, // Use the constant: 1.8
        // Field of view in degrees
        FOV: 55,
        // Movement speed (meters per frame or per second? Babylon FreeCamera uses units per frame scaled by engine delta time implicitly with moveWithCollisions)
        // Let's treat this as a base factor. Adjust value based on feel.
        SPEED: 0.175, // Might need significant tuning now
        // Mouse sensitivity (higher = less sensitive)
        ANGULAR_SENSITIVITY: 4000,
        // Minimum distance camera can focus (meters)
        MIN_Z: 0.2,
        // Camera inertia (0-1, higher = more smoothing) - Affects mouse look, not usually collision movement
        INERTIA: 0.9
    },

    // Collision settings
    COLLISION: {
        // Enable collision detection
        ENABLED: true,
        // Collision ellipsoid size [radiusX, radiusY (half-height), radiusZ]
        ELLIPSOID: [0.45, ellipsoidRadiusY, 0.45], // Use the constant: [0.45, 0.34, 0.45]
        // Collision ellipsoid offset from camera origin [x, y, z]
        // *** CORRECTED VALUE *** Places the ellipsoid near the camera's "feet"
        ELLIPSOID_OFFSET: [0, ellipsoidOffsetY, 0], // Use the calculated value: [0, -1.46, 0]
        // Small offset to prevent getting too close to walls (Handled by ellipsoid size)
        // WALL_OFFSET: 0.15, // No longer used directly
        // Number of collision retries (Babylon internal)
        RETRY_COUNT: 2, // Default is 5
        // Collision precision value (Babylon internal)
        EPSILON: 0.01 // Default is 0.001, might need increase if getting stuck slightly
    },

    // Scene and renderer settings
    SCENE: {
        // Background color [r, g, b, a] (0-1)
        CLEAR_COLOR: [0.1, 0.1, 0.15, 1],
        // Default hemispheric light intensity
        LIGHT_INTENSITY: 0.7,
        // Initial render quality (pixel ratio) - Used by manual-lod.js
        DEFAULT_PIXEL_RATIO: 0.5 // Defaulting to Medium
    },

    // Asset loading
    ASSETS: {
        // Default 3D scene file path
        SPLAT_FILE: "scene.ply",
        // Default collider file path
        COLLIDER_FILE: "collider.glb",
        DEFAULT_ART_FILE: "art1.glb", // <<< CHANGE: Moved filename here
        // Base path for art assets (used in interaction.js)
        ART_ASSETS_PATH: "./assets/art/" // Added for clarity in loadArtMesh
    
    },

    // Joystick settings
    JOYSTICK: {
        // Auto-display joystick on mobile devices
        AUTO_SHOW_ON_MOBILE: true,
        // Maximum handle distance from center (as percentage of base radius)
        MAX_HANDLE_DISTANCE_FACTOR: 0.75,
        // Movement speed multiplier for desktop (applied to camera.speed)
        DESKTOP_SPEED_MULTIPLIER: 0.8, // Might need tuning
        // Movement speed multiplier for mobile (applied to camera.speed)
        MOBILE_SPEED_MULTIPLIER: 0.8, // Might need tuning
        // Position from bottom-left [x, y] in pixels
        POSITION: [50, 50]
    },

    // Loading settings
    LOADING: {
        // Default loading message
        DEFAULT_MESSAGE: "Loading...",
        // Splat loading message
        SPLAT_MESSAGE: "Loading Scene...",
        // Collider loading message
        COLLIDER_MESSAGE: "Loading Collider..."
    },

    // Debug settings
    DEBUG: {
        // Enable debug logging
        ENABLE_LOGGING: false,
        // Show performance stats
        SHOW_STATS: false, // Performance indicator added separately now
        // Show collider meshes for debugging
        SHOW_COLLIDERS: false // Set to true to visualize collider.glb
    }
};

Object.freeze(CONFIG);
Object.keys(CONFIG).forEach(key => {
    if (typeof CONFIG[key] === 'object' && CONFIG[key] !== null) {
        // Freeze nested objects like CAMERA, COLLISION etc.
        try { Object.freeze(CONFIG[key]); } catch (e) { /* Ignore freezing primitive wrappers */ }
    }
});

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
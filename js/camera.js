// camera.js - Camera controls and configuration

const _tempVec3A = new BABYLON.Vector3();
const _tempVec3B = new BABYLON.Vector3();
const _tempVec3C = new BABYLON.Vector3();

// Initialize the camera
function initCamera() {
    if (!scene) {
        console.error("Scene not initialized when creating camera");
        return;
    }

    // Create and position camera
    const [x, y, z] = CONFIG.CAMERA.INITIAL_POSITION;
    const [targetX, targetY, targetZ] = CONFIG.CAMERA.INITIAL_TARGET;
    
    camera = new BABYLON.FreeCamera("mainCamera", new BABYLON.Vector3(x, y, z), scene);
    camera.setTarget(new BABYLON.Vector3(targetX, targetY, targetZ));
    
    // Configure camera controls
    camera.attachControl(document.getElementById('renderCanvas'), true);
    camera.fov = BABYLON.Tools.ToRadians(CONFIG.CAMERA.FOV);
    camera.speed = CONFIG.CAMERA.SPEED;
    camera.angularSensibility = CONFIG.CAMERA.ANGULAR_SENSITIVITY;
    
    // Key mappings for movement
    camera.keysUp = [87, 38];    // W or Up Arrow
    camera.keysDown = [83, 40];  // S or Down Arrow
    camera.keysLeft = [65, 37];  // A or Left Arrow
    camera.keysRight = [68, 39]; // D or Right Arrow
    
    // Physics settings
    camera.applyGravity = false;
    camera.minZ = CONFIG.CAMERA.MIN_Z;
    camera.inertia = CONFIG.CAMERA.INERTIA;
    
    // Collision configuration
    if (CONFIG.COLLISION.ENABLED) {
        configureCameraCollision();
    }

    if (!camera.rotationQuaternion) {
        camera.rotationQuaternion = BABYLON.Quaternion.FromEulerVector(camera.rotation);
   }
   
   console.log("initCamera completed. Camera object:", camera);
}



function configureCameraCollision() {
    if (!camera) return;

    // *** Enable scene collisions FIRST (might be redundant if done in scene.js, but safe) ***
    if (scene && !scene.collisionsEnabled) {
        console.warn("configureCameraCollision: Enabling scene collisions.");
        scene.collisionsEnabled = true;
    }

    camera.checkCollisions = true; // Enable collision checking for the camera itself

    const [ellipX, ellipY, ellipZ] = CONFIG.COLLISION.ELLIPSOID;
    camera.ellipsoid = new BABYLON.Vector3(ellipX, ellipY, ellipZ);

    const [offsetX, offsetY, offsetZ] = CONFIG.COLLISION.ELLIPSOID_OFFSET;
    camera.ellipsoidOffset = new BABYLON.Vector3(offsetX, offsetY, offsetZ);

    // Collision callback for debugging
    camera.onCollide = (collidedMesh) => {
        if (CONFIG.DEBUG.ENABLE_LOGGING) {
            // console.log("Camera collision with:", collidedMesh?.name || "unknown mesh");
        }
    };
     console.log("Camera collision configured.");
}


function applyJoystickMovement() {
    // Guard clauses
    if (!camera || !scene || !window.joystickVector || !window.joystickVisible || !window.joystickActive) return;

    // Get camera's forward and right vectors in local space
    const forward = new BABYLON.Vector3(0, 0, 1);  // Forward in local space
    const right = new BABYLON.Vector3(1, 0, 0);    // Right in local space
    
   // OPTIMIZATION: Use reusable vectors
   _tempVec3A.set(0, 0, 1); // Forward in local space
   _tempVec3B.set(1, 0, 0); // Right in local space
   
   // Transform vectors using existing objects
   const forwardWorld = BABYLON.Vector3.TransformNormal(_tempVec3A, camera.getWorldMatrix(), _tempVec3C);
   const rightWorld = BABYLON.Vector3.TransformNormal(_tempVec3B, camera.getWorldMatrix(), _tempVec3A);
   
   // Zero-out Y component
   forwardWorld.y = 0;
   rightWorld.y = 0;
    
    // Normalize the vectors (in case Y component changed their length)
    forwardWorld.normalize();
    rightWorld.normalize();
    
    // Calculate movement based on joystick input
    const moveVector = new BABYLON.Vector3(0, 0, 0);
    
    // Apply joystick Y to forward/backward movement
    moveVector.addInPlace(forwardWorld.scale(window.joystickVector.y));
    
    // Apply joystick X to right/left movement
    moveVector.addInPlace(rightWorld.scale(window.joystickVector.x));
    
    // Apply speed multiplier
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const speedMultiplier = isMobile ?
        CONFIG.JOYSTICK.MOBILE_SPEED_MULTIPLIER :
        CONFIG.JOYSTICK.DESKTOP_SPEED_MULTIPLIER;
    
    // Get distance from center (0-1 range)
    const joystickDistance = Math.sqrt(
        window.joystickVector.x * window.joystickVector.x + 
        window.joystickVector.y * window.joystickVector.y
    );
    
    // Apply movement with speed based on distance from center
    camera.cameraDirection.addInPlace(moveVector.scale(camera.speed * speedMultiplier * joystickDistance));
}
// scene.js - Scene and asset management

// --- Global Observer Reference ---
let frustumCullObserver = null; // Store observer globally or attach to scene metadata

// Initialize the scene
async function initScene() {
    // Create the scene
    scene = new BABYLON.Scene(engine);
    // window.scene = scene; // Optional: if needed globally immediately

    // Set clear color from config
    const [r, g, b, a] = CONFIG.SCENE.CLEAR_COLOR;
    scene.clearColor = new BABYLON.Color4(r, g, b, a);

    // Enable collisions
    scene.collisionsEnabled = CONFIG.COLLISION.ENABLED;
    scene.workerCollisions = CONFIG.COLLISION.ENABLED; // Note: May require specific worker setup

    // Setup scene components
    setupLighting(); // Uses scene

    // Load initial assets
    try {
        showLoadingIndicator(CONFIG.LOADING.DEFAULT_MESSAGE);

        // Load default scene assets
        await loadDefaultAssets(); // Needs scene, loads splat/collider

        // Apply optimizations after assets are loaded
        optimizeScene(); // Optimizes scene settings and potentially loaded meshes

        // Setup observer AFTER optimizeScene and asset loading are done
        setupFrustumCullingObserver(scene); // Pass the created scene

    } catch (error) {
        console.error("Scene Initialization or Asset Loading error:", error);
        showError(`Failed to initialize scene: ${error.message || error}`);
        // Attempt to clean up partially created scene
        if (scene && !scene.isDisposed) {
            scene.dispose();
            scene = null; // Reset global ref
        }
        return null; // Indicate failure to main.js
    } finally {
        hideLoadingIndicator();
    }

    console.log("Scene initialized successfully.");
    return scene; // Return the fully initialized scene
}

// Setup lighting for the scene
function setupLighting() {
    if (!scene) return; // Add guard
    const hemisphericLight = new BABYLON.HemisphericLight(
        "hemisphericLight",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    hemisphericLight.intensity = CONFIG.SCENE.LIGHT_INTENSITY;
}

// Optimize scene for performance
function optimizeScene() {
    if (!scene || scene.isDisposed) {
        console.warn("optimizeScene called but scene is not ready or disposed.");
        return;
    }
    scene.useConstantAnimationDeltaTime = true;


    // Use aggressive performance mode if available
    if (BABYLON.ScenePerformancePriority) {
        scene.performancePriority = BABYLON.ScenePerformancePriority.Aggressive;
    }

    

    // Disable unnecessary features
    scene.skipPointerMovePicking = true;
    scene.skipFrustumClipping = false; // Default
    scene.blockMaterialDirtyMechanism = true; // Prevents material updates when not needed


    // ADDED OPTIMIZATIONS:
    scene.blockfreeActiveMeshesAndRenderingGroups = true;
    if (scene.renderingManager) {
        scene.renderingManager.maintainStateBetweenFrames = true;
    }

    // Optimize mesh rendering - Check if currentSplatMesh exists
    if (currentSplatMesh) {
        optimizeSplatMesh(currentSplatMesh);
    }

    console.log("Scene base optimizations applied.");
}


function setupFrustumCullingObserver(sceneInstance) {
    // Remove existing observer
    if (frustumCullObserver) {
        sceneInstance.onBeforeRenderObservable.remove(frustumCullObserver);
        frustumCullObserver = null;
    }

    // PERFORMANCE BOOST: More efficient and less frequent frustum culling
    let frustumCheckCount = 0;
    let lastVisibilityState = true;
    
    // Cache for bounding info and spheres
    const boundingCache = new Map();
    
    // Device capability detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isLowEndDevice = isMobile && (
        /iPhone\s(5|6|7|8|SE)|Android.*SM-G9|Android.*GT-/i.test(navigator.userAgent) || 
        (window.screen.width * window.screen.height < 1000000)
    );
    
    frustumCullObserver = sceneInstance.onBeforeRenderObservable.add(() => {
        // Dynamic interval based on device capability and movement state
        // More aggressive skipping on mobile and low-end devices
        let checkInterval;
        
        if (isLowEndDevice) {
            checkInterval = window.joystickActive || window.isConsideredMoving ? 12 : 60;
        } else if (isMobile) {
            checkInterval = window.joystickActive || window.isConsideredMoving ? 8 : 45;
        } else {
            checkInterval = window.joystickActive || window.isConsideredMoving ? 5 : 30;
        }
        
        // Skip checks based on determined interval
        if (++frustumCheckCount % checkInterval !== 0) return;
        
        // Quick bail if dependencies missing
        if (!currentSplatMesh || !camera || camera.isDisposed) return;
        
        // Get or calculate bounding info and sphere 
        let boundingInfo, boundingSphere;
        
        // Check cached bounding info first
        if (boundingCache.has(currentSplatMesh.uniqueId)) {
            const cachedData = boundingCache.get(currentSplatMesh.uniqueId);
            boundingInfo = cachedData.boundingInfo;
            boundingSphere = cachedData.boundingSphere;
        } 
        // Then check for pre-cached bounding info on the mesh itself
        else if (currentSplatMesh._cachedBoundingInfo) {
            boundingInfo = currentSplatMesh._cachedBoundingInfo;
            // Extract sphere from the bounding info
            boundingSphere = boundingInfo.boundingSphere;
            
            // Cache it for future use
            boundingCache.set(currentSplatMesh.uniqueId, {
                boundingInfo: boundingInfo,
                boundingSphere: boundingSphere
            });
        } 
        // Last resort: calculate fresh bounding info
        else if (currentSplatMesh.getBoundingInfo) {
            boundingInfo = currentSplatMesh.getBoundingInfo();
            boundingSphere = boundingInfo.boundingSphere;
            
            // Cache for future use
            boundingCache.set(currentSplatMesh.uniqueId, {
                boundingInfo: boundingInfo,
                boundingSphere: boundingSphere
            });
            
            // Also store on mesh for emergency fallback
            currentSplatMesh._cachedBoundingInfo = boundingInfo;
        } else {
            // Cannot determine bounding info, assume visible
            if (lastVisibilityState !== true) {
                currentSplatMesh.isVisible = true;
                lastVisibilityState = true;
            }
            return;
        }
        
        // First do a quick sphere-frustum check
        const inFrustum = camera.isInFrustum(boundingSphere);
        
        // Only update visibility when it changes (saves on state changes)
        if (lastVisibilityState !== inFrustum) {
            currentSplatMesh.isVisible = inFrustum;
            lastVisibilityState = inFrustum;
            
            if (CONFIG?.DEBUG?.ENABLE_LOGGING) {
                console.log(`Visibility changed for ${currentSplatMesh.name}: ${inFrustum ? 'visible' : 'hidden'}`);
            }
        }
        
        // For large scenes with many meshes, periodically clear the cache to avoid memory buildup
        // We don't need this for a single splat mesh, but it's good practice for scalability
        if (frustumCheckCount > 1000) {
            boundingCache.clear();
            frustumCheckCount = 0;
        }
    });
    
    // Store observer reference globally for cleanup during scene disposal
    return frustumCullObserver;
}

// Load default assets (splat and collider)
async function loadDefaultAssets() {
    // No changes needed here, but ensure it uses the global `scene` correctly
    // try/catch block remains important
    try {
        showLoadingIndicator(CONFIG.LOADING.DEFAULT_MESSAGE);
        await loadSplat(); // This assigns currentSplatMesh
        const colliderLoaded = await loadCollider();

        if (!colliderLoaded && currentSplatMesh) {
            currentSplatMesh.checkCollisions = true;
            // Don't freeze world matrix if it needs to be pickable for basic collision? Revisit this.
            // If using splat mesh itself for collision, it likely shouldn't be frozen entirely.
            // currentSplatMesh.freezeWorldMatrix(); // Maybe remove if using for collision
            console.warn("No collider loaded, using splat mesh bounds for basic collision.");
            updateColliderStatus(false);
        } else if (colliderLoaded) {
             updateColliderStatus(true);
        } else {
             console.warn("Neither collider nor splat mesh available for collision.");
             updateColliderStatus(false); // Indicate no collision
        }

        return true; // Indicate success
    } catch (error) {
        console.error("Default assets loading error:", error);
        showError(`Failed to load default assets: ${error.message || error}`);
        return false; // Indicate failure
    }
    // finally block removed as it's handled in initScene
}

// Load Splat (Ensure currentSplatMesh is assigned)

// Load Splat (Ensure currentSplatMesh is assigned)


// Load Splat (Ensure currentSplatMesh is assigned)
async function loadSplat() {
    if (!scene) {
        console.error("loadSplat: Scene is not defined.");
        return false;
    }
    try {
        showLoadingIndicator(CONFIG.LOADING.SPLAT_MESSAGE);

        // Enhanced cleanup for previous splat mesh
        if (currentSplatMesh) {
            // Record materials before disposal for dedicated cleanup
            const materialsToDispose = [];
            
            // Collect materials from the mesh and its children
            const collectMaterials = (mesh) => {
                if (mesh.material && !materialsToDispose.includes(mesh.material)) {
                    materialsToDispose.push(mesh.material);
                }
                if (mesh.getChildMeshes) {
                    mesh.getChildMeshes().forEach(collectMaterials);
                }
            };
            
            collectMaterials(currentSplatMesh);
            
            // First dispose the mesh with its vertex/index buffers
            currentSplatMesh.dispose(true, true); // disposeMaterialAndTextures=true, doNotRecurse=true
            
            // Now explicitly dispose any collected materials
            materialsToDispose.forEach(material => {
                if (material.dispose) {
                    // Dispose all textures first
                    if (material.getActiveTextures) {
                        const textures = material.getActiveTextures();
                        textures.forEach(texture => {
                            if (texture && texture.dispose) {
                                texture.dispose();
                            }
                        });
                    }
                    // Then dispose the material itself
                    material.dispose();
                }
            });
            
            // Null the reference to allow GC
            currentSplatMesh = null;
            
            // Force scene to release unused resources
            scene.releaseResourcesOfMesh = true;
            if (scene.cleanCachedTextureBuffer) {
                scene.cleanCachedTextureBuffer();
            }
            
            // Free any pending WebGL resources
            BABYLON.Tools.FreePendingResources();
            
            // Attempt to trigger GC
            if (window.gc) {
                setTimeout(() => { 
                    window.gc();
                }, 100); // Brief delay to let rendering cycle complete
            }
            
            // For mobile, add an extra memory management step
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile && engine && !engine.isDisposed) {
                // Reduce texture memory by temporarily lowering engine resolution
                const originalHardwareScaling = engine.getHardwareScalingLevel();
                engine.setHardwareScalingLevel(Math.max(originalHardwareScaling, 2.0)); // Use at least 50% reduction
                
                // Allow one render cycle at reduced resolution
                await new Promise(resolve => {
                    scene.executeWhenReady(() => {
                        engine.resize(); // Force a resize to apply scaling
                        setTimeout(() => {
                            // Restore original resolution
                            engine.setHardwareScalingLevel(originalHardwareScaling);
                            engine.resize();
                            resolve();
                        }, 50);
                    });
                });
            }
            
            console.log("Previous splat mesh and associated resources thoroughly disposed.");
        }

        // Append the splat file to the existing scene
        await BABYLON.SceneLoader.AppendAsync("./", CONFIG.ASSETS.SPLAT_FILE, scene);

        // Find the splat mesh reliably
        // Option 1: Assume known name (best if possible)
        currentSplatMesh = scene.getMeshByName("GaussianSplatting"); // Adjust "GaussianSplatting" to the actual mesh name in your PLY/GLB if known

        // Option 2: Fallback - find the last added mesh that's not __root__ or the collider
        if (!currentSplatMesh) {
            console.warn(`Mesh name "${"GaussianSplatting"}" not found, attempting fallback detection.`);
            const meshes = scene.meshes;
            for (let i = meshes.length - 1; i >= 0; i--) {
                const mesh = meshes[i];
                if (mesh.name !== "__root__" && mesh !== colliderMesh) {
                    // Basic heuristic: Check if it has a material likely used by splats
                    // Or if it has a large vertex count? This is unreliable.
                    // Prefer naming convention if possible.
                    currentSplatMesh = mesh;
                    console.log(`Fallback identified potential splat mesh: ${currentSplatMesh.name}`);
                    break;
                }
            }
        }

        // Ensure Gaussian Splat mesh and its children are not pickable
        if (currentSplatMesh) {
            if (CONFIG.DEBUG.ENABLE_LOGGING) {
                console.log(`Identified splat mesh: ${currentSplatMesh.name}`);
            }

            // Function to set non-pickable recursively
            function setMeshNotPickable(mesh) {
                mesh.isPickable = false;
                mesh.getChildMeshes().forEach(child => {
                    setMeshNotPickable(child);
                });
            }
            setMeshNotPickable(currentSplatMesh);

            // Pre-compute and cache bounding info for faster access
            // We don't clone it since that's not available, but we can still cache a reference
            // This helps avoid recalculating it every frame
            if (currentSplatMesh.getBoundingInfo) {
                currentSplatMesh._cachedBoundingInfo = currentSplatMesh.getBoundingInfo();
            }

            // Optimize the identified splat mesh
            // optimizeSplatMesh(currentSplatMesh); // Called from optimizeScene now

            if (CONFIG.DEBUG.ENABLE_LOGGING) {
                console.log("Gaussian Splat mesh and children set as not pickable.");
            }
        } else {
            console.error("Failed to identify the loaded splat mesh!");
            showError("Error: Could not find the main scene mesh after loading.");
            return false; // Indicate failure
        }

        hideLoadingIndicator(); // Hide indicator after loading
        return true; // Indicate success
    } catch (error) {
        console.error("Splat loading error:", error);
        showError(`Failed to load scene: ${error.message || error}`);
        hideLoadingIndicator(); // Ensure indicator is hidden on error
        return false; // Indicate failure
    }
}


// Optimize Splat Mesh (Dedicated function)
function optimizeSplatMesh(mesh) {
    if (!mesh || mesh.isDisposed) return;

    // Freeze world matrix ONLY if the splat itself will NOT be used for dynamic collision detection
    // If using a separate collider.glb, freezing is generally safe.
    // If using the splat mesh itself for collision, freezing might interfere.
     const useSplatForCollision = !colliderMesh && mesh.checkCollisions;
     if (!useSplatForCollision) {
         mesh.freezeWorldMatrix();
         if (CONFIG.DEBUG.ENABLE_LOGGING) console.log(`Froze world matrix for splat mesh: ${mesh.name}`);
     } else {
          if (CONFIG.DEBUG.ENABLE_LOGGING) console.log(`Skipped freezing world matrix for splat mesh (used for collision): ${mesh.name}`);
     }

    mesh.doNotSyncBoundingInfo = true; // Generally safe
    mesh.alwaysSelectAsActiveMesh = true; // Helps performance sometimes
    mesh.cullingStrategy = BABYLON.AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY; // Good for splats

    if (CONFIG.DEBUG.ENABLE_LOGGING) {
         console.log(`Optimizations applied to splat mesh: ${mesh.name}`);
     }


     // PERFORMANCE BOOST: Lock vertex/index buffers if they won't change
    if (mesh.getTotalVertices && mesh.getTotalVertices() > 0) {
        mesh.doNotSyncBoundingInfo = true;
        mesh.thinInstanceEnablePicking = false;
    }

}


// Load collider file (No changes needed)
async function loadCollider() {
    // ... existing code ...
     if (!scene) {
         console.error("loadCollider: Scene not defined.");
         return false;
     }
     try {
        showLoadingIndicator(CONFIG.LOADING.COLLIDER_MESSAGE);

        // Verify collider exists before loading (optional but good practice)
        const colliderPath = CONFIG.ASSETS.COLLIDER_FILE; // Assuming relative path
        try {
             const response = await fetch(colliderPath, { method: 'HEAD' });
             if (!response.ok) {
                 console.warn(`Collider file not found or accessible at ${colliderPath}. Status: ${response.status}`);
                 return false; // Indicate collider not loaded
             }
         } catch (networkError) {
             console.warn(`Network error checking for collider file ${colliderPath}:`, networkError);
             // Proceed cautiously or return false depending on requirements
             // return false;
         }


        // Load collider GLB using AppendAsync to add to the existing scene
        const result = await BABYLON.SceneLoader.ImportMeshAsync(
            "", "./", colliderPath, scene // Use AppendAsync if merging into existing scene
        );

         // Check if meshes were actually loaded
         if (!result.meshes || result.meshes.length === 0) {
             console.warn("Collider file loaded, but it contained no meshes.");
             return false;
         }

        configureColliderMesh(result); // Configure the loaded meshes
        return true; // Indicate success
    } catch (error) {
        // Handle specific errors like 404 more gracefully if possible
         if (error.message && error.message.includes('404')) {
             console.warn(`Collider file '${CONFIG.ASSETS.COLLIDER_FILE}' not found (404).`);
         } else {
             console.error("Collider loading error:", error);
             showError(`Failed to load collider: ${error.message || error}`);
         }
        hideLoadingIndicator(); // Ensure hidden on error
        return false; // Indicate failure
    }
    // No finally block, handled by caller (initScene)
}

// Configure collider mesh properties (No changes needed)
function configureColliderMesh(importResult) {
    // ... existing code ...
    colliderMesh = null; // Reset before assigning
    importResult.meshes.forEach((mesh, index) => {
        if (mesh.name === "__root__") return; // Skip root nodes often present in GLB

        // Assign the first non-root mesh as the primary collider reference
        if (index === 0 || !colliderMesh) { // Prefer the first mesh as the main reference
             colliderMesh = mesh;
        }

        mesh.isVisible = CONFIG.DEBUG.SHOW_COLLIDERS;
        mesh.isPickable = false;
        mesh.checkCollisions = CONFIG.COLLISION.ENABLED;
        mesh.receiveShadows = false;
        // mesh.material = null; // Setting material to null might cause issues, better to make invisible

        // Optimize collision
        mesh.doNotSyncBoundingInfo = true; // Can improve perf if bounding box doesn't change

        // Configure children recursively
        mesh.getChildMeshes(false, (child) => { // Use false to get direct children only? Or true for all descendants? Depends on collider structure. Let's try true.
            child.isVisible = CONFIG.DEBUG.SHOW_COLLIDERS;
            child.isPickable = false;
            child.checkCollisions = CONFIG.COLLISION.ENABLED;
            child.receiveShadows = false;
            // child.material = null;
            child.doNotSyncBoundingInfo = true;
        });
    });

    if (colliderMesh) {
        // OPTIMIZATION: Freeze collider world matrix if it won't move
        colliderMesh.freezeWorldMatrix();
        // Apply to all children too
        colliderMesh.getChildMeshes().forEach(child => {
            child.freezeWorldMatrix();
        });
    }
}

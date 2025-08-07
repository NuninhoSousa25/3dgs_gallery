// interaction.js - Enhanced mesh interaction handling with improved event management

// Global variables for interactive meshes
let interactiveMeshes = [];
let isArtMeshLoaded = false;
let popupMenu = null;
let currentlySelectedMesh = null;

// Initialize interactions
function initInteractions() {
    // Clean up any existing interactions to prevent duplicates
    cleanupInteractions();
    
    // Create popup menu
    createPopupMenu();
    
    // Load art meshes if not already loaded
    if (!isArtMeshLoaded) {
        // Load the initial art mesh from config
        const artFile = CONFIG?.ASSETS?.DEFAULT_ART_FILE; // <<< CHANGE: Get filename from config
        const artPath = CONFIG?.ASSETS?.ART_ASSETS_PATH || "./assets/art/"; // Use configured path

        if (artFile) {
            loadArtMesh(artFile, artPath); // <<< CHANGE: Pass path as well
        } else {
            console.warn("No default art file specified in CONFIG.ASSETS.DEFAULT_ART_FILE. Skipping initial art load.");
            // Optionally hide loading indicator if shown for art loading specifically
            // hideLoadingIndicator();
        }
    }

    if (CONFIG.DEBUG.ENABLE_LOGGING) {
        console.log("Interaction system initialized");
    }
}

// Cleanup function to remove event listeners and reset state
function cleanupInteractions() {
    // Remove all interaction-related event listeners
    EventManager.removeCategory('interaction');
    
    // Remove popup if it exists
    if (popupMenu && popupMenu.parentNode) {
        popupMenu.parentNode.removeChild(popupMenu);
        popupMenu = null;
    }
    
    // Reset state
    currentlySelectedMesh = null;
}

// Create enhanced popup menu element
function createPopupMenu() {
    // If popup already exists, remove it to prevent duplicates
    if (popupMenu && popupMenu.parentNode) {
        popupMenu.parentNode.removeChild(popupMenu);
    }
    
    // Create popup container
    popupMenu = document.createElement('div');
    popupMenu.className = 'popup-menu';
    
    // Create structured content for the popup
    popupMenu.innerHTML = `
        <button class="popup-close"><i class="fas fa-times"></i></button>
        <div class="popup-title">Art Information</div>
        <div class="popup-content">
            <div class="art-details">
                <div class="art-info-row">
                    <span class="art-info-label">Artist:</span>
                    <span class="art-info-artist">Unknown</span>
                </div>
                <div class="art-info-row">
                    <span class="art-info-label">Year:</span>
                    <span class="art-info-year">Unknown</span>
                </div>
                <div class="art-info-row">
                    <span class="art-info-label">Medium:</span>
                    <span class="art-info-medium">Unknown</span>
                </div>
                <div class="art-description">
                    Click on art to view information.
                </div>
            </div>
        </div>
    `;

    // MEMORY OPTIMIZATION: Cache DOM references for future updates
    popupMenu._titleElement = popupMenu.querySelector('.popup-title');
    popupMenu._descriptionElement = popupMenu.querySelector('.art-description');
    popupMenu._artistElement = popupMenu.querySelector('.art-info-artist');
    popupMenu._yearElement = popupMenu.querySelector('.art-info-year');
    popupMenu._mediumElement = popupMenu.querySelector('.art-info-medium');
    
    // Add close button event listener using EventManager
    const closeButton = popupMenu.querySelector('.popup-close');
    if (closeButton) {
        EventManager.addListener('interaction', closeButton, 'click', hidePopup);
    }
    
    // Add to DOM
    document.body.appendChild(popupMenu);
    
    // MEMORY OPTIMIZATION: Use event delegation for click detection outside popup
    // This creates a single listener instead of multiple
    EventManager.addListener('interaction', document, 'pointerdown', (event) => {
        // Don't close if clicking inside the popup
        if (popupMenu.contains(event.target)) return;
        
        // Close the popup when clicking anywhere outside
        hidePopup();
    });
}

// Load art mesh from file
async function loadArtMesh(fileName, basePath = "./assets/art/") { // <<< CHANGE: Added basePath parameter with default
    try {
        showLoadingIndicator(`Loading ${fileName}...`);

        // Load the art mesh using base path and filename
        const result = await BABYLON.SceneLoader.ImportMeshAsync(
            "", basePath, fileName, scene // <<< CHANGE: Use basePath
        );

        // Configure art mesh for interaction
        configureArtMesh(result);
        isArtMeshLoaded = true; // Mark true only after successful load and config

        if (CONFIG.DEBUG.ENABLE_LOGGING) {
            console.log(`Art mesh ${fileName} loaded successfully`);
        }

    } catch (error) {
        console.error(`Art mesh loading error (${fileName}):`, error);
        showError(`Failed to load art mesh ${fileName}: ${error.message || error}`);
        isArtMeshLoaded = false; // Ensure flag is false on error
    } finally {
        hideLoadingIndicator();
    }
}

// Configure art mesh properties
function configureArtMesh(importResult) {
    // Initialize the scene's ActionManager if it doesn't exist
    if (!scene.actionManager) {
        scene.actionManager = new BABYLON.ActionManager(scene);
    }

    // MEMORY OPTIMIZATION: Dispose previous mesh action managers before creating new ones
    interactiveMeshes.forEach(mesh => {
        if (mesh?.actionManager) { 
            mesh.actionManager.dispose();
        }
    });
    
    // Reset the array instead of creating a new one
    interactiveMeshes.length = 0; 

    // MEMORY OPTIMIZATION: Reuse this vector for material caching
    const emissiveCache = new BABYLON.Color3(0, 0, 0);

    importResult.meshes.forEach(mesh => {
        // Skip root node
        if (mesh.name === "__root__") return;

        // Make mesh interactive
        mesh.isPickable = true;

        // MEMORY OPTIMIZATION: Use direct property instead of creating objects
        mesh.isArtMesh = true;

        // Add to our list of interactive meshes
        interactiveMeshes.push(mesh);

        // Setup action manager for the mesh
        setupMeshActionManager(mesh, emissiveCache);

        if (CONFIG.DEBUG.ENABLE_LOGGING) {
            console.log(`Configured art mesh for interaction: ${mesh.name}`);
        }
        
        // MEMORY OPTIMIZATION: Apply mesh-specific optimizations
        // Freeze world matrix if the art doesn't move
        if (!mesh.getChildren().length) { // Only freeze if no children
            mesh.freezeWorldMatrix();
        }
        
        // Reduce memory usage for static meshes
        if (mesh.material) {
            mesh.doNotSyncBoundingInfo = true;
            
            // Optimize material if possible
            if (!mesh.material.needsUpdate) {
                mesh.material.freeze();
            }
            
            // Cache vertex data for faster rendering
            if (mesh.geometry) {
                mesh.geometry.doNotExportNormals = true;
            }
        }
    });
}

// Setup action manager for a specific mesh
// Optimized mesh action manager setup
function setupMeshActionManager(mesh) {
    // Clean up existing action manager if present
    if (mesh.actionManager) {
        mesh.actionManager.dispose();
    }
    
    // Create new action manager
    mesh.actionManager = new BABYLON.ActionManager(scene);
    
    // Register OnPickTrigger action
    mesh.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
            BABYLON.ActionManager.OnPickTrigger,
            function(evt) {
                // Get the mesh that was clicked
                const pickedMesh = evt.source;
                
                // Log the click
                if (CONFIG.DEBUG.ENABLE_LOGGING) {
                    console.log(`Clicked on mesh via ActionManager: ${pickedMesh.name}`);
                }
                
                // Set as currently selected mesh
                currentlySelectedMesh = pickedMesh;
                
                // Show popup for this mesh
                showPopupForMesh(pickedMesh, evt);
            }
        )
    );
    
    // MEMORY OPTIMIZATION: Store original emissive color by value not reference
    if (mesh.material && mesh.material.emissiveColor) {
        // Store a new Color3 with the same values instead of trying to use copyToRef
        mesh.originalEmissive = new BABYLON.Color3(
            mesh.material.emissiveColor.r,
            mesh.material.emissiveColor.g,
            mesh.material.emissiveColor.b
        );
    } else {
        mesh.originalEmissive = new BABYLON.Color3(0, 0, 0);
    }
    
    // Add hover effect
    mesh.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
            BABYLON.ActionManager.OnPointerOverTrigger,
            function(evt) {
                // Check if mesh has a material
                if (mesh.material) {
                    // Highlight mesh with subtle glow - create a new color instead of using copyToRef
                    mesh.material.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.3);
                    
                    // Change cursor
                    document.body.style.cursor = 'pointer';
                }
            }
        )
    );
    
    // Remove hover effect
    mesh.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
            BABYLON.ActionManager.OnPointerOutTrigger,
            function(evt) {
                // Restore original emissive color
                if (mesh.material && mesh.originalEmissive) {
                    // Create a new color from the original values instead of using copyToRef
                    mesh.material.emissiveColor = new BABYLON.Color3(
                        mesh.originalEmissive.r,
                        mesh.originalEmissive.g,
                        mesh.originalEmissive.b
                    );
                }
                
                // Restore cursor
                document.body.style.cursor = 'default';
            }
        )
    );
}

// Show popup for a specific mesh
function showPopupForMesh(mesh, evt) {
    if (!popupMenu) return;
    
    // Get art information for this mesh
    const artInfo = getArtInfo(mesh.name);
    
    // MEMORY OPTIMIZATION: Use cached DOM references for fast updates
    // This avoids expensive querySelector calls on every interaction
    popupMenu._titleElement.textContent = artInfo.title || 'Untitled Artwork';
    popupMenu._descriptionElement.textContent = artInfo.description || 'No description available.';
    popupMenu._artistElement.textContent = artInfo.artist || 'Unknown';
    popupMenu._yearElement.textContent = artInfo.year || 'Unknown';
    popupMenu._mediumElement.textContent = artInfo.medium || 'Unknown';
    
    // Position popup at the current mouse position
    positionPopupAtPointer({
        event: {
            clientX: scene.pointerX,
            clientY: scene.pointerY
        }
    });
    
    // Show popup
    popupMenu.classList.add('active');
}


// Position popup near the pointer location
function positionPopupAtPointer(pointerInfo) {
    if (!popupMenu) return;
    
    // MEMORY OPTIMIZATION: Skip display/hide dance if already displaying
    const isCurrentlyVisible = popupMenu.classList.contains('active');
    const needsTemporaryDisplay = !isCurrentlyVisible;
    
    // Get screen dimensions
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Get pointer position
    const x = pointerInfo.event.clientX;
    const y = pointerInfo.event.clientY;
    
    // Get popup dimensions (temporarily show if needed)
    if (needsTemporaryDisplay) {
        popupMenu.style.display = 'block';
        popupMenu.style.opacity = '0';
    }
    
    const popupWidth = popupMenu.offsetWidth;
    const popupHeight = popupMenu.offsetHeight;
    
    if (needsTemporaryDisplay) {
        popupMenu.style.display = '';
        popupMenu.style.opacity = '';
    }
    
    // Calculate position to keep popup on screen
    let posX = x + 15; // Offset slightly from cursor
    let posY = y + 15;
    
    // Adjust if popup would go off right edge
    if (posX + popupWidth > screenWidth - 10) {
        posX = x - popupWidth - 10;
    }
    
    // Adjust if popup would go off bottom edge
    if (posY + popupHeight > screenHeight - 10) {
        posY = y - popupHeight - 10;
    }
    
    // Ensure popup doesn't go off left or top
    posX = Math.max(10, posX);
    posY = Math.max(10, posY);
    
    // MEMORY OPTIMIZATION: Batch style updates for better performance
    // This prevents intermediate layout recalculations
    requestAnimationFrame(() => {
        popupMenu.style.left = posX + 'px';
        popupMenu.style.top = posY + 'px';
    });
}

// Hide popup - exposed globally for access from other modules
function hidePopup() {
    if (!popupMenu) return;
    popupMenu.classList.remove('active');
}

// Export hidePopup to window for access from other modules
window.hidePopup = hidePopup;

// Specifically disable picking for Gaussian Splat meshes
function disableGaussianSplatPicking() {
    if (!currentSplatMesh) return;
    
    currentSplatMesh.isPickable = false;
    
    // Apply recursively to all children
    const makeNonPickable = (mesh) => {
        mesh.isPickable = false;
        mesh.getChildMeshes().forEach(makeNonPickable);
    };
    
    currentSplatMesh.getChildMeshes().forEach(makeNonPickable);
    
    if (CONFIG.DEBUG.ENABLE_LOGGING) {
        console.log("Disabled picking for Gaussian Splat mesh");
    }
}

// Dispose function to clean up resources and prevent memory leaks
function disposeInteractions() {
    // MEMORY OPTIMIZATION: More aggressive cleanup
    
    // Clean up event listeners
    EventManager.removeCategory('interaction');
    
    // Clean up meshes with proper resource release
    interactiveMeshes.forEach(mesh => {
        if (mesh) {
            if (mesh.actionManager) {
                mesh.actionManager.dispose();
                mesh.actionManager = null;
            }
            
            // Clear custom properties
            mesh.isArtMesh = false;
            
            // Release color references
            if (mesh.originalEmissive) {
                mesh.originalEmissive = null;
            }
            
            // Don't dispose the mesh itself as it's part of the scene
        }
    });
    
    // Reset arrays and references with proper nullification
    interactiveMeshes.length = 0; // Clear array without creating new one
    currentlySelectedMesh = null;
    
    // Remove popup with proper cleanup
    if (popupMenu) {
        if (popupMenu.parentNode) {
            popupMenu.parentNode.removeChild(popupMenu);
        }
        
        // Clear cached element references
        popupMenu._titleElement = null;
        popupMenu._descriptionElement = null; 
        popupMenu._artistElement = null;
        popupMenu._yearElement = null;
        popupMenu._mediumElement = null;
        
        popupMenu = null;
    }
    
    isArtMeshLoaded = false;
    
    // Force a garbage collection hint if available
    if (window.gc) {
        setTimeout(() => {
            window.gc();
        }, 100);
    }
}

// Expose cleanup method globally
window.disposeInteractions = disposeInteractions;
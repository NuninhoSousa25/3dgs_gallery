# 3D Gaussian Splatting Gallery

A high-performance web-based 3D Gaussian Splatting viewer with interactive art gallery features, built using Babylon.js. This application provides an immersive way to explore 3D scenes with dynamic resolution scaling, collision detection, and interactive art objects.

## ✨ Features

### Core Functionality
- **3D Gaussian Splatting Rendering**: High-quality splat-based scene rendering
- **Interactive Art Gallery**: Click/tap on art objects to view detailed information
- **Dynamic Resolution Scaling (DRS)**: Automatic quality adjustment based on camera movement
- **Manual Quality Controls**: Full control over rendering resolution (Full/High/Medium/Low)
- **Collision Detection**: Walk-through navigation with realistic boundaries
- **Mobile-Optimized**: Touch controls and responsive design

### Navigation & Controls
- **Desktop Controls**: WASD/Arrow keys for movement, mouse for camera look
- **Mobile Support**: Virtual joystick with touch-optimized interface
- **Keyboard Shortcuts**:
  - `J` - Toggle virtual joystick
  - `F` - Toggle fullscreen
  - `Esc` - Close panels/popups

### Performance Features
- **Adaptive Rendering**: Automatic quality adjustment during movement
- **Frustum Culling**: Optimized rendering for better performance
- **Memory Management**: Efficient resource cleanup and garbage collection
- **Device Detection**: Automatic optimization based on device capabilities

## 🚀 Quick Start

### Prerequisites
- Modern web browser with WebGL 2.0 support
- Web server (local or remote) to serve files
- 3D scene files (PLY format for Gaussian Splats, GLB for colliders/art)

### Installation
1. Clone or download this repository
2. Place your 3D scene files in the project directory:
   - `scene.ply` - Your Gaussian Splat scene
   - `collider.glb` - Collision mesh (optional)
   - `assets/art/art1.glb` - Interactive art objects (optional)
3. Serve the project through a web server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```
4. Open `http://localhost:8000` in your browser

## 📁 Project Structure

```
3dgs_gallery/
├── index.html              # Main HTML file
├── scene.ply              # Gaussian Splat scene (your file)
├── collider.glb           # Collision mesh (optional)
├── css/
│   ├── style.css          # Main styles
│   ├── popup.css          # Art popup styles
│   └── manual-lod-style.css # Settings panel styles
├── js/
│   ├── main.js            # Application entry point
│   ├── config.js          # Configuration settings
│   ├── scene.js           # Scene and asset management
│   ├── camera.js          # Camera controls
│   ├── ui.js              # User interface
│   ├── manual-lod.js      # Resolution controls & DRS
│   ├── interaction.js     # Art object interactions
│   ├── joystick.js        # Virtual joystick
│   ├── art-descriptions.js # Art object data
│   └── event-manager.js   # Event handling
└── assets/
    └── art/
        └── art1.glb       # Interactive art objects
```

## ⚙️ Configuration

### Basic Settings
Edit `js/config.js` to customize:

```javascript
const CONFIG = {
    CAMERA: {
        INITIAL_POSITION: [0, 1.7, -20],  // Starting camera position
        SPEED: 0.175,                      // Movement speed
        FOV: 55                            // Field of view
    },
    ASSETS: {
        SPLAT_FILE: "scene.ply",           // Your scene file
        COLLIDER_FILE: "collider.glb",     // Collision mesh
        DEFAULT_ART_FILE: "art1.glb"       // Interactive art
    },
    COLLISION: {
        ENABLED: true,                     // Enable collision detection
        ELLIPSOID: [0.45, 0.34, 0.45]     // Collision bounds
    }
};
```

### Adding Art Objects
1. Place GLB files in `assets/art/`
2. Update `js/art-descriptions.js`:

```javascript
const ART_DESCRIPTIONS = {
    "your_mesh_name": {
        title: "Artwork Title",
        artist: "Artist Name",
        year: "2024",
        medium: "Digital Art",
        description: "Detailed description of the artwork..."
    }
};
```

## 🎮 Controls & Features

### Dynamic Resolution Scaling (DRS)
- **Auto Mode**: Automatically reduces quality during movement for smooth performance
- **Manual Presets**: 
  - Full (100%) - Best quality
  - High (75%) - Balanced
  - Medium (50%) - Better performance
  - Low (35%) - Maximum performance

### Camera Controls
- **Movement**: WASD keys or arrow keys
- **Look**: Mouse drag to rotate camera
- **Mobile**: Touch and drag, virtual joystick for movement

### Interface Panels
- **Settings**: Resolution controls and performance options
- **Info**: Control instructions and system status
- **Art Popup**: Detailed information when clicking art objects

## 🔧 Advanced Usage

### Custom Scene Files
Replace `scene.ply` with your own Gaussian Splat file. The viewer supports standard PLY format splats.

### Collision Meshes
Create a simplified collision mesh in Blender:
1. Model basic geometry matching your scene layout
2. Export as GLB format
3. Name it `collider.glb`

### Performance Tuning
Adjust these settings in `config.js`:
- `CAMERA.SPEED` - Movement speed
- `SCENE.DEFAULT_PIXEL_RATIO` - Starting quality
- `COLLISION.ELLIPSOID` - Player collision size

## 📱 Mobile Optimization

The application automatically optimizes for mobile devices:
- Touch-friendly interface
- Virtual joystick controls
- Adaptive performance settings
- Responsive design

## 🐛 Troubleshooting

### Common Issues
1. **Black screen**: Ensure files are served via HTTP/HTTPS, not file://
2. **No collision**: Verify `collider.glb` exists and `COLLISION.ENABLED` is true
3. **Poor performance**: Try lower resolution settings or enable Dynamic mode
4. **Art objects not clickable**: Check mesh names in `art-descriptions.js`

### Performance Issues
- Enable Dynamic Resolution Scaling for automatic optimization
- Use lower manual quality presets on older devices
- Ensure collision mesh is low-poly for better performance

## 🏗️ Development

### Dependencies
- Babylon.js (loaded via CDN)
- Font Awesome icons (loaded via CDN)
- Modern ES6+ browser support

### Extending Functionality
The modular architecture allows easy extension:
- Add new art objects by updating `art-descriptions.js`
- Modify UI in respective CSS files
- Extend camera controls in `camera.js`
- Add new panels to `ui.js`

### Event Management
The application uses a centralized `EventManager` to prevent memory leaks and manage all event listeners efficiently.

## 📄 License

This project is open source. Please ensure you have appropriate licenses for any 3D assets you use.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

---

**Note**: This viewer requires 3D scene files to function. You'll need to provide your own Gaussian Splat (PLY) files and any associated collision/art assets.

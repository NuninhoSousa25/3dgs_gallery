// art-descriptions.js - Data for art objects and their descriptions

const ART_DESCRIPTIONS = {
    // Format: "meshName": { title: "Display Title", description: "Detailed description text" }
    
    // Example existing art piece
    "pavel": {
        title: "Modern Sculpture",
        description: "A contemporary sculpture created in 2023 by artist Jane Doe. This piece explores themes of technology and nature through its unique geometric forms and organic textures.",
        artist: "Jane Doe",
        year: "2023",
        medium: "Mixed media"
    },
    
    // Additional art pieces - add your own art objects here
    "gafanhoto": {
        title: "Abstract Horizon",
        description: "This vibrant painting uses bold colors and dynamic brushstrokes to create an abstract interpretation of a sunset over water. The artist's use of contrasting warm and cool tones creates a sense of depth and movement.",
        artist: "John Smith",
        year: "2021",
        medium: "Acrylic on canvas"
    },
    
    "Installation01": {
        title: "Digital Echo",
        description: "An interactive installation that responds to viewer movement. As you approach this piece, notice how the light patterns shift and change. This work explores the relationship between human presence and digital environments.",
        artist: "Maya Chen",
        year: "2024",
        medium: "Interactive digital installation"
    },
    
    "Statue01": {
        title: "Contemplation",
        description: "A bronze statue depicting a seated figure in quiet reflection. The smooth, simplified forms invite viewers to project their own emotions onto the piece. The slight tilt of the head suggests attentive listening.",
        artist: "Robert Williams",
        year: "2019",
        medium: "Bronze"
    },
    
    "PhotoFrame01": {
        title: "Urban Perspectives",
        description: "A series of black and white photographs capturing unusual viewpoints of familiar city landmarks. The dramatic angles and stark contrasts encourage viewers to see these everyday structures in a new light.",
        artist: "Sarah Johnson",
        year: "2022",
        medium: "Digital photography"
    },
    
    "Textile01": {
        title: "Woven Memories",
        description: "This intricate textile piece combines traditional weaving techniques with contemporary materials. The varying textures and patterns create a tactile landscape that invites close inspection.",
        artist: "Elena Rodriguez",
        year: "2020",
        medium: "Mixed fiber arts"
    }
};

// Helper function to get art info by name
// Handles different naming formats (with parent nodes, etc.)
function getArtInfo(meshName) {
    // Try direct lookup first
    if (ART_DESCRIPTIONS[meshName]) {
        return ART_DESCRIPTIONS[meshName];
    }
    
    // Try to extract the name if it includes parent nodes (format: "parent|child")
    if (meshName.includes('|')) {
        const simpleName = meshName.split('|').pop().trim();
        if (ART_DESCRIPTIONS[simpleName]) {
            return ART_DESCRIPTIONS[simpleName];
        }
    }
    
    // For mesh names that might have numeric suffixes
    for (const key in ART_DESCRIPTIONS) {
        // Check if the mesh name starts with any of our known art pieces
        // This handles cases like "Sculpture01_primitive0" etc.
        if (meshName.startsWith(key) || meshName.includes(key)) {
            return ART_DESCRIPTIONS[key];
        }
    }
    
    // Return a default if no match is found
    return {
        title: "Untitled Artwork",
        description: "Information about this piece is not available.",
        artist: "Unknown",
        year: "Unknown",
        medium: "Unknown"
    };
}

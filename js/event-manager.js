// event-manager.js - Centralized event management to prevent memory leaks

// Store all event listeners for easy cleanup
const EventManager = {
    // Store registered listeners by category for organization and selective removal
    listeners: {
        window: [],
        document: [],
        canvas: [],
        ui: [],
        joystick: [],
        custom: []
    },
    
    /**
     * Add an event listener and track it for later removal
     * @param {string} category - Category for organization (window, document, ui, etc.)
     * @param {EventTarget} element - DOM element to attach listener to
     * @param {string} eventType - Event type (click, keydown, etc.)
     * @param {Function} handler - Event handler function
     * @param {Object|boolean} options - Event listener options
     * @returns {Object} Reference to the registered listener for manual removal
     */
    addListener: function(category, element, eventType, handler, options = false) {
        if (!element || !eventType || !handler) {
            console.error('EventManager: Missing required parameters');
            return null;
        }
        
        if (!this.listeners[category]) {
            this.listeners[category] = [];
        }
        
        // Attach the event listener
        element.addEventListener(eventType, handler, options);
        
        // Store reference for later removal
        const listener = { element, eventType, handler, options };
        this.listeners[category].push(listener);
        
        return listener;
    },
    
    /**
     * Remove a specific event listener
     * @param {Object} listener - Listener reference returned by addListener
     */
    removeListener: function(listener) {
        if (!listener || !listener.element) return;
        
        listener.element.removeEventListener(
            listener.eventType, 
            listener.handler, 
            listener.options
        );
        
        // Remove from all categories
        Object.keys(this.listeners).forEach(category => {
            const index = this.listeners[category].indexOf(listener);
            if (index !== -1) {
                this.listeners[category].splice(index, 1);
            }
        });
    },
    
    /**
     * Remove all event listeners in a specific category
     * @param {string} category - Category to clean up
     */
    removeCategory: function(category) {
        if (!this.listeners[category]) return;
        
        this.listeners[category].forEach(listener => {
            listener.element.removeEventListener(
                listener.eventType, 
                listener.handler, 
                listener.options
            );
        });
        
        this.listeners[category] = [];
    },
    
    /**
     * Remove all registered event listeners
     */
    removeAll: function() {
        Object.keys(this.listeners).forEach(category => {
            this.removeCategory(category);
        });
    },
    
    /**
     * Get count of listeners by category for debugging
     * @returns {Object} Counts by category
     */
    getCounts: function() {
        const counts = {};
        Object.keys(this.listeners).forEach(category => {
            counts[category] = this.listeners[category].length;
        });
        return counts;
    }
};

// Expose globally so it can be accessed from all modules
window.EventManager = EventManager;

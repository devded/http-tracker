/**
 * HTTP Tracker Plus - Service Worker (Manifest V3)
 * 
 * This is the entry point for the background service worker.
 * Service workers are ephemeral and don't have DOM access.
 */

// Import required scripts
importScripts(
    '/src/js/httpTrackerConstants.js',
    '/src/js/httpTrackerUtils.js',
    '/src/js/httpTrackerOpen.js'
);

// Log service worker activation for debugging
console.log('HTTP Tracker Plus Service Worker initialized');

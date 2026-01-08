/**
 * HTTP Tracker Plus - Shared Utilities Module
 * 
 * Common utility functions used across the extension.
 * This module consolidates duplicated code and provides reusable helpers.
 */

const httpTrackerHelpers = (function () {

    // Debug mode - set to true for console output
    const DEBUG_MODE = false;

    /**
     * Conditional logging - only outputs if DEBUG_MODE is true
     * @param {...any} args - Arguments to log
     */
    function log(...args) {
        if (DEBUG_MODE) {
            console.log('[HTTP Tracker]', ...args);
        }
    }

    /**
     * Conditional warning - only outputs if DEBUG_MODE is true
     * @param {...any} args - Arguments to log
     */
    function warn(...args) {
        if (DEBUG_MODE) {
            console.warn('[HTTP Tracker]', ...args);
        }
    }

    /**
     * Conditional error - always outputs (errors are important)
     * @param {...any} args - Arguments to log
     */
    function error(...args) {
        console.error('[HTTP Tracker]', ...args);
    }

    /**
     * Creates a debounced version of a function
     * @param {Function} fn - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(fn, delay = 300) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /**
     * Creates a throttled version of a function
     * @param {Function} fn - Function to throttle
     * @param {number} limit - Minimum time between calls in milliseconds
     * @returns {Function} Throttled function
     */
    function throttle(fn, limit = 100) {
        let inThrottle = false;
        return function (...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Get status code color classes based on HTTP status code
     * @param {number|string} statusCode - HTTP status code or 'ERR'
     * @returns {string} Tailwind CSS classes for the status color
     */
    function getStatusColorClasses(statusCode) {
        if (statusCode === 'ERR' || statusCode >= 400) {
            return 'text-red-400 bg-red-900 bg-opacity-20';
        } else if (statusCode >= 300) {
            return 'text-yellow-400 bg-yellow-900 bg-opacity-20';
        } else {
            return 'text-green-400 bg-green-900 bg-opacity-20';
        }
    }

    /**
     * Get method color class based on HTTP method
     * @param {string} method - HTTP method (GET, POST, etc.)
     * @returns {string} Tailwind CSS class for the method color
     */
    function getMethodColorClass(method) {
        const colors = {
            'GET': 'text-green-400',
            'POST': 'text-blue-400',
            'PUT': 'text-yellow-400',
            'PATCH': 'text-orange-400',
            'DELETE': 'text-red-400',
            'HEAD': 'text-purple-400',
            'OPTIONS': 'text-gray-400'
        };
        return colors[method] || 'text-gray-400';
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>} True if successful
     */
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            error('Failed to copy to clipboard:', err);
            return false;
        }
    }

    /**
     * Format bytes to human readable string
     * @param {number} bytes - Number of bytes
     * @param {number} decimals - Number of decimal places
     * @returns {string} Formatted string (e.g., "1.5 KB")
     */
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
    }

    /**
     * Format duration in milliseconds to human readable string
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted string (e.g., "1.5s" or "150ms")
     */
    function formatDuration(ms) {
        if (ms >= 1000) {
            return (ms / 1000).toFixed(2) + 's';
        }
        return Math.round(ms) + 'ms';
    }

    /**
     * Check if a string is valid JSON
     * @param {string} str - String to check
     * @returns {boolean} True if valid JSON
     */
    function isValidJson(str) {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Pretty print JSON with error handling
     * @param {string} str - JSON string
     * @returns {string} Pretty printed JSON or original string if invalid
     */
    function prettyPrintJson(str) {
        try {
            return JSON.stringify(JSON.parse(str), null, 2);
        } catch (e) {
            return str;
        }
    }

    // Public API
    return {
        log,
        warn,
        error,
        debounce,
        throttle,
        getStatusColorClasses,
        getMethodColorClass,
        escapeHtml,
        copyToClipboard,
        formatBytes,
        formatDuration,
        isValidJson,
        prettyPrintJson,
        DEBUG_MODE
    };
})();

/**
 * HTTP Tracker Plus - Firefox Response Filter Module
 * Uses webRequest.filterResponseData for Firefox browsers to capture response bodies.
 */

const firefoxResponseTracker = (function () {
    const b = httpTracker.browser;

    // Use conditional logging helper if available, fallback to no-op
    const log = (typeof httpTrackerHelpers !== 'undefined')
        ? httpTrackerHelpers.log
        : function () { };
    const warn = (typeof httpTrackerHelpers !== 'undefined')
        ? httpTrackerHelpers.warn
        : function () { };

    function init() {
        if (!httpTracker.isFF) return; // Only run on Firefox

        log('Firefox Response Tracker: Initializing');

        b.webRequest.onBeforeRequest.addListener(
            captureResponse,
            { urls: ["<all_urls>"] },
            ["blocking"]
        );
    }

    function captureResponse(details) {
        // Only capture if it's not a dummy request and if capture is enabled
        // Note: The global checkbox value is checked in eventTracker.insertResponseBodyByUrl

        // Skip if not a regular request (e.g. internal extension requests)
        if (details.tabId === -1) return {};

        try {
            const filter = b.webRequest.filterResponseData(details.requestId);
            const chunks = [];

            filter.ondata = (event) => {
                chunks.push(event.data);
                filter.write(event.data); // Pass data through unchanged
            };

            filter.onstop = () => {
                filter.disconnect();

                if (chunks.length === 0) return;

                // Combine chunks
                const totalLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
                const combined = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of chunks) {
                    combined.set(new Uint8Array(chunk), offset);
                    offset += chunk.byteLength;
                }

                // Try to decode as text
                try {
                    const decoder = new TextDecoder('utf-8');
                    const body = decoder.decode(combined);
                    log('Firefox Response Tracker: Captured body for', details.url, 'length:', body.length);
                    eventTracker.insertResponseBodyByUrl(details.url, body, false);
                } catch (e) {
                    warn('Firefox Response Tracker: Failed to decode body for', details.url);
                    eventTracker.insertResponseBodyByUrl(details.url, null, true); // Likely binary
                }
            };

            filter.onerror = () => {
                filter.disconnect();
            };
        } catch (e) {
            // filterResponseData might fail for some requests (e.g. already closed)
            // or if the URL is not permitted (though manifest should cover it)
        }

        return {}; // Don't block
    }

    return {
        init: init
    };
})();

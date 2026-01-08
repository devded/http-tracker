/**
 * HTTP Tracker Plus - Declarative Net Request Module (MV3)
 * 
 * This module handles URL blocking and header modification using
 * the declarativeNetRequest API instead of blocking webRequest listeners.
 */

const httpTrackerDNR = (function () {
    // Rule ID counters - keep separate ranges for different rule types
    const BLOCK_RULE_ID_START = 1;
    const HEADER_RULE_ID_START = 10000;

    // All resource types for rule conditions
    const ALL_RESOURCE_TYPES = [
        "main_frame", "sub_frame", "stylesheet", "script", "image",
        "font", "object", "xmlhttprequest", "ping", "csp_report",
        "media", "websocket", "webtransport", "webbundle", "other"
    ];

    /**
     * Update blocking rules based on the block URLs list
     * @param {Array<string>} blockURLsList - Array of URL patterns to block
     */
    async function updateBlockingRules(blockURLsList) {
        try {
            // Get existing session rules
            const existingRules = await chrome.declarativeNetRequest.getSessionRules();

            // Find and remove existing blocking rules (IDs < HEADER_RULE_ID_START)
            const blockingRuleIds = existingRules
                .filter(rule => rule.id < HEADER_RULE_ID_START)
                .map(rule => rule.id);

            // Build new blocking rules
            const newRules = [];
            if (blockURLsList && blockURLsList.length > 0) {
                blockURLsList.forEach((pattern, index) => {
                    if (pattern && pattern.trim().length > 0) {
                        newRules.push({
                            id: BLOCK_RULE_ID_START + index,
                            priority: 1,
                            action: { type: "block" },
                            condition: {
                                urlFilter: `*${pattern.trim()}*`,
                                resourceTypes: ALL_RESOURCE_TYPES
                            }
                        });
                    }
                });
            }

            // Update session rules
            await chrome.declarativeNetRequest.updateSessionRules({
                removeRuleIds: blockingRuleIds,
                addRules: newRules
            });

            console.log(`[DNR] Updated blocking rules: ${newRules.length} rules active`);
        } catch (error) {
            console.error('[DNR] Error updating blocking rules:', error);
        }
    }

    /**
     * Update header modification rules
     * @param {Array<Object>} headersList - Array of header objects {name, value, url?}
     * @param {Array<string>} includeURLs - URL patterns to include
     * @param {Array<string>} excludeURLs - URL patterns to exclude
     */
    async function updateHeaderModificationRules(headersList, includeURLs, excludeURLs) {
        try {
            // Get existing session rules
            const existingRules = await chrome.declarativeNetRequest.getSessionRules();

            // Find and remove existing header modification rules (IDs >= HEADER_RULE_ID_START)
            const headerRuleIds = existingRules
                .filter(rule => rule.id >= HEADER_RULE_ID_START)
                .map(rule => rule.id);

            // Build new header modification rules
            const newRules = [];
            if (headersList && headersList.length > 0) {
                headersList.forEach((header, index) => {
                    if (header && header.name && header.value !== undefined) {
                        const rule = {
                            id: HEADER_RULE_ID_START + index,
                            priority: 1,
                            action: {
                                type: "modifyHeaders",
                                requestHeaders: [{
                                    header: header.name,
                                    operation: "set",
                                    value: header.value
                                }]
                            },
                            condition: {
                                resourceTypes: ALL_RESOURCE_TYPES
                            }
                        };

                        // Add URL filter if header has specific URL pattern
                        if (header.url && header.url.trim().length > 0) {
                            rule.condition.urlFilter = `*${header.url.trim()}*`;
                        } else if (includeURLs && includeURLs.length > 0) {
                            // If there are global include patterns, use the first one
                            rule.condition.urlFilter = `*${includeURLs[0].trim()}*`;
                        }

                        // Note: DNR doesn't support exclude patterns directly per rule
                        // For complex exclude logic, multiple rules would be needed

                        newRules.push(rule);
                    }
                });
            }

            // Update session rules
            await chrome.declarativeNetRequest.updateSessionRules({
                removeRuleIds: headerRuleIds,
                addRules: newRules
            });

            console.log(`[DNR] Updated header modification rules: ${newRules.length} rules active`);
        } catch (error) {
            console.error('[DNR] Error updating header modification rules:', error);
        }
    }

    /**
     * Clear all DNR session rules
     */
    async function clearAllRules() {
        try {
            const existingRules = await chrome.declarativeNetRequest.getSessionRules();
            const ruleIds = existingRules.map(rule => rule.id);

            if (ruleIds.length > 0) {
                await chrome.declarativeNetRequest.updateSessionRules({
                    removeRuleIds: ruleIds
                });
            }

            console.log('[DNR] All rules cleared');
        } catch (error) {
            console.error('[DNR] Error clearing rules:', error);
        }
    }

    /**
     * Get current active rules (for debugging)
     */
    async function getActiveRules() {
        try {
            return await chrome.declarativeNetRequest.getSessionRules();
        } catch (error) {
            console.error('[DNR] Error getting rules:', error);
            return [];
        }
    }

    // Public API
    return {
        updateBlockingRules,
        updateHeaderModificationRules,
        clearAllRules,
        getActiveRules
    };
})();

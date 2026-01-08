# Manifest V3 Migration Plan

The project currently uses Manifest V2, which is deprecated in Chrome. To run on the latest versions, we must migrate to Manifest V3.

## User Review Required
> [!IMPORTANT]
> **Blocking Logic Change**: Manifest V3 removes the ability to use blocking `webRequest` listeners. We will replace this with the `declarativeNetRequest` API.
> **State Persistence**: The background script will be converted to a Service Worker, which is ephemeral. We will ensure the main UI window (`http-tracker.html`) maintains the application state as it currently does.

## Proposed Changes

### Manifest Configuration
#### [MODIFY] [manifest.json](file:///Users/smdedar/Downloads/Workspace/untitled folder/http-tracker/manifest.json)
- Update `manifest_version` to `3`.
- Replace `background.scripts` with `background.service_worker`.
- Rename `browser_action` to `action`.
- Remove `webRequestBlocking` permission.
- Add `declarativeNetRequest` and `declarativeNetRequestWithHostAccess` permissions.
- Update `host_permissions`.

### Background Scripts
#### [NEW] [httpTrackerServiceWorker.js](file:///Users/smdedar/Downloads/Workspace/untitled folder/http-tracker/src/js/httpTrackerServiceWorker.js)
- Create a new Service Worker file that imports `httpTrackerOpen.js` (and dependencies) to handle opening the extension window.
- Ensure no DOM access is used in the background.

#### [MODIFY] [httpTrackerOpen.js](file:///Users/smdedar/Downloads/Workspace/untitled folder/http-tracker/src/js/httpTrackerOpen.js)
- Adapt for Service Worker context if necessary (likely just works as it uses extension APIs).

### Blocking & Modification Logic
#### [MODIFY] [httpTrackerDomEvents.js](file:///Users/smdedar/Downloads/Workspace/untitled folder/http-tracker/src/js/httpTrackerDomEvents.js)
- Remove `blocking` option from `webRequest` listeners.
- Remove calls to `blockRequests` and `addModifyRequestHeaders` inside listeners (as they can no longer block/modify).
- Keep listeners for **Logging** purposes only.

#### [NEW] [httpTrackerDNR.js](file:///Users/smdedar/Downloads/Workspace/untitled folder/http-tracker/src/js/httpTrackerDNR.js)
- Implement `declarativeNetRequest` logic to handle:
    - URL Blocking (converting `blockURLSList` to DNR rules).
    - Header Modification (converting `addModifyRequestHeadersList` to DNR rules).
- This script will be loaded in the UI (`http-tracker.html`) and update session rules whenever the user configures them.

#### [MODIFY] [httpTrackerUtils.js](file:///Users/smdedar/Downloads/Workspace/untitled folder/http-tracker/src/js/httpTrackerUtils.js)
- Update `blockRequests` and `addModifyRequestHeaders` (or their setters) to call the new `httpTrackerDNR` logic to update session rules instead of just setting in-memory arrays.

### UI Context
#### [MODIFY] [http-tracker.html](file:///Users/smdedar/Downloads/Workspace/untitled folder/http-tracker/src/html/http-tracker.html)
- Include `httpTrackerDNR.js`.

## Verification Plan

### Automated Tests
- None available.

### Manual Verification
1.  **Install**:
    -   Load the extension in Chrome (Developer Mode -> Load Unpacked).
    -   Verify no errors are shown (especially `webRequestBlocking` errors).
2.  **Functionality**:
    -   Open the Tracker window.
    -   **Blocking**: Add a blocking pattern (e.g., `google.com`). Browse to that site. Verify request is blocked.
    -   **Header Mod**: Add a request header (e.g., `X-Test: 123`). Browse to a site. Verify header is present (using the tracker itself or another tool/Echo endpoint).
    -   **Logging**: Ensure requests still appear in the list.

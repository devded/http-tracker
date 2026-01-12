const bringToFront = {
  focused: true,
};

// MV3: Use runtime.getURL instead of deprecated extension.getURL
// Also make this a function since we can't call runtime.getURL at module load time in Service Worker
function getCreateWindowProperties() {
  return {
    type: 'popup',
    url: httpTracker.browser.runtime.getURL(httpTracker.PAGE_PATH),
    state: httpTracker.isFF ? 'maximized' : 'normal',
  };
}

// open the addon options window, or if already opened, bring to front preventing multiple windows
function openAddonOptions() {
  httpTracker.browser.windows.getAll({
    'populate': true,
  }, getAddonOptions);
}

function getAddonOptions(details) {
  let existingWindow;
  if (details.length > 0) {
    details.some((eachWindow) => {
      if (eachWindow.tabs && eachWindow.tabs.some((tab) => tab.url.includes('/src/html/options.html'))) {
        existingWindow = eachWindow;
      }
    });
  }
  if (existingWindow) {
    httpTracker.browser.tabs.query({
      'windowId': existingWindow.id,
      'url': httpTracker.browser.runtime.getURL('/src/html/options.html'),
    }, function (tabs) {
      if (tabs && tabs.length == 1) {
        httpTracker.browser.windows.update(
          existingWindow.id, {
          focused: true,
        },
        );
        httpTracker.browser.tabs.update(tabs[0].id, {
          active: true,
        });
      }
    });
  } else {
    const optionsUrl = 'options.html';
    try {
      if (httpTracker && httpTracker.browser && httpTracker.browser.runtime && httpTracker.browser.runtime.openOptionsPage) {
        // Try to open using the standard API first
        httpTracker.browser.runtime.openOptionsPage().catch((err) => {
          // Fallback for browsers/contexts where openOptionsPage fails or isn't supported
          window.open(optionsUrl);
        });
      } else {
        window.open(optionsUrl);
      }
    } catch (e) {
      // Final fallback if everything else fails
      window.open(optionsUrl);
    }
  }
}

// open the addon window, or if already opened, bring to front preventing multiple windows
function openAddon() {
  httpTracker.browser.windows.getAll({
    'populate': true,
  }, getAddonWindow);
}

function getAddonWindow(details) {
  httpTracker.browser.storage.sync.get([httpTracker.STORAGE_KEY_OPEN_ADDON_IN_TAB], function (cbResponseParams) {
    const value = getPropertyFromStorage(cbResponseParams, httpTracker.STORAGE_KEY_OPEN_ADDON_IN_TAB);
    if (value === undefined) {
      setPropertyToStorage(httpTracker.STORAGE_KEY_OPEN_ADDON_IN_TAB, false);
    }
    if (value) {
      openInTab(details);
    } else {
      openInPopWindow(details);
    }
  });
}

function openInTab(details) {
  const existingWindow = getExistingAddonWindow(details);
  if (existingWindow) {
    httpTracker.browser.tabs.query({
      'windowId': existingWindow.id,
      'url': httpTracker.browser.runtime.getURL(httpTracker.PAGE_PATH),
    }, function (tabs) {
      if (tabs && tabs.length == 1) {
        httpTracker.browser.windows.update(
          existingWindow.id, {
          focused: true,
        },
        );
        httpTracker.browser.tabs.update(tabs[0].id, {
          active: true,
        });
      }
    });
  } else {
    httpTracker.browser.tabs.create({
      'url': httpTracker.browser.runtime.getURL(httpTracker.PAGE_PATH),
    });
  }
}

function getExistingAddonWindow(details) {
  let existingWindow;
  if (details.length > 0) {
    details.some((eachWindow) => {
      if (eachWindow.tabs && eachWindow.tabs.some((tab) => tab.url.includes(httpTracker.PAGE_PATH))) {
        existingWindow = eachWindow;
      }
    });
  }
  return existingWindow;
}

function openInPopWindow(details) {
  const existingWindow = getExistingAddonWindow(details);
  if (existingWindow) {
    httpTracker.browser.windows.get(existingWindow.id, focusExistingWindow);
  } else {
    httpTracker.browser.windows.create(getCreateWindowProperties());
  }
}

function focusExistingWindow(addOnWindowDetails) {
  if (httpTracker.browser.runtime.lastError) {
    onError(httpTracker.browser.runtime.lastError);
  } else if (addOnWindowDetails) {
    httpTracker.browser.windows.update(addOnWindowDetails.id, bringToFront);
  } else {
    createNewAddonPopup();
  }
}

// MV3: Use action API instead of browserAction
httpTracker.browser.action.setTitle({
  'title': getManifestDetails().title,
});

httpTracker.browser.action.onClicked.addListener(openAddon);

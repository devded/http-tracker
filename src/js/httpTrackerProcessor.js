const eventTracker = (function () {
  const addedRequestId = [];
  const allRequestHeaders = new Map();
  const allResponseHeaders = new Map();
  let captureFormDataCheckboxValue = false;
  let captureResponseBodyCheckboxValue = false;
  const decoder = new TextDecoder('UTF-8');
  const inputBoxDelay = 500;
  let filterPatternsToExcludeTimeout = null;
  let setPatternsToBlockTimeout = null;
  let filterPatternsToIncludeTimeout = null;
  let filterPatternsToMaskTimeout = null;
  let filterWithKey = '';
  let filterWithValue = '';
  let filterWithValueTimeout = null;
  let globalExcludeURLsList;
  let globalIncludeURLsList;
  let globalMaskPatternsList;
  let maskAttributesCheckboxValue = false;
  let maskedAttributesList;
  let optimizeResponseCookies;
  const requestFormData = new Map();
  const responseBodyData = new Map();
  const requestIdRedirectCount = new Map();
  let selectedWebEventRequestId = '';
  let toggleCaptureEvents = true;
  let findPatterns = '';
  let findPatternsTimeout = null;
  let multipleSearchPatterns = '';
  let isANDFilter = false;
  let selectedDomain = '';

  const CLASS_LIST_TO_ADD = `web_event_list_blank flex items-center px-4 py-2 hover:bg-gray-800 cursor-pointer transition-colors group border-b border-gray-800`;
  const HEADER_CONTENT_BANNER = `<div class="section-banner general-banner">General Info</div><div class="headers-container">`;
  const COOKIE_CONTENT_BANNER = `</div><div class="section-banner cookie-banner">Cookies</div><div class="headers-container">`;
  const COOKIE_CONTENT_BANNER_OPTIMIZED = `</div><div class="section-banner cookie-banner">Cookies (Optimized)</div><div class="headers-container">`;
  const COOKIE_CONTENT_BANNER_UNOPTIMIZED = `</div><div class="section-banner cookie-banner">Cookies (Raw)</div><div class="headers-container">`;
  const RESPONSE_BODY_BANNER = `</div><div class="section-banner response-body-banner">Response Body</div>`;
  const ignoreHeaders = ['frameAncestors', 'frameId', 'parentFrameId', 'tabId', 'timeStamp', 'type', 'callerName', 'requestIdEnhanced', 'requestId'];
  const REQUEST_NOT_AVAILABLE = `<div class="text-gray-500 italic text-sm p-4 text-center">Request data not available</div>`;
  const RESPONSE_NOT_AVAILABLE = `<div class="text-gray-500 italic text-sm p-4 text-center">Response data not available</div>`;
  const HEADER_CONTENT_KEY = `<div class="header-row"><div class="header-key">`;
  const HEADER_CONTENT_VALUE = `</div><div class="header-value">`;

  async function logRequestDetails(webEvent) {
    const inserted = insertEventUrls(webEvent);
    if (inserted) {
      addOrUpdateUrlListToPage(webEvent);
      displaySelectedEventDetails(webEvent);
    }
  }

  function insertEventUrls(webEvent) {
    const captureEvent = toggleCaptureEvents && isEventToCapture(webEvent);
    if (captureEvent) {
      setRedirectCount(webEvent);
      actionOnBeforeRequest(webEvent);
      actionOnBeforeSendHeaders(webEvent);
      actionOnSendHeaders(webEvent);
      actionOnBeforeRedirect(webEvent);
      actionOnAuthRequired(webEvent);
      actionOnHeadersReceived(webEvent);
      actionOnResponseStarted(webEvent);
      actionOnCompleted(webEvent);
      actionOnErrorOccurred(webEvent);
      return true;
    }
    return false;
  }

  function setRedirectCount(webEvent) {
    let redirectCount = requestIdRedirectCount.get(webEvent.requestId); // this value can be undefined here
    if (redirectCount === undefined) {
      redirectCount = 0;
      requestIdRedirectCount.set(webEvent.requestId, redirectCount);
    } else if (redirectCount) {
      webEvent.requestIdEnhanced = `${webEvent.requestId}_${redirectCount}`;
    }
  }

  function actionOnBeforeRequest(webEvent) {
    if (webEvent.callerName === 'onBeforeRequest') {
      insertRequestBody(webEvent);
      if (captureResponseBodyCheckboxValue && webEvent.tabId !== -1) {
        debuggerTracker.attachToTab(webEvent.tabId);
      }
    }
  }

  function actionOnBeforeSendHeaders(webEvent) {
    if (webEvent.callerName === 'onBeforeSendHeaders') {
      insertRequestHeaders(webEvent);
    }
  }

  function actionOnSendHeaders(webEvent) {
    if (webEvent.callerName === 'onSendHeaders') {
      insertRequestHeaders(webEvent);
    }
  }

  function actionOnBeforeRedirect(webEvent) {
    if (webEvent.callerName === 'onBeforeRedirect') {
      // A defect in latest FF versions (tested on 79.0)
      // Firefox starts onBeforeRedirect without actual headers as below, and don't capture anything during this process. If the redirect response is as below, it means response headers are on the way. So wait till all the response headers are completed
      // this issue does not exist in chrome
      // {
      //   "method": "GET",
      //   "redirectUrl": "blah/blah/blah",
      //   "url": "blah/blah",
      //   "urlClassification": "firstParty: [], thirdParty: []"
      // }
      if (webEvent.ip) { // webEvent.ip && webEvent.statusCode && webEvent.statusLine && webEvent.redirectUrl
        let redirectCount = requestIdRedirectCount.get(webEvent.requestId);
        requestIdRedirectCount.set(webEvent.requestId, ++redirectCount);
        insertResponseHeaders(webEvent);
      }
    }
  }

  function actionOnAuthRequired(webEvent) {
    if (webEvent.callerName === 'onAuthRequired') {
      insertResponseHeaders(webEvent);
    }
  }

  function actionOnHeadersReceived(webEvent) {
    if (webEvent.callerName === 'onHeadersReceived') {
      insertResponseHeaders(webEvent);
    }
  }

  function actionOnResponseStarted(webEvent) {
    if (webEvent.callerName === 'onResponseStarted') {
      insertResponseHeaders(webEvent);
    }
  }

  function actionOnCompleted(webEvent) {
    if (webEvent.callerName === 'onCompleted') {
      insertResponseHeaders(webEvent);
    }
  }

  function actionOnErrorOccurred(webEvent) {
    if (webEvent.callerName === 'onErrorOccurred') {
      insertResponseHeaders(webEvent);
    }
  }

  /**
   * find out whether the event to be captured or not
   * excludeURLsList always takes precedence
   */
  function isEventToCapture(webEvent) {
    const captureEventInclude = urlMatchIncludePattern(webEvent);
    const captureEventExclude = captureEventInclude ? urlMatchExcludePattern(webEvent) : true;
    return (captureEventInclude && !captureEventExclude);
  }

  function urlMatchIncludePattern(webEvent) {
    if (webEvent.requestIdEnhanced.includes('fakeRequest')) {
      return false;
    }
    if (!includeURLsList && !globalIncludeURLsList) {
      return true;
    }
    let found = false;
    if (includeURLsList && includeURLsList.length) {
      found = includeURLsList.some((v) => webEvent.url.toLowerCase().includes(v));
    }
    if (!found && globalIncludeURLsList && globalIncludeURLsList.length) {
      found = globalIncludeURLsList.some((v) => webEvent.url.toLowerCase().includes(v));
    } {
      return found;
    }
  }

  function urlMatchExcludePattern(webEvent) {
    let toExclude = false;
    if (excludeURLsList) {
      toExclude = excludeURLsList.some((v) => webEvent.url.toLowerCase().includes(v.toLowerCase()));
    } else if (!toExclude && globalExcludeURLsList) {
      toExclude = globalExcludeURLsList.some((v) => webEvent.url.toLowerCase().includes(v.toLowerCase()));
    }
    return toExclude;
  }

  function maskFieldsPattern(value) {
    let masking = false;
    if (maskAttributesCheckboxValue) {
      if (maskedAttributesList) {
        masking = maskedAttributesList.some((v) => value.toLowerCase().includes(v));
      }
      if (!masking && globalMaskPatternsList) {
        masking = globalMaskPatternsList.some((v) => value.toLowerCase().includes(v));
      }
    }
    return masking;
  }

  /**
   * populate the events list by adding or updating existing one
   */
  function addOrUpdateUrlListToPage(webEvent) {
    if (addedRequestId.indexOf(webEvent.requestIdEnhanced) === -1) {
      addEventList(webEvent);
    } else {
      updateEventList(webEvent);
    }
    filterEventList(webEvent);
  }

  function addEventList(webEvent) {
    addedRequestId.push(webEvent.requestIdEnhanced);
    const containerContent = '<div title=\'Click to view details\' class=\'' + CLASS_LIST_TO_ADD + '\' id=\'web_events_list_' + webEvent.requestIdEnhanced + '\'>' +
      generateSTATUSContent(webEvent) +
      generateMETHODContent(webEvent) +
      generateURLContent(webEvent) +
      generateDATETIMEContent(webEvent) +
      generateCACHEContent(webEvent) +
      '</div>';
    getById('urls_list').insertAdjacentHTML('afterbegin', containerContent);
  }

  function updateEventList(webEvent) {
    const row = getById(`web_events_list_${webEvent.requestIdEnhanced}`);
    if (!row) return;

    if (webEvent.callerName === 'onErrorOccurred') {
      // row.classList.add('bg-red-900', 'bg-opacity-10'); // Optional row highlight
      getById(`web_event_status_${webEvent.requestIdEnhanced}`).innerHTML = `<span class="bg-red-900 bg-opacity-20 text-red-400 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-tighter">${STRING_ERROR}</span>`;
    } else if (webEvent.statusCode) {
      // row.classList.remove('bg-red-900', 'bg-opacity-10');
      const statusColor = webEvent.statusCode >= 400 ? 'text-red-400 bg-red-900 bg-opacity-20' : (webEvent.statusCode >= 300 ? 'text-yellow-400 bg-yellow-900 bg-opacity-20' : 'text-green-400 bg-green-900 bg-opacity-20');
      getById(`web_event_status_${webEvent.requestIdEnhanced}`).innerHTML = `<span class="${statusColor} px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tighter">${webEvent.statusCode}</span>`;
    }
  }

  function filterEventList(webEvent) {
    if (multipleSearchPatterns.length) {
      const type = getById('web_event_filter_key').selectedOptions[0].innerText;
      let value = '';
      if (type === 'CACHE') {
        value = webEvent.fromCache ? webEvent.fromCache : 'N/A';
      }
      if (type === 'METHOD') {
        value = webEvent.method;
      }
      if (type === 'STATUS') {
        value = `${(webEvent.statusCode ? webEvent.statusCode : webEvent.error ? STRING_ERROR : 'N/A')}`;
      }
      if (type === 'URL') {
        value = webEvent.url;
      }
      if (type === 'DATE') {
        value = `${(webEvent.timeStamp ? getReadableDate(webEvent.timeStamp) : 'N/A')}`;
      }
      if (!value.toString().toLowerCase().includes(filterWithValue)) {
        getById(`web_events_list_${webEvent.requestIdEnhanced}`).classList.add('web_event_list_hide');
      } else {
        getById(`web_events_list_${webEvent.requestIdEnhanced}`).classList.remove('web_event_list_hide');
      }
    }
  }

  function generateURLContent(webEvent) {
    return `<div class="flex-grow min-w-0 px-3 truncate text-sm font-medium text-gray-300 group-hover:text-white transition-colors" id="web_event_url_${webEvent.requestIdEnhanced}">${webEvent.url}</div>`;
  }

  function generateMETHODContent(webEvent) {
    // Use helper if available, fallback to inline
    const methodColor = (typeof httpTrackerHelpers !== 'undefined')
      ? httpTrackerHelpers.getMethodColorClass(webEvent.method)
      : (webEvent.method === 'POST' ? 'text-blue-400' : 'text-green-400');
    return `<div class="flex-shrink-0 w-16 text-center text-[10px] font-black ${methodColor} tracking-tighter ml-2" id="web_event_method_${webEvent.requestIdEnhanced}">${webEvent.method}</div>`;
  }

  function generateSTATUSContent(webEvent) {
    const status = webEvent.statusCode ? webEvent.statusCode : webEvent.error ? STRING_ERROR : '...';
    // Use helper if available, fallback to inline
    const statusColor = (typeof httpTrackerHelpers !== 'undefined')
      ? httpTrackerHelpers.getStatusColorClasses(status)
      : (status >= 400 || status === STRING_ERROR ? 'text-red-400 bg-red-900 bg-opacity-20' : (status >= 300 ? 'text-yellow-400 bg-yellow-900 bg-opacity-20' : 'text-green-400 bg-green-900 bg-opacity-20'));
    return `<div class="flex-shrink-0 w-16 flex justify-center" id="web_event_status_${webEvent.requestIdEnhanced}"><span class="${statusColor} px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tighter">${status}</span></div>`;
  }

  function generateDATETIMEContent(webEvent) {
    const timeStr = webEvent.timeStamp ? new Date(webEvent.timeStamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A';
    return `<div class="flex-shrink-0 w-20 text-right text-[10px] text-gray-500 mono" id="web_event_time_${webEvent.requestIdEnhanced}">${timeStr}</div>`;
  }

  function generateCACHEContent(webEvent) {
    return ``; // Hidden in main list
  }

  function getReadableDate(timestamp) {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }

  function insertRequestBody(webEvent) {
    if (webEvent.requestBody && captureFormDataCheckboxValue) {
      requestFormData.set(webEvent.requestIdEnhanced, webEvent.requestBody);
    }
  }

  function insertRequestHeaders(webEvent) {
    if (webEvent.requestHeaders) {
      allRequestHeaders.set(webEvent.requestIdEnhanced, webEvent);
    }
  }

  function insertResponseHeaders(webEvent) {
    allResponseHeaders.set(webEvent.requestIdEnhanced, webEvent);
  }

  // Store response body by URL since DevTools and WebRequest use different ID systems
  function insertResponseBodyByUrl(url, body, isBase64) {
    console.log('insertResponseBodyByUrl called for URL:', url, 'body length:', body?.length);
    if (captureResponseBodyCheckboxValue) {
      if (isBase64) {
        responseBodyData.set(url, BINARY_RESPONSE_MESSAGE);
      } else {
        responseBodyData.set(url, body);
      }
      console.log('responseBodyData now has', responseBodyData.size, 'entries');

      // Check if the currently selected event matches this URL
      if (selectedWebEventRequestId) {
        const currentEvent = allRequestHeaders.get(selectedWebEventRequestId);
        if (currentEvent && currentEvent.url === url) {
          console.log('URL matches selected event, refreshing display');
          displayEventProperties();
        }
      }
    }
  }

  function displaySelectedEventDetails(webEvent) {
    if (selectedWebEventRequestId && webEvent.requestIdEnhanced === selectedWebEventRequestId) {
      displayEventProperties();
    }
  }

  /**
   *  display selected event details, or update the already selected event details
   *  get the request details, response details, request form data
   *  build the request container, response container
   */
  function displayEventProperties() {
    const webEventIdRequest = allRequestHeaders.get(selectedWebEventRequestId);
    const webEventIdResponse = allResponseHeaders.get(selectedWebEventRequestId);
    const webEventIdRequestForm = requestFormData.get(selectedWebEventRequestId);

    // Retrieve body using the URL from the event object
    let webEventIdResponseBody;
    if (webEventIdRequest && webEventIdRequest.url) {
      webEventIdResponseBody = responseBodyData.get(webEventIdRequest.url);
      console.log('displayEventProperties: Looking for body with URL:', webEventIdRequest.url, 'found:', !!webEventIdResponseBody);
    }

    const requestContainer = buildURLDetailsContainer(webEventIdRequest, 'requestDetails');
    const responseContainer = buildURLDetailsContainer(webEventIdResponse, 'responseDetails');
    const responseBodyContainer = buildResponseBodyContainer(webEventIdResponseBody);
    const requestFormContainer = buildRequestFormContainer(webEventIdRequestForm);

    getById('request_headers_details').innerHTML = requestContainer + requestFormContainer;
    getById('response_headers_details').innerHTML = responseContainer + responseBodyContainer;

    // Modern UI toggles
    const container = getById('web_details_selected_container');
    const emptyState = getById('details_empty_state');

    if (container && emptyState) {
      container.classList.remove('opacity-0', 'invisible', 'hidden');
      container.classList.add('visible', 'opacity-100');
      emptyState.classList.add('hidden');
    }
  }

  function deleteCookiesForSelectedDomain() {
    cookiesList = httpTracker.browser.cookies.getAll({
      domain: getById('delete_cookies').value,
    }, removeCookies);
  }

  function buildURLDetailsContainer(webEventIdDetails, detailsType) {
    let tableContent = '';
    let headersContent = '';
    if (webEventIdDetails) {
      tableContent = HEADER_CONTENT_BANNER;
      Object.entries(webEventIdDetails).forEach(([key, value]) => {
        if (key !== 'responseHeaders' && key !== 'requestHeaders') { // headers added by browser
          if (!ignoreHeaders.includes(key) && value !== undefined && value !== null) {
            if (typeof value !== 'object') {
              tableContent += generateHeaderKeyValueContent(key, value);
            } else {
              let content = '';
              Object.entries(value).forEach(([k, v]) => {
                content += `${k}: ${JSON.stringify(v)}, `;
              });
              content = content.substring(0, content.length - 2); // removing last ", " from the above loop
              tableContent += generateHeaderKeyValueContent(key, content);
            }
          }
        } else { // application headers
          const headers = sortJsonByProperty(value, 'name');
          headersContent = generateHeaderDetails(headers);
        }
      });
    } else if (detailsType === 'responseDetails') {
      tableContent = RESPONSE_NOT_AVAILABLE;
    } else {
      tableContent = REQUEST_NOT_AVAILABLE;
    }
    return tableContent + headersContent + '</div>';  // Close the last headers-container
  }

  function generateHeaderKeyValueContent(key, value) {
    if (maskFieldsPattern(key)) {
      value = value.toString().trim();
      if (value.length) {
        value = value.charAt(0) + '*****' + value.charAt(value.length - 1);
      }
    }

    // Escape HTML in values to prevent XSS and rendering issues
    const escapeHtml = (str) => {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    const escapedKey = escapeHtml(key);
    const escapedValue = escapeHtml(value);

    return `<div class="header-row">
        <div class="header-key" title="${escapedKey}">${addMarkTag(escapedKey)}</div>
        <div class="header-value" title="${escapedValue}">${addMarkTag(escapedValue)}</div>
      </div>`;
  }

  function addMarkTag(text) {
    if (findPatterns.length) {
      const findStr = new RegExp(findPatterns, 'gi');
      const markedText = text.toString().replace(findStr, (match) => `<mark>${match}</mark>`);
      return markedText;
    }
    return text;
  }

  function buildRequestFormContainer(webEventIdRequestForm) {
    let formData = '';
    if (webEventIdRequestForm) {
      if (webEventIdRequestForm.formData) {
        formData = `<div class="section-banner request-body-banner">Request Body (Form Data)</div><div class="headers-container">`;
        Object.entries(webEventIdRequestForm.formData).forEach(([key, value]) => {
          formData += generateHeaderKeyValueContent(key, value);
        });
        formData += '</div>';
      } else if (webEventIdRequestForm.raw) {
        formData = `<div class="section-banner request-body-banner">Request Body</div>`;
        for (const eachByte of webEventIdRequestForm.raw) {
          const dataView = new DataView(eachByte.bytes);
          let decodedString = decoder.decode(dataView);

          // Try to beautify and syntax highlight JSON
          let isJson = false;
          try {
            const json = JSON.parse(decodedString);
            decodedString = JSON.stringify(json, null, 2);
            isJson = true;
          } catch (e) {
            // Not JSON, keep as is
          }

          if (isJson) {
            formData += `<div class="json-viewer">${syntaxHighlightJson(decodedString)}</div>`;
          } else {
            formData += `<div class="body-preview">${addMarkTag(escapeHtmlGlobal(decodedString))}</div>`;
          }
        }
      }
    }
    return formData;
  }

  // Global HTML escape function
  function escapeHtmlGlobal(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Syntax highlight JSON with colors inspired by Insomnia
  function syntaxHighlightJson(json) {
    // Escape HTML first
    json = escapeHtmlGlobal(json);

    // Apply syntax highlighting
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^"]|[^\\"])*")(\s*:)?|(\btrue\b|\bfalse\b|\bnull\b)|(-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      function (match, str, _, colon, bool, num) {
        let cls = 'json-number'; // numbers
        if (str) {
          if (colon) {
            cls = 'json-key'; // keys
          } else {
            cls = 'json-string'; // string values
          }
        } else if (bool) {
          cls = 'json-boolean'; // booleans
        } else if (num) {
          cls = 'json-number'; // numbers
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  }

  function buildResponseBodyContainer(responseBody) {
    let bodyData = '';
    if (responseBody !== undefined) {
      bodyData = RESPONSE_BODY_BANNER;
      if (responseBody.length > MAX_RESPONSE_BODY_SIZE) {
        responseBody = responseBody.substring(0, MAX_RESPONSE_BODY_SIZE) + '\n... [Content Truncated]';
      }

      // Try to beautify and syntax highlight JSON
      let isJson = false;
      try {
        const json = JSON.parse(responseBody);
        responseBody = JSON.stringify(json, null, 2);
        isJson = true;
      } catch (e) {
        // Not JSON, keep as is
      }

      if (isJson) {
        bodyData += `<div class="json-viewer">${syntaxHighlightJson(responseBody)}</div>`;
      } else {
        bodyData += `<div class="body-preview">${addMarkTag(escapeHtmlGlobal(responseBody))}</div>`;
      }
    }
    return bodyData;
  }

  function generateHeaderDetails(headers) {
    let generalHeadersContent = '';
    let banner = COOKIE_CONTENT_BANNER; // request cookies
    let cookieContent = '';
    const optimizedCookiesMap = new Map();
    const unoptimizedCookiesList = [];
    headers.forEach((header) => {
      // request cookies
      if (header.name === DELIMITER_REQUEST_COOKIE_KEY_NAME) {
        cookieContent += generateRequestCookieDetails(header.value, DELIMITER_REQUEST_COOKIE);
      }
      // response cookies
      else if (header.name.toLowerCase() === DELIMITER_RESPONSE_COOKIE_KEY_NAME) {
        if (!optimizeResponseCookies) {
          banner = COOKIE_CONTENT_BANNER_UNOPTIMIZED;
          cookieContent += generateResponseCookieDetails(header.value, DELIMITER_RESPONSE_COOKIE);
        } else {
          banner = COOKIE_CONTENT_BANNER_OPTIMIZED;
          setOptimizedCookiesMap(header.value, DELIMITER_RESPONSE_COOKIE, optimizedCookiesMap);
        }
      }
      // other headers
      else {
        generalHeadersContent += `${HEADER_CONTENT_KEY}${addMarkTag(header.name)}${HEADER_CONTENT_VALUE}${addMarkTag(header.value)}</div></div>`;
      }
    });
    if (optimizeResponseCookies) {
      sortMapByKey(optimizedCookiesMap).forEach((value, key) => {
        cookieContent += `${HEADER_CONTENT_KEY}${addMarkTag(key.split(':', 1))}${HEADER_CONTENT_VALUE}${addMarkTag(value.cookieValue)}</div></div>`;
      });
    }
    if (cookieContent) {
      cookieContent = banner + cookieContent + '</div>';  // Close cookie headers-container
    }
    return generalHeadersContent + cookieContent;
  }

  function generateRequestCookieDetails(cookieValue, cookieDelim) {
    // generally request cookies will not be duplicates
    const cookieList = cookieValue.split(cookieDelim).sort(sortArray);
    let cookieContent = '';
    // convert into map to avoid duplicate cookies though request cookies will not be duplicates
    // the order of cookies will be the order in which they were added to map
    const cookieMap = new Map();
    cookieList.forEach((cookie) => {
      if (cookie) {
        const firstOccurance = cookie.indexOf('=');
        if (firstOccurance > -1) {
          cookieMap.set(cookie.substring(0, firstOccurance), cookie.substring(firstOccurance + 1));
        }
      }
    });
    cookieMap.forEach((value, key) => {
      cookieContent += `${HEADER_CONTENT_KEY}${addMarkTag(key)}${HEADER_CONTENT_VALUE}${addMarkTag(value)}</div></div>`;
    });
    return cookieContent;
  }

  function generateResponseCookieDetails(cookieValue, cookieDelim) {
    const cookieList = cookieValue.split(cookieDelim);
    let cookieContent = '';
    cookieList.forEach((cookie) => {
      if (cookie) {
        const cookieDetails = getCookieNameValue(cookie);
        cookieContent += `${HEADER_CONTENT_KEY}${addMarkTag(cookieDetails.cookieName)}${HEADER_CONTENT_VALUE}${addMarkTag(cookieDetails.cookieValue)}</div></div>`;
      }
    });
    return cookieContent;
  }

  function setOptimizedCookiesMap(cookieValue, cookieDelim, optimizedCookiesMap) {
    const cookieList = cookieValue.split(cookieDelim); // for FF
    cookieList.forEach((cookie) => {
      if (cookie) {
        let key = '';
        const cookieDetails = getCookieNameValue(cookie);
        if (cookieDetails.cookieName && cookieDetails.domain && cookieDetails.path) {
          key = `${cookieDetails.cookieName}:${cookieDetails.domain}:${cookieDetails.path}`;
        } else if (cookieDetails.cookieName && cookieDetails.domain) {
          key = `${cookieDetails.cookieName}:${cookieDetails.domain}`;
        } else {
          key = `${cookieDetails.cookieName}`;
        }
        optimizedCookiesMap.set(key, cookieDetails);
      }
    });
  }

  function removeCookies(cookies) {
    const removedCookies = [];
    for (const cookie of cookies) {
      const protocol = cookie.secure ? 'https:' : 'http:';
      const cookieUrl = `${protocol}//${cookie.domain}${cookie.path}`;
      const removed = httpTracker.browser.cookies.remove({
        url: cookieUrl,
        name: cookie.name,
        storeId: cookie.storeId,
      });
      removedCookies.push(removed);
    }
    Promise.all(removedCookies).then((values) => {
      // console.log(values.length);
    });
  }

  function getCookieNameValue(cookie) {
    const firstOccurance = cookie.indexOf('=');
    const cookieObj = {};
    if (firstOccurance > -1) {
      cookieObj.cookieName = cookie.substring(0, firstOccurance);
      cookieObj.cookieValue = cookie.substring(firstOccurance + 1);
      // https://tools.ietf.org/html/rfc6265#page-10
      // https://tools.ietf.org/html/rfc6265#section-4.1.1
      if (cookieObj.cookieValue) {
        stringToArray(cookieObj.cookieValue, ';').forEach((attribute) => {
          if (attribute) {
            const attributeKeyValue = attribute.trim().split('=');
            // toLowerCase : chrome sends as domain, FF sends as Domain
            if (attributeKeyValue[0].toLowerCase() === 'domain' || attributeKeyValue[0].toLowerCase() === 'path') {
              cookieObj[attributeKeyValue[0].toLowerCase()] = attributeKeyValue[1];
            }
            if (attributeKeyValue[0].toLowerCase() === 'domain') {
              // console.log(attributeKeyValue[1]);
              selectedDomain = attributeKeyValue[1];
            }
          }
        });
      }
    }
    return cookieObj;
  }

  function displayHiddenURLList() {
    const urlsList = getHiddenUrlsList();
    while (urlsList.length) {
      urlsList[0].classList.remove('web_event_list_hide');
    }
  }

  /**
   * This will be called when
   *  a. On page load - to display only the matched URLs from filter box if not empty
   *  b. For each key entry in the filter box
   *  c. on clear filter button click
   */
  function hideOrShowURLList() {
    if (multipleSearchPatterns.length == 0) {
      displayHiddenURLList();
    } else {
      const allUrlsList = Array.prototype.slice.call(getAllUrlsList());
      for (const element of allUrlsList) {
        const string = element.childNodes[filterWithKey].innerHTML.toLowerCase();
        if (!isANDFilter) {
          if (multipleSearchPatterns.some((v) => string.includes(v))) {
            element.classList.remove('web_event_list_hide');
          } else {
            element.classList.add('web_event_list_hide');
          }
        } else {
          let index = 0;
          multipleSearchPatterns.forEach((e) => {
            if (index !== -1) {
              index = string.indexOf(e, index);
              if (index !== -1) {
                index += e.length;
              }
            }
          });
          if (index === -1) {
            element.classList.add('web_event_list_hide');
          } else {
            element.classList.remove('web_event_list_hide');
          }
        }
      }
    }
  }

  function removeEntry(node) {
    const requestIdToRemove = node.id.substring(16, node.id.length);
    requestIdRedirectCount.delete(requestIdToRemove);
    allRequestHeaders.delete(requestIdToRemove);
    allResponseHeaders.delete(requestIdToRemove);
    requestFormData.delete(requestIdToRemove);
    responseBodyData.delete(requestIdToRemove);
    node.remove();
    if (requestIdToRemove === selectedWebEventRequestId) {
      getById('delete_selected_web_event').disabled = true;
      getById('response_headers_details').innerHTML = '';
      getById('request_headers_details').innerHTML = '';
      getById('web_details_selected_container').style = 'visibility: hidden;';
      selectedWebEventRequestId = null;
      selectedEvent = null;
    }
  }

  /**
   *  This method always returns a live collection of hidden URLs list
   */
  function getHiddenUrlsList() {
    return getById('urls_list').getElementsByClassName('web_event_list_blank web_event_list_hide'); // this returns a live collection
  }

  function getVisibleUrlsList() {
    const allUrls = getAllUrlsList(); // this gives live list
    const visibleUrls = Array.prototype.filter.call(allUrls, function (eachUrl) {
      return !eachUrl.classList.contains('web_event_list_hide');
    });
    return visibleUrls;
  }

  /**
   *  This method always returns a live collection of all URLs list (hidden and not hidden)
   */
  function getAllUrlsList() {
    return getById('urls_list').getElementsByClassName('web_event_list_blank'); // this returns a live collection
  }

  function bindDefaultEvents() {
    const bindSafe = (id, event, handler) => {
      const el = getById(id);
      if (el) {
        if (event === 'onclick') el.onclick = handler;
        else if (event === 'oninput') el.oninput = handler;
        else if (event === 'onchange') el.onchange = handler;
        else if (event === 'onkeydown') el.onkeydown = handler;
        else if (event === 'click_listener') el.addEventListener('click', handler);
      }
    };

    bindSafe('track_urls_pattern', 'oninput', setPatternsToInclude);
    bindSafe('exclude_urls_pattern', 'oninput', setPatternsToExclude);
    bindSafe('block_urls_pattern', 'oninput', setPatternsToBlock);
    bindSafe('mask_patterns_list', 'oninput', setPatternsToMask);
    bindSafe('enable_mask_patterns', 'onchange', maskFieldsCheckbox);
    bindSafe('include_form_data', 'onchange', captureFormDataCheckbox);
    bindSafe('include_response_body', 'onchange', captureResponseBodyCheckbox);
    bindSafe('optimize_response_cookies', 'onchange', optimizeResponseCookiesCheckbox);
    bindSafe('filter_web_events', 'oninput', filterEvents);
    bindSafe('web_event_filter_key', 'oninput', filterEvents);
    bindSafe('clear_filter_web_events', 'onclick', clearFilterBoxDisplayAllURLsAndUpdateButtons);
    bindSafe('delete_all_filtered_web_events', 'onclick', deleteFilteredEvents);
    bindSafe('delete_selected_web_event', 'onclick', removeSelectedEvent);
    bindSafe('delete_all_web_events', 'onclick', clearAllEvents);
    bindSafe('urls_list', 'onclick', setEventRowAsSelected);
    bindSafe('urls_list', 'onkeydown', updateSelectedEventToContainer);
    bindSafe('toggle_track_web_events', 'onclick', updateToggleCaptureEvents);
    bindSafe('header_button_remove_0', 'onclick', clearAndRemoveHeaderContents);
    bindSafe('header_button_add_0', 'onclick', addNewHeaderContainer);
    bindSafe('add_modify_headers', 'oninput', generateHeadersToAddOrModify); // either on text change
    bindSafe('find_in_details_pattern', 'oninput', setFindPatterns);
    bindSafe('delete_cookies_button', 'onclick', deleteCookiesForSelectedDomain);

    bindSafe('preferences', 'click_listener', function () {
      openAddonOptions();
    });
  }

  function setFindPatterns(event) {
    if (findPatternsTimeout) {
      clearTimeout(findPatternsTimeout);
    }
    findPatternsTimeout = setTimeout(function () {
      findPatterns = event.target.value.trim();
      displayEventProperties();
    }, inputBoxDelay);
  }

  function generateHeadersToAddOrModify() {
    const headersObject = [];
    const conatiners = getByClassNames('single_header_container');
    Array.prototype.filter.call(conatiners, function (headerContainer) {
      index = headerContainer.id.substring(15);
      headerName = headerContainer.querySelector('.header_input_name').value.trim();
      if (headerName) {
        if (!FORBIDDEN_HEADERS.some((v) => headerName.toLowerCase() === v.toLowerCase()) &&
          !FORBIDDEN_HEADERS_PATTERN.some((v) => headerName.toLowerCase().startsWith(v.toLowerCase()))) {
          headerContainer.querySelector('.add_header_name').style.color = '';
          if (headerContainer.querySelector('.header_input_apply').checked) {
            const x = {};
            x.name = headerName;
            x.value = headerContainer.querySelector('.header_input_value').value;
            x.url = headerContainer.querySelector('.header_input_url').value.trim();
            headersObject.push(x);
          }
        } else {
          headerContainer.querySelector('.add_header_name').style.color = 'red';
        }
      }
    });
    setRequestHeadersList(headersObject);
    // MV3: Update DNR header modification rules
    if (typeof httpTrackerDNR !== 'undefined') {
      httpTrackerDNR.updateHeaderModificationRules(headersObject, includeURLsList, excludeURLsList);
    }
    if (headersObject.length || conatiners.length) {
      getById('add_modify_headers_banner').innerHTML = `Add/Modify request headers: ${headersObject.length}`;
    } else {
      getById('add_modify_headers_banner').innerHTML = `Add/Modify request headers:`;
    }
  }

  function clearAndRemoveHeaderContents(event) {
    if (event.target.id.substring(21) === '0') {
      getById('header_name_0').value = '';
      getById('header_value_0').value = '';
      getById('header_url_0').value = '';
    } else {
      getById('header_details_' + event.target.id.substring(21)).remove();
    }
    generateHeadersToAddOrModify();
  }

  function addNewHeaderContainer(event) {
    const currentContainers = getByClassNames('single_header_container');
    const nextIndex = currentContainers.length;

    const headerDiv = document.createElement('div');
    headerDiv.id = 'header_details_' + nextIndex;
    headerDiv.classList = 'single_header_container';

    const urlDiv = document.createElement('div');
    urlDiv.classList = 'add_header_url';
    const urlTextNode = document.createTextNode('URL ');
    const urlInput = document.createElement('input');
    urlInput.setAttribute('type', 'text');
    urlInput.id = 'header_url_' + nextIndex;
    urlInput.classList = 'header_input_url';
    urlDiv.append(urlTextNode);
    urlDiv.append(urlInput);

    const valueDiv = document.createElement('div');
    valueDiv.classList = 'add_header_value';
    const valueTextNode = document.createTextNode('Value ');
    const valueInput = document.createElement('input');
    valueInput.setAttribute('type', 'text');
    valueInput.id = 'header_value_' + nextIndex;
    valueInput.classList = 'header_input_value';
    valueDiv.append(valueTextNode);
    valueDiv.append(valueInput);

    const nameDiv = document.createElement('div');
    nameDiv.classList = 'add_header_name';
    const nameTextNode = document.createTextNode('Name ');
    const nameInput = document.createElement('input');
    nameInput.setAttribute('type', 'text');
    nameInput.id = 'header_name_' + nextIndex;
    nameInput.classList = 'header_input_name';
    nameDiv.append(nameTextNode);
    nameDiv.append(nameInput);

    const applyDiv = document.createElement('div');
    applyDiv.classList = 'add_header_apply';
    const applyInput = document.createElement('input');
    applyInput.setAttribute('type', 'checkbox');
    applyInput.id = 'header_apply_' + nextIndex;
    applyInput.classList = 'header_input_apply';
    const applyLabel = document.createElement('label');
    applyLabel.htmlFor = 'header_apply_' + nextIndex;
    applyLabel.innerHTML = 'Apply';
    applyDiv.append(applyInput, applyLabel);

    const headerButtonsDiv = document.createElement('div');
    headerButtonsDiv.style = 'width: 12%;float: left;text-align: right;';

    const simpleDiv = document.createElement('div');
    simpleDiv.style = 'display: flex;';

    const removeButton = document.createElement('input');
    removeButton.setAttribute('type', 'button');
    removeButton.value = '-';
    removeButton.id = 'header_button_remove_' + nextIndex;
    removeButton.onclick = clearAndRemoveHeaderContents;

    const removeDiv = document.createElement('div');
    removeDiv.style = 'margin-right: 5px;float: left;flex-grow: 1;';
    removeDiv.append(removeButton);

    const addButton = document.createElement('input');
    addButton.setAttribute('type', 'button');
    addButton.value = '+';
    addButton.style = 'visibility: hidden;';

    const addDiv = document.createElement('div');
    addDiv.append(addButton);

    simpleDiv.append(removeDiv, addDiv);
    headerButtonsDiv.append(simpleDiv);
    headerDiv.append(nameDiv, valueDiv, urlDiv, applyDiv, headerButtonsDiv);
    currentContainers[nextIndex - 1].after(headerDiv);
  }

  function updateToggleCaptureEvents() {
    const btn = getById('toggle_track_web_events');
    if (!btn) return;

    if (toggleCaptureEvents) {
      toggleCaptureEvents = false;
      btn.innerHTML = '<span class="w-2 h-2 rounded-full bg-gray-500"></span><span>Paused</span>';
      // replace classes to darken/disable look
      btn.classList.add('opacity-75');
    } else {
      toggleCaptureEvents = true;
      btn.innerHTML = '<span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span><span>Tracking</span>';
      btn.classList.remove('opacity-75');
    }
  }

  function captureFormDataCheckbox() {
    captureFormDataCheckboxValue = getById('include_form_data').checked;
  }

  function captureResponseBodyCheckbox() {
    captureResponseBodyCheckboxValue = getById('include_response_body').checked;
    if (!captureResponseBodyCheckboxValue) {
      debuggerTracker.detachAll();
    }
  }


  function optimizeResponseCookiesCheckbox() {
    optimizeResponseCookies = getById('optimize_response_cookies').checked;
    displayEventProperties();
  }

  function maskFieldsCheckbox() {
    maskAttributesCheckboxValue = getById('enable_mask_patterns').checked;
    displayEventProperties();
  }

  function setPatternsToMask(event) {
    if (filterPatternsToMaskTimeout) {
      clearTimeout(filterPatternsToMaskTimeout);
    }
    filterPatternsToMaskTimeout = setTimeout(function () {
      maskedAttributesList = stringToArray(event.target.value);
      displayEventProperties();
    }, inputBoxDelay);
  }

  function clearAllEvents() {
    requestFormData.clear();
    allRequestHeaders.clear();
    allResponseHeaders.clear();
    responseBodyData.clear();
    addedRequestId.length = 0;
    getById('response_headers_details').innerHTML = '';
    getById('request_headers_details').innerHTML = '';
    getById('urls_list').innerHTML = '';

    const container = getById('web_details_selected_container');
    const emptyState = getById('details_empty_state');
    if (container && emptyState) {
      container.classList.add('opacity-0', 'invisible', 'hidden');
      emptyState.classList.remove('hidden');
    }
  }

  function deleteFilteredEvents() {
    const visibleUrlList = getVisibleUrlsList();
    if (visibleUrlList) {
      for (node of visibleUrlList) {
        removeEntry(node);
      }
    }
    clearFilterBoxDisplayAllURLsAndUpdateButtons();
  }

  function clearFilterBoxDisplayAllURLsAndUpdateButtons() {
    clearFilterBox();
    hideOrShowURLList();
    updateAllButtons();
  }

  function clearFilterBox() {
    filterWithValue = getById('filter_web_events').value = '';
    multipleSearchPatterns = '';
  }

  function updateSelectedEventToContainer(event) {
    if (event.target && event.target.classList.contains('web_event_list_container')) {
      const selectedEvent = getSelectedEvent();
      selectNextEligibleEvent(selectedEvent, event.keyCode);
    }
  }

  function selectNextEligibleEvent(selectedEvent, keyCode) {
    if (keyCode == 40) { // down arrow
      let nextElement = selectedEvent ? selectedEvent.nextElementSibling : selectedEvent;
      while (nextElement) {
        if (nextElement.classList.contains('web_event_list_hide')) {
          nextElement = nextElement.nextElementSibling;
        } else {
          markSelectedRequest(nextElement.id);
          break;
        }
      }
    } else if (keyCode == 38) { // up arrow
      let previousElement = selectedEvent ? selectedEvent.previousElementSibling : selectedEvent;
      while (previousElement) {
        if (previousElement.classList.contains('web_event_list_hide')) {
          previousElement = previousElement.previousElementSibling;
        } else {
          markSelectedRequest(previousElement.id);
          break;
        }
      }
    }
  }

  function removeSelectedEvent() {
    let selectedEvent = getSelectedEvent();
    if (selectedEvent) {
      removeEntry(selectedEvent);
      getById('delete_selected_web_event').disabled = true;
      selectedEvent = null;
    }
  }

  function setEventRowAsSelected(event) {
    let target = event.target;
    // Bubble up to find the row container (div with id starting with web_events_list_)
    while (target && target.id !== 'urls_list' && (!target.id || !target.id.startsWith('web_events_list_'))) {
      target = target.parentNode;
    }

    if (target && target.id && target.id.startsWith('web_events_list_')) {
      markSelectedRequest(target.id);
      getById('delete_selected_web_event').disabled = false;
    }
  }

  function filterEvents(event) {
    if (filterWithValueTimeout) {
      clearTimeout(filterWithValueTimeout);
    }
    filterWithValueTimeout = setTimeout(function () {
      updateFilterOptions();
      hideOrShowURLList();
      updateAllButtons();
    }, inputBoxDelay);
  }

  function updateFilterOptions() {
    filterWithKey = getById('web_event_filter_key').selectedOptions[0].value; // get the selected key(index) from drop down
    filterWithValue = getById('filter_web_events').value.toLowerCase().trim(); // get the value from filter text box
    isANDFilter = false;
    multipleSearchPatterns = '';
    if (filterWithValue) {
      if (filterWithValue.length < 3 || (filterWithValue.includes(DELIMITER_OR) && filterWithValue.includes(DELIMITER_AND))) {
        // invalid search filter text, do nothing
      } else {
        if (filterWithValue.includes(DELIMITER_AND)) {
          multipleSearchPatterns = stringToArray(filterWithValue, DELIMITER_AND);
          multipleSearchPatterns = filterWithLength(multipleSearchPatterns, 2);
        } else {
          multipleSearchPatterns = stringToArray(filterWithValue, DELIMITER_OR);
          multipleSearchPatterns = filterWithLength(multipleSearchPatterns, 2);
          isANDFilter = false;
        }
      }
    }
  }

  function setPatternsToExclude(event) {
    if (filterPatternsToExcludeTimeout) {
      clearTimeout(filterPatternsToExcludeTimeout);
    }
    filterPatternsToExcludeTimeout = setTimeout(function () {
      excludeURLsList = stringToArray(event.target.value);
    }, inputBoxDelay);
  }

  function setPatternsToBlock(event) {
    if (setPatternsToBlockTimeout) {
      clearTimeout(setPatternsToBlockTimeout);
    }
    setPatternsToBlockTimeout = setTimeout(function () {
      blockURLSList = stringToArray(event.target.value);
      // MV3: Update DNR blocking rules
      if (typeof httpTrackerDNR !== 'undefined') {
        httpTrackerDNR.updateBlockingRules(blockURLSList);
      }
    }, inputBoxDelay);
  }

  async function setPatternsToInclude(event) {
    if (filterPatternsToIncludeTimeout) {
      clearTimeout(filterPatternsToIncludeTimeout);
    }
    filterPatternsToIncludeTimeout = setTimeout(function () {
      includeURLsList = stringToArray(event.target.value);
    }, inputBoxDelay);
  }

  function setInitialStateOfPage() {
    filterWithValue = getById('filter_web_events').value;
    captureFormDataCheckboxValue = getById('include_form_data').checked;
    captureResponseBodyCheckboxValue = getById('include_response_body').checked;
    optimizeResponseCookies = getById('optimize_response_cookies').checked;
    includeURLsList = stringToArray(getById('track_urls_pattern').value);
    excludeURLsList = stringToArray(getById('exclude_urls_pattern').value);
    maskedAttributesList = stringToArray(getById('mask_patterns_list').value);
    maskAttributesCheckboxValue = getById('enable_mask_patterns').checked;
    blockURLSList = stringToArray(getById('block_urls_pattern').value);
    // MV3: Initialize DNR blocking rules on page load
    if (typeof httpTrackerDNR !== 'undefined' && blockURLSList && blockURLSList.length > 0) {
      httpTrackerDNR.updateBlockingRules(blockURLSList);
    }
    updateAllButtons();
    hideOrShowURLList();
    hideOrShowInfoIcons();
  }

  function hideOrShowInfoIcons() {
    if (globalIncludeURLsList && globalIncludeURLsList.length) {
      const element = getById('info_include');
      element.innerHTML = '&#9432;';
      element.title = `Patterns extended from preferences: ${globalIncludeURLsList}`;
      element.style.color = 'red';
    } else {
      const element = getById('info_include');
      element.innerHTML = '';
      element.title = '';
    }
    if (globalExcludeURLsList && globalExcludeURLsList.length) {
      const element = getById('info_exclude');
      element.innerHTML = '&#9432;';
      element.title = `Patterns extended from preferences: ${globalExcludeURLsList}`;
      element.style.color = 'red';
    } else {
      const element = getById('info_exclude');
      element.innerHTML = '';
      element.title = '';
    }
    if (globalMaskPatternsList && globalMaskPatternsList.length) {
      const element = getById('info_mask');
      element.innerHTML = '&#9432;';
      element.title = `Patterns extended from preferences: ${globalMaskPatternsList}`;
      element.style.color = 'red';
    } else {
      const element = getById('info_mask');
      element.innerHTML = '';
      element.title = '';
    }
  }

  function updateAllButtons() {
    updateButonClearFilterWebEvents();
    updateButonDeleteSelectedWebEvent();
    updateButonDeleteAllFilteredWebEvents();
  }

  function updateButonClearFilterWebEvents() {
    if (!filterWithValue) {
      getById('clear_filter_web_events').disabled = true;
    } else {
      getById('clear_filter_web_events').disabled = false;
    }
  }

  function updateButonDeleteAllFilteredWebEvents() {
    if (filterWithValue && filterWithValue.length > 2) {
      const visibleUrlList = getVisibleUrlsList();
      if (visibleUrlList && visibleUrlList.length > 0) {
        getById('delete_all_filtered_web_events').disabled = false;
      } else {
        getById('delete_all_filtered_web_events').disabled = true;
      }
    } else {
      getById('delete_all_filtered_web_events').disabled = true;
    }
  }

  function updateButonDeleteSelectedWebEvent() {
    const selectedEvent = getSelectedEvent();
    if (!selectedEvent) {
      getById('delete_selected_web_event').disabled = true;
    }
  }

  function markSelectedRequest(requestId) {
    deselectEvent();
    const element = getById(requestId);
    if (element) {
      element.classList.add('bg-blue-600', 'bg-opacity-20', 'border-l-4', 'border-l-blue-500');
    }
    selectedWebEventRequestId = requestId.substring(16);
    displayEventProperties();
  }

  function deselectEvent() {
    const selectedEvent = getSelectedEvent();
    if (selectedEvent) {
      selectedEvent.classList.remove('bg-blue-600', 'bg-opacity-20', 'border-l-4', 'border-l-blue-500');
    }
  }

  function getSelectedEvent() {
    const all = Array.prototype.slice.call(getAllUrlsList()); // compatible with HTMLCollection
    return all.find(el => el.classList.contains('bg-blue-600'));
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.title = getManifestDetails().title;
    bindDefaultEvents();
    setInitialStateOfPage();
  });

  function getGlobalOptions(details) {
    globalExcludeURLsList = getPropertyFromStorage(details, httpTracker.STORAGE_KEY_EXCLUDE_PATTERN);
    globalMaskPatternsList = getPropertyFromStorage(details, httpTracker.STORAGE_KEY_MASK_PATTERN);
    globalIncludeURLsList = getPropertyFromStorage(details, httpTracker.STORAGE_KEY_INCLUDE_PATTERN);
  }

  function getChangesFromStorge(changes, namespace) {
    for (const key in changes) {
      if (key === httpTracker.STORAGE_KEY_EXCLUDE_PATTERN) {
        globalExcludeURLsList = changes[key].newValue;
      } else if (key === httpTracker.STORAGE_KEY_INCLUDE_PATTERN) {
        globalIncludeURLsList = changes[key].newValue;
      } else if (key === httpTracker.STORAGE_KEY_MASK_PATTERN) {
        globalMaskPatternsList = changes[key].newValue;
      }
    }
    hideOrShowInfoIcons();
    displayEventProperties();
  }

  httpTracker.browser.storage.onChanged.addListener(getChangesFromStorge);
  httpTracker.browser.storage.sync.get([httpTracker.STORAGE_KEY_INCLUDE_PATTERN, httpTracker.STORAGE_KEY_EXCLUDE_PATTERN, httpTracker.STORAGE_KEY_MASK_PATTERN], getGlobalOptions);

  return {
    logRequestDetails: logRequestDetails,
    insertResponseBodyByUrl: insertResponseBodyByUrl,
  };
})();

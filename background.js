// PHYBRV - PodHeitor YouTube Bulk Related Video
// Background Service Worker (minimal - session-based auth, no OAuth2)
// Author: Heitor Faria | License: GPL v3

// This extension uses YouTube Studio's existing session for authentication.
// No background API calls needed - all API calls go through page_bridge.js
// which runs in the page context and uses the user's cookies.

chrome.runtime.onInstalled.addListener(() => {
  console.log('[PHYBRV] Extension installed. Navigate to YouTube Studio to use.');
});

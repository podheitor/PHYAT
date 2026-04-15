// PHYAT - PodHeitor YouTube Automation Tools
// Background Service Worker
// Author: Heitor Faria | License: GPL v3

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[PHYAT] Extension installed. Features available on YouTube & YouTube Studio.');
  } else if (details.reason === 'update') {
    console.log('[PHYAT] Extension updated to v2.0.0');
  }
});

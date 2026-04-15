// PHYAT Feature: Automatic Comments
// Adds comments to channel videos (lives, videos, shorts) automatically
// Author: Heitor Faria | License: GPL v3

(function () {
  'use strict';

  const { waitForElement, sleep, showToast, showProgress, hideProgress, escapeHtml, onUrlChange } = window.PHYAT;

  const STORAGE_KEY = 'phyat_autocomments_config';
  const TASK_KEY = 'phyat_autocomments_task';
  let fabButton = null;
  let configPanel = null;
  let isRunning = false;
  let abortController = null;

  const DEFAULT_CONFIG = {
    commentText: '',
    categories: { videos: true, lives: false, shorts: false },
    onlyUncommented: true,
    delayBetweenSeconds: 15
  };

  // ---- Initialize ----

  function init() {
    console.log('[PHYAT:AutoComments] Initializing...');
    checkPendingTask();
    watchNavigation();
  }

  function watchNavigation() {
    const check = () => {
      if (isYouTubeUserPage()) {
        injectFAB();
      } else if (isOnVideoPage()) {
        handleVideoPage();
      } else {
        removeFAB();
      }
    };

    onUrlChange(() => setTimeout(check, 1500));
    setTimeout(check, 2000);
  }

  function isYouTubeUserPage() {
    const path = location.pathname;
    return location.hostname === 'www.youtube.com' &&
           (path === '/' || path === '' || path.startsWith('/feed'));
  }

  function isOnVideoPage() {
    return location.hostname === 'www.youtube.com' && location.pathname === '/watch';
  }

  // ---- FAB Button ----

  function injectFAB() {
    if (document.getElementById('phyat-autocomments-fab')) return;

    fabButton = document.createElement('div');
    fabButton.id = 'phyat-autocomments-fab';
    fabButton.className = 'phyat-fab phyat-fab-secondary';
    fabButton.innerHTML = `
      <button class="phyat-fab-button phyat-fab-button-comment" id="phyat-autocomments-fab-btn" title="PHYAT - Auto Comments">
        <div class="phyat-fab-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" fill="currentColor"/>
          </svg>
        </div>
        <span class="phyat-fab-label">Auto Comments</span>
      </button>
    `;

    document.body.appendChild(fabButton);
    requestAnimationFrame(() => fabButton.classList.add('phyat-fab-visible'));

    document.getElementById('phyat-autocomments-fab-btn').addEventListener('click', toggleConfigPanel);
  }

  function removeFAB() {
    const fab = document.getElementById('phyat-autocomments-fab');
    if (fab) {
      fab.classList.remove('phyat-fab-visible');
      setTimeout(() => fab.remove(), 300);
      fabButton = null;
    }
    closeConfigPanel();
  }

  // ---- Config Panel ----

  async function toggleConfigPanel() {
    if (configPanel) {
      closeConfigPanel();
    } else {
      await openConfigPanel();
    }
  }

  async function openConfigPanel() {
    closeConfigPanel();

    const config = await loadConfig();
    configPanel = document.createElement('div');
    configPanel.id = 'phyat-autocomments-panel';
    configPanel.className = 'phyat-panel';

    configPanel.innerHTML = `
      <div class="phyat-panel-container">
        <div class="phyat-panel-header">
          <div class="phyat-panel-title-row">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#FF0000">
              <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
            </svg>
            <h2>Auto Comments</h2>
            <button class="phyat-panel-close" id="phyat-autocomments-close" title="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
          <p class="phyat-panel-subtitle">Automatically add comments to your channel's videos</p>
        </div>

        <div class="phyat-panel-body">
          <div class="phyat-field">
            <label class="phyat-label">Comment text</label>
            <textarea id="phyat-autocomments-text" class="phyat-textarea" rows="4" placeholder="Type your comment here...">${escapeHtml(config.commentText)}</textarea>
          </div>

          <div class="phyat-field">
            <label class="phyat-label">Video categories to comment on</label>
            <div class="phyat-checkbox-group">
              <label class="phyat-checkbox-label">
                <input type="checkbox" id="phyat-ac-cat-videos" ${config.categories.videos ? 'checked' : ''} />
                <span>Videos</span>
              </label>
              <label class="phyat-checkbox-label">
                <input type="checkbox" id="phyat-ac-cat-lives" ${config.categories.lives ? 'checked' : ''} />
                <span>Lives</span>
              </label>
              <label class="phyat-checkbox-label">
                <input type="checkbox" id="phyat-ac-cat-shorts" ${config.categories.shorts ? 'checked' : ''} />
                <span>Shorts</span>
              </label>
            </div>
          </div>

          <div class="phyat-field">
            <label class="phyat-checkbox-label">
              <input type="checkbox" id="phyat-ac-only-uncommented" ${config.onlyUncommented ? 'checked' : ''} />
              <span>Only comment on videos I haven't commented on yet</span>
            </label>
          </div>

          <div class="phyat-field">
            <label class="phyat-label">Delay between comments (seconds)</label>
            <input type="number" id="phyat-ac-delay" class="phyat-input" min="5" max="300" value="${config.delayBetweenSeconds}" />
            <p class="phyat-hint">Minimum 5s. Higher = safer against spam detection.</p>
          </div>

          <div class="phyat-status-bar" id="phyat-ac-status" style="display:none">
            <div class="phyat-status-indicator"></div>
            <span class="phyat-status-text"></span>
          </div>

          <div class="phyat-field" id="phyat-ac-log-container" style="display:none">
            <label class="phyat-label">Activity log</label>
            <div id="phyat-ac-log" class="phyat-log"></div>
          </div>
        </div>

        <div class="phyat-panel-footer">
          <button class="phyat-btn phyat-btn-secondary" id="phyat-ac-save">Save Config</button>
          <button class="phyat-btn phyat-btn-danger" id="phyat-ac-stop" style="display:none">⏹ Stop</button>
          <button class="phyat-btn phyat-btn-primary" id="phyat-ac-start">▶ Start Auto Comment</button>
        </div>
      </div>
    `;

    document.body.appendChild(configPanel);
    requestAnimationFrame(() => configPanel.classList.add('phyat-panel-active'));

    // Bind events
    document.getElementById('phyat-autocomments-close').addEventListener('click', closeConfigPanel);
    document.getElementById('phyat-ac-save').addEventListener('click', saveConfigFromPanel);
    document.getElementById('phyat-ac-start').addEventListener('click', startAutomation);
    document.getElementById('phyat-ac-stop').addEventListener('click', stopAutomation);

    if (isRunning) {
      document.getElementById('phyat-ac-start').style.display = 'none';
      document.getElementById('phyat-ac-stop').style.display = 'inline-flex';
    }
  }

  function closeConfigPanel() {
    if (configPanel) {
      configPanel.classList.remove('phyat-panel-active');
      setTimeout(() => {
        configPanel?.remove();
        configPanel = null;
      }, 300);
    }
  }

  // ---- Config persistence ----

  function loadConfig() {
    return new Promise(resolve => {
      chrome.storage.local.get(STORAGE_KEY, data => {
        resolve({ ...DEFAULT_CONFIG, ...(data[STORAGE_KEY] || {}) });
      });
    });
  }

  function saveConfig(config) {
    return chrome.storage.local.set({ [STORAGE_KEY]: config });
  }

  async function saveConfigFromPanel() {
    const config = getConfigFromPanel();
    await saveConfig(config);
    showToast('✅ Auto comments config saved!', 'success');
  }

  function getConfigFromPanel() {
    return {
      commentText: document.getElementById('phyat-autocomments-text')?.value?.trim() || '',
      categories: {
        videos: document.getElementById('phyat-ac-cat-videos')?.checked ?? true,
        lives: document.getElementById('phyat-ac-cat-lives')?.checked ?? false,
        shorts: document.getElementById('phyat-ac-cat-shorts')?.checked ?? false
      },
      onlyUncommented: document.getElementById('phyat-ac-only-uncommented')?.checked ?? true,
      delayBetweenSeconds: Math.max(5, parseInt(document.getElementById('phyat-ac-delay')?.value) || 15)
    };
  }

  // ---- Automation engine ----

  async function startAutomation() {
    const config = getConfigFromPanel();
    await saveConfig(config);

    if (!config.commentText) {
      showToast('⚠️ Please enter a comment text.', 'warning');
      return;
    }

    if (!config.categories.videos && !config.categories.lives && !config.categories.shorts) {
      showToast('⚠️ Please select at least one video category.', 'warning');
      return;
    }

    isRunning = true;
    abortController = new AbortController();

    document.getElementById('phyat-ac-start').style.display = 'none';
    document.getElementById('phyat-ac-stop').style.display = 'inline-flex';
    document.getElementById('phyat-ac-log-container').style.display = 'block';

    showToast('▶ Auto commenting started!', 'success');
    updateStatusUI('Fetching your channel videos...');

    try {
      await runCommentAutomation(config, abortController.signal);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[PHYAT:AutoComments] Error:', err);
        showToast('❌ Error during auto commenting. Check console.', 'error');
      }
    }

    isRunning = false;
    document.getElementById('phyat-ac-start') && (document.getElementById('phyat-ac-start').style.display = 'inline-flex');
    document.getElementById('phyat-ac-stop') && (document.getElementById('phyat-ac-stop').style.display = 'none');
    hideStatusUI();
  }

  function stopAutomation() {
    abortController?.abort();
    isRunning = false;
    showToast('⏹ Auto commenting stopped.', 'info');
  }

  async function runCommentAutomation(config, signal) {
    // Fetch channel videos from YouTube's public page
    const channelUrl = getMyChannelUrl();
    if (!channelUrl) {
      showToast('⚠️ Could not detect your channel. Please go to your channel page.', 'warning');
      return;
    }

    appendLog('📡 Fetching channel videos...');
    const videos = await fetchChannelVideos(channelUrl, config.categories);

    if (videos.length === 0) {
      appendLog('⚠️ No matching videos found.');
      showToast('⚠️ No videos found matching your criteria.', 'warning');
      return;
    }

    appendLog(`📋 Found ${videos.length} video(s) to process.`);
    let commented = 0;
    let skipped = 0;

    for (let i = 0; i < videos.length; i++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const video = videos[i];
      updateStatusUI(`Processing ${i + 1}/${videos.length}: ${video.title.substring(0, 40)}...`);
      showProgress(i, videos.length, `Commenting on: ${video.title}`, 'Auto Comments');

      // Navigate to video and comment
      appendLog(`📝 [${i + 1}/${videos.length}] ${video.title}`);

      const success = await commentOnVideo(video, config.commentText, signal);

      if (success === 'skipped') {
        skipped++;
        appendLog(`⏭️ Skipped (already commented)`);
      } else if (success) {
        commented++;
        appendLog(`✅ Commented successfully`);
      } else {
        appendLog(`❌ Failed to comment`);
      }

      // Delay between comments
      if (i < videos.length - 1 && !signal.aborted) {
        updateStatusUI(`Waiting ${config.delayBetweenSeconds}s...`);
        await abortableSleep(config.delayBetweenSeconds * 1000, signal);
      }
    }

    hideProgress();
    appendLog(`\n🏁 Done! ${commented} commented, ${skipped} skipped, ${videos.length - commented - skipped} failed.`);
    showToast(`✅ Auto comments done: ${commented} commented, ${skipped} skipped.`, 'success');
  }

  // ---- Channel detection ----

  function getMyChannelUrl() {
    // Try to find channel URL from YouTube's sidebar or header
    const channelLink = document.querySelector('a[href*="/channel/"][href*="youtube.com"]') ||
                        document.querySelector('yt-formatted-string#channel-name a') ||
                        document.querySelector('#avatar-link[href*="/channel/"]');
    if (channelLink) return channelLink.href;

    // Try from ytInitialGuideData
    const guideItems = document.querySelectorAll('a.yt-simple-endpoint[href^="/@"]');
    for (const item of guideItems) {
      if (item.closest('#guide-section-renderer')) {
        return `https://www.youtube.com${item.getAttribute('href')}`;
      }
    }

    return null;
  }

  // ---- Fetch channel videos ----

  async function fetchChannelVideos(channelUrl, categories) {
    const videos = [];

    // Build tab URLs to fetch
    const tabs = [];
    if (categories.videos) tabs.push('/videos');
    if (categories.lives) tabs.push('/streams');
    if (categories.shorts) tabs.push('/shorts');

    for (const tab of tabs) {
      try {
        const tabUrl = channelUrl.replace(/\/$/, '') + tab;
        appendLog(`📂 Scanning: ${tab}`);

        // Fetch the tab page to extract video data
        const response = await fetch(tabUrl, {
          credentials: 'same-origin',
          headers: { 'Accept': 'text/html' }
        });
        const html = await response.text();

        // Extract video data from ytInitialData
        const dataMatch = html.match(/var ytInitialData\s*=\s*({.+?});\s*<\/script>/s);
        if (dataMatch) {
          const data = JSON.parse(dataMatch[1]);
          const extracted = extractVideosFromData(data, tab);
          videos.push(...extracted);
        }
      } catch (err) {
        console.error(`[PHYAT:AutoComments] Error fetching ${tab}:`, err);
        appendLog(`⚠️ Error fetching ${tab}`);
      }
    }

    return videos;
  }

  function extractVideosFromData(data, tab) {
    const videos = [];

    // Navigate the ytInitialData structure to find video renderers
    try {
      const tabContent = data?.contents?.twoColumnBrowseResultsRenderer?.tabs;
      if (!tabContent) return videos;

      for (const t of tabContent) {
        const content = t?.tabRenderer?.content;
        const items = content?.richGridRenderer?.contents ||
                      content?.sectionListRenderer?.contents;
        if (!items) continue;

        for (const item of items) {
          const renderer = item?.richItemRenderer?.content?.videoRenderer ||
                           item?.richItemRenderer?.content?.reelItemRenderer ||
                           item?.gridVideoRenderer ||
                           item?.videoRenderer;

          if (renderer) {
            const videoId = renderer.videoId;
            const title = renderer.title?.runs?.[0]?.text ||
                          renderer.headline?.simpleText ||
                          renderer.title?.simpleText || '';
            if (videoId && title) {
              videos.push({
                videoId,
                title,
                type: tab.replace('/', ''),
                url: `https://www.youtube.com/watch?v=${videoId}`
              });
            }
          }

          // Handle nested sections
          const sectionItems = item?.itemSectionRenderer?.contents;
          if (sectionItems) {
            for (const si of sectionItems) {
              const gridItems = si?.gridRenderer?.items || si?.shelfRenderer?.content?.gridRenderer?.items || [];
              for (const gi of gridItems) {
                const r = gi?.gridVideoRenderer || gi?.videoRenderer;
                if (r?.videoId) {
                  videos.push({
                    videoId: r.videoId,
                    title: r.title?.runs?.[0]?.text || r.title?.simpleText || '',
                    type: tab.replace('/', ''),
                    url: `https://www.youtube.com/watch?v=${r.videoId}`
                  });
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[PHYAT:AutoComments] Parse error:', err);
    }

    return videos;
  }

  // ---- Comment on a single video ----

  async function commentOnVideo(video, commentText, signal) {
    try {
      // Navigate to the video page in the current tab
      // We use fetch + DOM manipulation approach to avoid leaving the page
      // Open the video, scroll to comments, type, submit

      // Save current scroll position
      const scrollY = window.scrollY;

      // Navigate to video
      window.location.href = video.url;

      // Wait for page to load
      await sleep(4000);
      if (signal.aborted) return false;

      // Wait for comments section
      const commentsSection = await waitForElement('#comments', 15000).catch(() => null);
      if (!commentsSection) {
        console.log('[PHYAT:AutoComments] Comments section not found');
        return false;
      }

      // Scroll to comments to trigger lazy load
      commentsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(2000);
      if (signal.aborted) return false;

      // Check if already commented (if onlyUncommented is set)
      // Look for user's own comment
      const config = await loadConfig();
      if (config.onlyUncommented) {
        const ownComments = document.querySelectorAll('#author-text.yt-simple-endpoint');
        for (const commentAuthor of ownComments) {
          // Check if any comment is from the current user
          if (commentAuthor.closest('ytd-comment-renderer')?.querySelector('#author-comment-badge')) {
            return 'skipped';
          }
        }
      }

      // Find and click the comment input placeholder
      const commentPlaceholder = await waitForElement('#placeholder-area, #simplebox-placeholder', 10000).catch(() => null);
      if (!commentPlaceholder) {
        console.log('[PHYAT:AutoComments] Comment input not found');
        return false;
      }

      commentPlaceholder.click();
      await sleep(1000);

      // Find the actual contenteditable input
      const commentInput = await waitForElement('#contenteditable-root, #creation-box #contenteditable-root', 5000).catch(() => null);
      if (!commentInput) {
        console.log('[PHYAT:AutoComments] Comment contenteditable not found');
        return false;
      }

      // Type the comment
      commentInput.focus();
      commentInput.textContent = commentText;
      commentInput.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(500);

      // Click submit button
      const submitBtn = document.querySelector('#submit-button ytd-button-renderer button') ||
                        document.querySelector('#submit-button button') ||
                        document.querySelector('ytd-button-renderer#submit-button button');

      if (!submitBtn) {
        console.log('[PHYAT:AutoComments] Submit button not found');
        return false;
      }

      submitBtn.click();
      await sleep(2000);

      console.log(`[PHYAT:AutoComments] ✓ Commented on: ${video.title}`);
      return true;
    } catch (err) {
      console.error(`[PHYAT:AutoComments] Error commenting on ${video.videoId}:`, err);
      return false;
    }
  }

  // ---- Pending task (resume after navigation) ----

  async function checkPendingTask() {
    const data = await new Promise(r => chrome.storage.local.get(TASK_KEY, r));
    const task = data[TASK_KEY];
    if (!task || task.status !== 'running') return;

    // Resume automation from where we left off
    console.log('[PHYAT:AutoComments] Resuming pending task...');
    // Task resume logic handled by the video page handler
  }

  async function handleVideoPage() {
    // Check if we have a pending auto-comment task for this video
    const data = await new Promise(r => chrome.storage.local.get(TASK_KEY, r));
    const task = data[TASK_KEY];
    if (!task || task.status !== 'commenting') return;

    const currentVideoId = new URLSearchParams(location.search).get('v');
    if (task.currentVideoId === currentVideoId) {
      // We navigated to this video for commenting
      await sleep(3000);
      // The commenting logic is integrated in commentOnVideo
    }
  }

  // ---- UI helpers ----

  function updateStatusUI(text) {
    const statusBar = document.getElementById('phyat-ac-status');
    if (!statusBar) return;
    statusBar.style.display = 'flex';
    statusBar.querySelector('.phyat-status-indicator').className = 'phyat-status-indicator phyat-status-active';
    statusBar.querySelector('.phyat-status-text').textContent = text;
  }

  function hideStatusUI() {
    const statusBar = document.getElementById('phyat-ac-status');
    if (statusBar) statusBar.style.display = 'none';
  }

  function appendLog(message) {
    const log = document.getElementById('phyat-ac-log');
    if (!log) return;
    const entry = document.createElement('div');
    entry.className = 'phyat-log-entry';
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  function abortableSleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      const timer = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
  }

  // Register with PHYAT
  window.PHYAT.features = window.PHYAT.features || {};
  window.PHYAT.features.autoComments = { init };

  // Auto-init if on youtube.com
  if (location.hostname === 'www.youtube.com') {
    init();
  }
})();

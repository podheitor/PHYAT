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
    delayBetweenSeconds: 15,
    autoLike: false,
    channelUrl: ''
  };

  // ---- Initialize ----

  function init() {
    console.log('[PHYAT:AutoComments] Initializing...');
    watchNavigation();
  }

  function watchNavigation() {
    const check = () => {
      if (isOnYouTube()) {
        injectFAB();
        if (isOnVideoPage()) handleVideoPage();
      } else {
        removeFAB();
      }
    };

    onUrlChange(() => setTimeout(check, 1500));
    setTimeout(check, 2000);
  }

  function isOnYouTube() {
    return location.hostname === 'www.youtube.com';
  }

  function isOnVideoPage() {
    const p = location.pathname;
    return location.hostname === 'www.youtube.com' &&
           (p === '/watch' || p.startsWith('/shorts/'));
  }

  // Get watch URL (shorts use /shorts/id but comments need /watch?v=id)
  function getVideoWatchUrl(video) {
    if (video.type === 'shorts') return `https://www.youtube.com/watch?v=${video.videoId}`;
    return video.url;
  }

  // Extract video ID from current URL (/watch?v=id or /shorts/id)
  function getCurrentVideoId() {
    const p = location.pathname;
    if (p.startsWith('/shorts/')) return p.split('/shorts/')[1].split('?')[0];
    return new URLSearchParams(location.search).get('v');
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
            <label class="phyat-checkbox-label">
              <input type="checkbox" id="phyat-ac-auto-like" ${config.autoLike ? 'checked' : ''} />
              <span>Auto-like video when commenting</span>
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

    // Restore running state from storage (survives page navigation)
    const taskData = await new Promise(r => chrome.storage.local.get(TASK_KEY, r));
    const activeTask = taskData[TASK_KEY];
    if (activeTask && activeTask.status === 'running') {
      isRunning = true;
      document.getElementById('phyat-ac-start').style.display = 'none';
      document.getElementById('phyat-ac-stop').style.display = 'inline-flex';
      document.getElementById('phyat-ac-log-container').style.display = 'block';
      const done = activeTask.currentIndex;
      const total = activeTask.videos.length;
      updateStatusUI(`Running: ${done}/${total} processed`);
    } else if (isRunning) {
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
      autoLike: document.getElementById('phyat-ac-auto-like')?.checked ?? false,
      delayBetweenSeconds: Math.max(5, parseInt(document.getElementById('phyat-ac-delay')?.value) || 15)
    };
  }

  // ---- Automation engine ----

  async function startAutomation() {
    const config = getConfigFromPanel();
    await saveConfig(config);

    if (!config.commentText.trim()) {
      showToast('⚠️ Please enter a comment text.', 'warning');
      return;
    }
    if (!config.categories.videos && !config.categories.lives && !config.categories.shorts) {
      showToast('⚠️ Please select at least one video category.', 'warning');
      return;
    }

    document.getElementById('phyat-ac-start').style.display = 'none';
    document.getElementById('phyat-ac-stop').style.display = 'inline-flex';
    document.getElementById('phyat-ac-log-container').style.display = 'block';

    updateStatusUI('Fetching your channel videos...');
    appendLog('📡 Fetching channel videos...');

    const channelUrl = await getChannelUrl();
    if (!channelUrl) {
      showToast('⚠️ Could not detect your channel. Visit your channel page first.', 'warning');
      restoreStoppedUI();
      return;
    }

    const videos = await fetchChannelVideos(channelUrl, config.categories);
    if (!videos.length) {
      appendLog('⚠️ No matching videos found.');
      showToast('⚠️ No videos found matching your criteria.', 'warning');
      restoreStoppedUI();
      return;
    }

    appendLog(`📋 Found ${videos.length} video(s). Starting...`);
    showToast('▶ Auto commenting started!', 'success');

    // Persist task so it survives page navigation
    const task = {
      status: 'running',
      videos,
      currentIndex: 0,
      commented: 0,
      skipped: 0,
      config
    };
    await new Promise(r => chrome.storage.local.set({ [TASK_KEY]: task }, r));
    isRunning = true;
    abortController = new AbortController();

    // Navigate to first video (use watch URL for shorts)
    await sleep(300);
    window.location.href = getVideoWatchUrl(videos[0]);
  }
  async function stopAutomation() {
    abortController?.abort();
    await new Promise(r => chrome.storage.local.remove(TASK_KEY, r));
    isRunning = false;
    restoreStoppedUI();
    showToast('⏹ Auto commenting stopped.', 'info');
  }

  function restoreRunningUI(task) {
    isRunning = true;
    const startBtn = document.getElementById('phyat-ac-start');
    const stopBtn = document.getElementById('phyat-ac-stop');
    const logCont = document.getElementById('phyat-ac-log-container');
    if (startBtn) startBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'inline-flex';
    if (logCont) logCont.style.display = 'block';
  }

  function restoreStoppedUI() {
    isRunning = false;
    const startBtn = document.getElementById('phyat-ac-start');
    const stopBtn = document.getElementById('phyat-ac-stop');
    if (startBtn) startBtn.style.display = 'inline-flex';
    if (stopBtn) stopBtn.style.display = 'none';
    hideProgress();
    hideStatusUI();
  }


  // ---- Channel detection ----

  async function getChannelUrl() {
    // If currently on a channel page, use it and save it
    const path = location.pathname;
    if (path.startsWith('/@') || path.startsWith('/channel/') || path.startsWith('/c/')) {
      const channelPath = path.replace(/\/videos.*|\/streams.*|\/shorts.*/, '');
      const url = location.origin + channelPath;
      // Save for later use from other pages
      const cfg = await loadConfig();
      if (cfg.channelUrl !== url) {
        cfg.channelUrl = url;
        await saveConfig(cfg);
      }
      return url;
    }
    // Fall back to saved channel URL
    const cfg = await loadConfig();
    return cfg.channelUrl || null;
  }

  // ---- Fetch channel videos ----

  async function fetchChannelVideos(channelUrl, categories) {
    const videos = [];
    const tabType = [];
    if (categories.videos) tabType.push('/videos');
    if (categories.lives) tabType.push('/streams');
    if (categories.shorts) tabType.push('/shorts');

    for (const tab of tabType) {
      try {
        const tabUrl = channelUrl.replace(/\/$/, '') + tab;
        appendLog(`📂 Scanning: ${tab}`);

        const response = await fetch(tabUrl, {
          credentials: 'same-origin',
          headers: { 'Accept': 'text/html' }
        });
        const html = await response.text();

        // Extract INNERTUBE_API_KEY for continuation requests
        const apiKeyMatch = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/);
        const apiKey = apiKeyMatch?.[1];

        const dataMatch = html.match(/var ytInitialData\s*=\s*({.+?});\s*<\/script>/s);
        if (!dataMatch) continue;

        const data = JSON.parse(dataMatch[1]);
        const { videos: pageVideos, token } = extractVideosFromData(data, tab);
        videos.push(...pageVideos);

        // Follow continuation tokens to get all videos (max 30 pages = ~1440 items)
        let nextToken = token;
        let page = 0;
        while (nextToken && apiKey && page < 30) {
          page++;
          appendLog(`📂 Scanning: ${tab} (page ${page + 1}...)`);
          const more = await fetchContinuation(apiKey, nextToken, tab);
          videos.push(...more.videos);
          nextToken = more.token;
        }

        appendLog(`✅ ${tab}: ${videos.filter(v => v.type === tab.slice(1)).length} found`);
      } catch (err) {
        console.error(`[PHYAT:AutoComments] Error fetching ${tab}:`, err);
        appendLog(`⚠️ Error fetching ${tab}`);
      }
    }

    return videos;
  }

  async function fetchContinuation(apiKey, token, tab) {
    try {
      const resp = await fetch(
        `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}&prettyPrint=false`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            continuation: token,
            context: {
              client: {
                clientName: 'WEB',
                clientVersion: '2.20240101.00.00',
                hl: 'en'
              }
            }
          })
        }
      );
      const data = await resp.json();
      const items =
        data?.onResponseReceivedActions?.[0]?.appendContinuationItemsAction?.continuationItems ||
        data?.onResponseReceivedActions?.[1]?.appendContinuationItemsAction?.continuationItems ||
        [];
      return extractRichItems(items, tab);
    } catch (err) {
      console.error('[PHYAT:AutoComments] Continuation error:', err);
      return { videos: [], token: null };
    }
  }

  // Extract videos + next continuation token from a list of richItems
  function extractRichItems(items, tab) {
    const videos = [];
    let token = null;
    const tabName = tab.replace('/', '');

    for (const item of items) {
      // Continuation token for next page
      const contToken = item?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      if (contToken) { token = contToken; continue; }

      // Standard video
      const renderer = item?.richItemRenderer?.content?.videoRenderer ||
                       item?.richItemRenderer?.content?.reelItemRenderer ||
                       item?.gridVideoRenderer ||
                       item?.videoRenderer;
      if (renderer?.videoId) {
        const title = renderer.title?.runs?.[0]?.text ||
                      renderer.headline?.simpleText ||
                      renderer.title?.simpleText || '';
        videos.push({
          videoId: renderer.videoId,
          title,
          type: tabName,
          url: `https://www.youtube.com/watch?v=${renderer.videoId}`
        });
        continue;
      }

      // Shorts (shortsLockupViewModel format)
      const shortsModel = item?.richItemRenderer?.content?.shortsLockupViewModel;
      if (shortsModel) {
        const videoId = shortsModel.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ||
                        shortsModel.entityId?.replace('shorts-shelf-item-', '');
        const title = shortsModel.overlayMetadata?.primaryText?.content ||
                      shortsModel.accessibilityText || '';
        if (videoId) {
          videos.push({ videoId, title, type: 'shorts', url: `https://www.youtube.com/shorts/${videoId}` });
        }
        continue;
      }

      // Nested sections
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
                type: tabName,
                url: `https://www.youtube.com/watch?v=${r.videoId}`
              });
            }
          }
        }
      }
    }
    return { videos, token };
  }

  function extractVideosFromData(data, tab) {
    try {
      const tabContent = data?.contents?.twoColumnBrowseResultsRenderer?.tabs;
      if (!tabContent) return { videos: [], token: null };

      for (const t of tabContent) {
        const content = t?.tabRenderer?.content;
        const items = content?.richGridRenderer?.contents ||
                      content?.sectionListRenderer?.contents;
        if (!items) continue;
        return extractRichItems(items, tab);
      }
    } catch (err) {
      console.error('[PHYAT:AutoComments] Parse error:', err);
    }
    return { videos: [], token: null };
  }


  // ---- Comment on a single video ----

  async function doCommentOnCurrentPage(commentText, onlyUncommented, autoLike, signal) {
    try {
      // Auto-like if enabled
      if (autoLike) {
        window.scrollTo(0, 0);
        await sleep(500);
        if (signal.aborted) return false;
        const likeBtn = document.querySelector(
          'like-button-view-model button[aria-label], ' +
          '#segmented-like-button button[aria-label], ' +
          'ytd-toggle-button-renderer#like-button button'
        );
        if (likeBtn) {
          const isLiked = likeBtn.getAttribute('aria-pressed') === 'true';
          if (!isLiked) {
            likeBtn.click();
            await sleep(500);
            console.log('[PHYAT:AutoComments] ✓ Liked video');
          }
        }
      }

      // Wait for comments section (lazy-loaded)
      const commentsSection = await waitForElement('#comments', 15000).catch(() => null);
      if (!commentsSection) {
        console.log('[PHYAT:AutoComments] Comments section not found');
        return false;
      }

      commentsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(2000);
      if (signal.aborted) return false;

      // Check if already commented (wait for comments to load first)
      if (onlyUncommented) {
        // Wait for at least one comment thread to appear
        await waitForElement('ytd-comment-thread-renderer', 6000).catch(() => null);
        await sleep(500);

        // Match against channel URL (stored in config) OR author badge
        const cfg = await loadConfig();
        const channelPath = cfg.channelUrl ? new URL(cfg.channelUrl).pathname.replace(/\/$/, '') : null;

        const commentAuthors = document.querySelectorAll('#author-text.yt-simple-endpoint[href]');
        for (const author of commentAuthors) {
          const authorHref = (author.getAttribute('href') || '').replace(/\/$/, '');
          const hasBadge = !!author.closest('ytd-comment-renderer')?.querySelector('#author-comment-badge');
          const isOwnChannel = channelPath && (authorHref === channelPath || authorHref.startsWith(channelPath + '/'));
          if (hasBadge || isOwnChannel) return 'skipped';
        }
      }

      // Click comment placeholder to activate input
      const commentPlaceholder = await waitForElement('#placeholder-area, #simplebox-placeholder', 10000).catch(() => null);
      if (!commentPlaceholder) {
        console.log('[PHYAT:AutoComments] Comment input not found');
        return false;
      }

      commentPlaceholder.click();
      await sleep(1000);
      if (signal.aborted) return false;

      // Contenteditable input
      const commentInput = await waitForElement('#contenteditable-root, #creation-box #contenteditable-root', 5000).catch(() => null);
      if (!commentInput) {
        console.log('[PHYAT:AutoComments] Comment contenteditable not found');
        return false;
      }

      commentInput.focus();
      commentInput.textContent = commentText;
      commentInput.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(500);
      if (signal.aborted) return false;

      // Submit
      const submitBtn = document.querySelector('#submit-button ytd-button-renderer button') ||
                        document.querySelector('#submit-button button') ||
                        document.querySelector('ytd-button-renderer#submit-button button');
      if (!submitBtn) {
        console.log('[PHYAT:AutoComments] Submit button not found');
        return false;
      }

      submitBtn.click();
      await sleep(2000);
      return true;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.error('[PHYAT:AutoComments] Error commenting:', err);
      return false;
    }
  }


  // ---- Video page worker (persistent task driven) ----

  async function handleVideoPage() {
    const data = await new Promise(r => chrome.storage.local.get(TASK_KEY, r));
    const task = data[TASK_KEY];
    if (!task || task.status !== 'running') return;

    // Match current video to expected task video
    const currentId = getCurrentVideoId();
    const expectedVideo = task.videos[task.currentIndex];
    if (!expectedVideo) return;

    const expectedId = expectedVideo.videoId;
    if (currentId !== expectedId) return; // navigated elsewhere, skip

    // Restore UI (may have been reset after page load)
    restoreRunningUI(task);
    abortController = abortController ?? new AbortController();
    const signal = abortController.signal;

    const idx = task.currentIndex;
    const total = task.videos.length;

    updateStatusUI(`Commenting ${idx + 1}/${total}: ${expectedVideo.title.substring(0, 40)}...`);
    appendLog(`📝 [${idx + 1}/${total}] ${expectedVideo.title}`);
    showProgress(idx, total, `Commenting: ${expectedVideo.title}`, 'Auto Comments');
    // Add stop button to progress overlay (feature-specific)
    const progressEl = document.getElementById('phyat-progress-overlay');
    if (progressEl && !progressEl.querySelector('.phyat-progress-stop')) {
      const stopBtn = document.createElement('button');
      stopBtn.className = 'phyat-btn phyat-btn-danger phyat-progress-stop';
      stopBtn.style.cssText = 'margin-top:8px;width:100%;';
      stopBtn.textContent = '⏹ Stop';
      stopBtn.onclick = () => stopAutomation();
      progressEl.querySelector('.phyat-progress-container')?.appendChild(stopBtn);
    }

    // Wait for page to be ready (called 1500-2000ms after nav, still need more time)
    await sleep(3000);
    if (signal.aborted) { restoreStoppedUI(); return; }

    let result = false;
    try {
      result = await doCommentOnCurrentPage(task.config.commentText, task.config.onlyUncommented, task.config.autoLike, signal);
    } catch (err) {
      if (err.name !== 'AbortError') console.error('[PHYAT:AutoComments] Error:', err);
    }

    if (signal.aborted) { restoreStoppedUI(); return; }

    // Re-check task not stopped externally
    const latest = await new Promise(r => chrome.storage.local.get(TASK_KEY, r));
    if (!latest[TASK_KEY] || latest[TASK_KEY].status !== 'running') {
      restoreStoppedUI();
      return;
    }

    if (result === 'skipped') {
      task.skipped++;
      appendLog('⏭️ Skipped (already commented)');
    } else if (result) {
      task.commented++;
      appendLog('✅ Commented successfully');
    } else {
      appendLog('❌ Failed to comment');
    }

    task.currentIndex++;

    if (task.currentIndex >= task.videos.length) {
      const fail = task.videos.length - task.commented - task.skipped;
      appendLog(`\n🏁 Done! ${task.commented} commented, ${task.skipped} skipped, ${fail} failed.`);
      showToast(`✅ Done: ${task.commented} commented, ${task.skipped} skipped.`, 'success');
      hideProgress();
      await new Promise(r => chrome.storage.local.remove(TASK_KEY, r));
      restoreStoppedUI();
    } else {
      await new Promise(r => chrome.storage.local.set({ [TASK_KEY]: task }, r));
      const delay = task.config.delayBetweenSeconds * 1000;
      updateStatusUI(`Waiting ${task.config.delayBetweenSeconds}s before next video...`);
      appendLog(`⏳ Next in ${task.config.delayBetweenSeconds}s...`);
      setTimeout(() => {
        if (!abortController?.signal.aborted) {
          window.location.href = getVideoWatchUrl(task.videos[task.currentIndex]);
        }
      }, delay);
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

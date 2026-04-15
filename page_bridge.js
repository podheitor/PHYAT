// PHYAT - Page Bridge Script
// Runs in the PAGE context to access YouTube Studio's internal APIs.
// Uses exact request format intercepted from YouTube Studio's own calls.
// Author: Heitor Faria | License: GPL v3

(function () {
  'use strict';

  // Cache of all fetched videos for client-side search
  let _allVideosCache = [];

  // Listen for requests from the content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== 'phyat-content') return;

    const { action, requestId } = event.data;

    if (action === 'fetchVideos') {
      fetchAllChannelVideos(event.data.pageToken)
        .then(data => window.postMessage({ source: 'phyat-bridge', requestId, data }, '*'))
        .catch(err => {
          console.error('[PHYAT Bridge] fetchVideos error:', err);
          // Fallback to DOM scraping
          const domVideos = scrapeVideosFromDOM();
          if (domVideos.length > 0) {
            window.postMessage({ source: 'phyat-bridge', requestId, data: { videos: domVideos, nextPageToken: null, totalResults: domVideos.length } }, '*');
          } else {
            window.postMessage({ source: 'phyat-bridge', requestId, error: err.message }, '*');
          }
        });
    }

    if (action === 'searchVideos') {
      const query = (event.data.query || '').trim();
      searchChannelVideos(query)
        .then(data => window.postMessage({ source: 'phyat-bridge', requestId, data }, '*'))
        .catch(err => {
          console.error('[PHYAT Bridge] searchVideos error:', err);
          // Fallback: filter cached + DOM videos
          const allVids = _allVideosCache.length > 0 ? _allVideosCache : scrapeVideosFromDOM();
          const filtered = filterByMultipleTerms(allVids, query);
          window.postMessage({ source: 'phyat-bridge', requestId, data: { videos: filtered, nextPageToken: null, totalResults: filtered.length } }, '*');
        });
    }
  });

  // ============================================================
  //  YouTube Config & Auth
  // ============================================================

  function getYtcfgValue(key) {
    try {
      if (typeof ytcfg !== 'undefined') {
        try { return ytcfg.get(key); } catch (e) {
          return ytcfg.data_ ? ytcfg.data_[key] : undefined;
        }
      }
    } catch (e) {}
    return undefined;
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return match ? match[1] : null;
  }

  async function generateSAPISIDHash(origin) {
    const sapisid = getCookie('SAPISID') || getCookie('__Secure-3PAPISID');
    if (!sapisid) return null;

    const timestamp = Math.floor(Date.now() / 1000);
    const input = `${timestamp} ${sapisid} ${origin}`;
    const data = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    return `SAPISIDHASH ${timestamp}_${hashHex}`;
  }

  async function buildHeaders() {
    const origin = 'https://studio.youtube.com';
    const sapisidhash = await generateSAPISIDHash(origin);
    const channelId = getYtcfgValue('CHANNEL_ID');
    const delegatedSessionId = getYtcfgValue('DELEGATED_SESSION_ID');
    const sessionIndex = getYtcfgValue('SESSION_INDEX');
    const clientVersion = getYtcfgValue('INNERTUBE_CLIENT_VERSION');
    const visitorData = getYtcfgValue('VISITOR_DATA');

    // Build delegation context (base64 of channel protobuf)
    let delegationContext = '';
    try {
      if (channelId) {
        // The delegation context is a base64-encoded protobuf:
        // field 1 (string) = channelId, field 5 (varint) = 8
        // Simplified: encode channelId length-delimited at field 1
        const raw = String.fromCharCode(0x12, channelId.length) + channelId + String.fromCharCode(0x2a, 0x02, 0x08, 0x08);
        delegationContext = btoa(raw);
      }
    } catch (e) {
      console.warn('[PHYAT Bridge] Could not build delegation context:', e);
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Origin': origin,
      'X-Youtube-Bootstrap-Logged-In': 'true',
      'x-youtube-client-name': '62',
      'x-youtube-client-version': clientVersion || '1.20260402.03.00'
    };

    if (sapisidhash) {
      headers['Authorization'] = sapisidhash;
    }
    if (sessionIndex !== undefined) {
      headers['X-Goog-AuthUser'] = String(sessionIndex);
    }
    if (delegatedSessionId) {
      headers['X-Goog-PageId'] = delegatedSessionId;
    }
    if (visitorData) {
      headers['X-Goog-Visitor-Id'] = visitorData;
    }
    if (delegationContext) {
      headers['x-youtube-delegation-context'] = delegationContext;
    }

    return headers;
  }

  function buildContext() {
    const clientName = getYtcfgValue('INNERTUBE_CLIENT_NAME') || 62;
    const clientVersion = getYtcfgValue('INNERTUBE_CLIENT_VERSION') || '1.0';
    const delegatedSessionId = getYtcfgValue('DELEGATED_SESSION_ID');
    const visitorData = getYtcfgValue('VISITOR_DATA');

    const ctx = {
      client: {
        clientName,
        clientVersion,
      }
    };
    if (visitorData) ctx.client.visitorData = visitorData;
    if (delegatedSessionId) {
      ctx.request = {
        sessionInfo: { token: delegatedSessionId },
        internalExperimentFlags: [],
        returnLogEntry: true
      };
    }
    return ctx;
  }

  // ============================================================
  //  Fetch ALL channel videos (uploads + shorts + live)
  // ============================================================

  async function fetchAllChannelVideos(pageToken) {
    const channelId = getYtcfgValue('CHANNEL_ID');
    if (!channelId) {
      throw new Error('Channel ID not found. Please reload the page.');
    }

    // If we have a combined pageToken with our special format, parse it
    let state = { uploadsPT: null, shortsPT: null, livesPT: null, phase: 'all' };
    if (pageToken) {
      try { state = JSON.parse(atob(pageToken)); } catch (e) { /* ignore */ }
    }

    const results = [];
    let hasMore = false;
    const newState = { uploadsPT: null, shortsPT: null, livesPT: null, phase: 'done' };

    // Fetch from all 3 categories in parallel on first load
    const promises = [];

    // 1. Regular uploads (non-shorts)
    if (!pageToken || state.uploadsPT) {
      promises.push(
        fetchVideosByFilter(channelId, {
          and: {
            operands: [
              { channelIdIs: { value: channelId } },
              {
                and: {
                  operands: [
                    { videoOriginIs: { value: 'VIDEO_ORIGIN_UPLOAD' } },
                    { not: { operand: { contentTypeIs: { value: 'CREATOR_CONTENT_TYPE_SHORTS' } } } }
                  ]
                }
              }
            ]
          }
        }, state.uploadsPT)
          .then(r => {
            results.push(...r.videos);
            if (r.nextPageToken) { newState.uploadsPT = r.nextPageToken; hasMore = true; }
          })
          .catch(e => console.error('[PHYAT] Uploads fetch error:', e))
      );
    }

    // 2. Shorts
    if (!pageToken || state.shortsPT) {
      promises.push(
        fetchVideosByFilter(channelId, {
          and: {
            operands: [
              { channelIdIs: { value: channelId } },
              { contentTypeIs: { value: 'CREATOR_CONTENT_TYPE_SHORTS' } }
            ]
          }
        }, state.shortsPT)
          .then(r => {
            results.push(...r.videos);
            if (r.nextPageToken) { newState.shortsPT = r.nextPageToken; hasMore = true; }
          })
          .catch(e => console.error('[PHYAT] Shorts fetch error:', e))
      );
    }

    // 3. Live streams
    if (!pageToken || state.livesPT) {
      promises.push(
        fetchVideosByFilter(channelId, {
          and: {
            operands: [
              { channelIdIs: { value: channelId } },
              { videoOriginIs: { value: 'VIDEO_ORIGIN_LIVESTREAM' } }
            ]
          }
        }, state.livesPT, 'VIDEO_ORDER_LIVESTREAM_DISPLAY_TIME_DESC')
          .then(r => {
            results.push(...r.videos);
            if (r.nextPageToken) { newState.livesPT = r.nextPageToken; hasMore = true; }
          })
          .catch(e => console.error('[PHYAT] Lives fetch error:', e))
      );
    }

    await Promise.all(promises);

    // Sort by date (newest first)
    results.sort((a, b) => {
      const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return db - da;
    });

    // Remove duplicates
    const seen = new Set();
    const unique = results.filter(v => {
      if (seen.has(v.videoId)) return false;
      seen.add(v.videoId);
      return true;
    });

    console.log(`[PHYAT Bridge] Fetched ${unique.length} total videos (uploads + shorts + lives)`);

    // Cache all videos for search
    if (!pageToken) {
      _allVideosCache = unique;
    } else {
      // Append to cache, deduplicate
      const cacheIds = new Set(_allVideosCache.map(v => v.videoId));
      for (const v of unique) {
        if (!cacheIds.has(v.videoId)) _allVideosCache.push(v);
      }
    }

    return {
      videos: unique,
      nextPageToken: hasMore ? btoa(JSON.stringify(newState)) : null,
      totalResults: unique.length
    };
  }

  // ============================================================
  //  Fetch videos by filter (exact YouTube Studio format)
  // ============================================================

  async function fetchVideosByFilter(channelId, filter, pageToken, order) {
    const headers = await buildHeaders();
    const context = buildContext();
    const apiKey = getYtcfgValue('INNERTUBE_API_KEY');

    const url = `https://studio.youtube.com/youtubei/v1/creator/list_creator_videos?alt=json${apiKey ? '&key=' + apiKey : ''}`;

    const body = {
      context,
      filter,
      mask: {
        channelId: true,
        videoId: true,
        title: true,
        thumbnailDetails: {
          thumbnails: {
            url: true,
            width: true,
            height: true
          }
        },
        publicTimeSeconds: true,
        privacy: true,
        lengthSeconds: true,
        description: true,
        timeCreatedSeconds: true,
        origin: true,
        statusDetails: {
          privacyStatus: true,
          uploadStatus: true
        }
      },
      pageSize: 50
    };

    if (order) body.order = order;
    if (pageToken) body.pageToken = pageToken;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: 'include'
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[PHYAT Bridge] API error:', response.status, errText.substring(0, 500));
      throw new Error(`API failed: ${response.status}`);
    }

    const data = await response.json();
    return parseAPIResponse(data);
  }

  // ============================================================
  //  Search videos (uses search_creator_entities endpoint)
  // ============================================================

  async function searchChannelVideos(query) {
    // First try: filter cached videos (supports multi-word search)
    if (_allVideosCache.length > 0) {
      const filtered = filterByMultipleTerms(_allVideosCache, query);
      if (filtered.length > 0) {
        return { videos: filtered, nextPageToken: null, totalResults: filtered.length };
      }
    }

    // Second try: API search
    const headers = await buildHeaders();
    const context = buildContext();
    const apiKey = getYtcfgValue('INNERTUBE_API_KEY');

    const url = `https://studio.youtube.com/youtubei/v1/creator/search_creator_entities?alt=json${apiKey ? '&key=' + apiKey : ''}`;

    const body = {
      context,
      numVideos: 50,
      query: query
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: 'include'
    });

    if (!response.ok) {
      // Last fallback: filter cached + DOM videos
      const allVids = _allVideosCache.length > 0 ? _allVideosCache : scrapeVideosFromDOM();
      const filtered = filterByMultipleTerms(allVids, query);
      return { videos: filtered, nextPageToken: null, totalResults: filtered.length };
    }

    const data = await response.json();

    // Parse search response (different structure)
    const videos = [];
    const items = data.video || data.videos || [];

    for (const item of items) {
      const video = item.video || item;
      const videoId = video.videoId;
      if (!videoId) continue;

      videos.push({
        videoId,
        title: extractTitle(video),
        thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        duration: formatDuration(parseInt(video.lengthSeconds || '0')),
        viewCount: '0',
        publishedAt: video.publicTimeSeconds
          ? new Date(parseInt(video.publicTimeSeconds) * 1000).toISOString()
          : ''
      });
    }

    return { videos, nextPageToken: null, totalResults: videos.length };
  }

  /**
   * Filter videos by multiple search terms (all terms must match)
   */
  function filterByMultipleTerms(videos, query) {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0) return videos;

    return videos.filter(v => {
      const title = (v.title || '').toLowerCase();
      return terms.every(term => title.includes(term));
    });
  }

  // ============================================================
  //  Extract title from various YouTube API response formats
  // ============================================================

  function extractTitle(video) {
    const t = video.title;
    // Direct string
    if (typeof t === 'string' && t) return t;
    // InnerTube object formats
    if (t && typeof t === 'object') {
      if (t.originalTitle) return t.originalTitle;
      if (t.simpleText) return t.simpleText;
      if (Array.isArray(t.runs) && t.runs.length) return t.runs.map(r => r.text).join('');
      // Nested value field
      if (typeof t.value === 'string' && t.value) return t.value;
      if (typeof t.text === 'string' && t.text) return t.text;
    }
    // Alternative field names used by YouTube Studio
    if (typeof video.titleText === 'string' && video.titleText) return video.titleText;
    if (typeof video.editTitle === 'string' && video.editTitle) return video.editTitle;
    if (video.snippet?.title) return video.snippet.title;
    // Deep search: walk top-level keys for any title-like string
    for (const key of Object.keys(video)) {
      if (/title/i.test(key) && typeof video[key] === 'string' && video[key]) return video[key];
    }
    console.warn('[PHYAT] Could not extract title. Keys:', Object.keys(video), 'title field:', JSON.stringify(t));
    return 'Untitled';
  }

  // ============================================================
  //  Parse API Response
  // ============================================================

  function parseAPIResponse(data) {
    const videos = [];
    const items = data.videos || data.items || [];

    // Debug: log the raw structure of first video items
    if (items.length > 0) {
      console.log('[PHYAT Bridge] Raw API response keys:', Object.keys(data));
      console.log('[PHYAT Bridge] First raw video item:', JSON.stringify(items[0]).substring(0, 2000));
      if (items.length > 1) {
        console.log('[PHYAT Bridge] Second raw video item:', JSON.stringify(items[1]).substring(0, 2000));
      }
    } else {
      console.warn('[PHYAT Bridge] No items found. Full response:', JSON.stringify(data).substring(0, 3000));
    }

    for (const item of items) {
      const video = item.video || item;
      const videoId = video.videoId;
      if (!videoId) continue;

      let thumbnail = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
      if (video.thumbnailDetails?.thumbnails?.length) {
        const thumbs = video.thumbnailDetails.thumbnails;
        const best = thumbs.reduce((a, b) => (b.width || 0) > (a.width || 0) ? b : a, thumbs[0]);
        if (best.url) thumbnail = best.url;
      }

      const lengthSeconds = parseInt(video.lengthSeconds || '0');
      const viewCount = video.metrics?.views || video.viewCount || '0';
      const publishTime = video.publicTimeSeconds || video.timeCreatedSeconds;
      const publishedAt = publishTime
        ? new Date(parseInt(publishTime) * 1000).toISOString()
        : '';

      videos.push({
        videoId,
        title: extractTitle(video),
        thumbnail,
        duration: formatDuration(lengthSeconds),
        viewCount: String(viewCount),
        publishedAt
      });
    }

    return {
      videos,
      nextPageToken: data.nextPageToken || null,
      totalResults: data.total || videos.length
    };
  }

  // ============================================================
  //  DOM Scraping Fallback
  // ============================================================

  function scrapeVideosFromDOM() {
    const videos = [];
    document.querySelectorAll('ytcp-video-row').forEach(row => {
      try {
        const link = row.querySelector('a[href*="/video/"]');
        if (!link) return;
        const match = link.href.match(/\/video\/([^/]+)/);
        if (!match) return;
        const videoId = match[1];
        // Try multiple selectors for title — YouTube Studio changes these
        const titleEl = row.querySelector('#video-title, .video-title-text, .video-title, [id*="video-title"], ytcp-video-list-cell-video .cell-body .video-column-text');
        const title = titleEl ? titleEl.textContent.trim() : 'Untitled';
        const imgEl = row.querySelector('img');
        const thumbnail = imgEl?.src || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
        videos.push({ videoId, title, thumbnail, duration: '', viewCount: '0', publishedAt: '' });
      } catch (e) { /* skip */ }
    });
    return videos;
  }

  // ============================================================
  //  Utilities
  // ============================================================

  function formatDuration(totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return '';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  // Signal ready
  window.postMessage({ source: 'phyat-bridge', action: 'ready' }, '*');
  console.log('[PHYAT Bridge] Loaded (v1.3.0 - with mask + multi-word search)');
})();

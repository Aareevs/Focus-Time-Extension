// Small helpers to make storage calls reliably promise-based across Chrome versions
function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (res) => resolve(res || {}));
  });
}
function storageSet(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => resolve());
  });
}

// Timer logic
const timerEl = document.getElementById('timer');
const startPauseBtn = document.getElementById('start-pause');
let running = false;
let startTime = 0;
let total = 0;
let interval;

function updateTimer() {
  const now = Date.now();
  const diff = total + (running ? now - startTime : 0);
  const s = Math.floor(diff / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2,'0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2,'0');
  const sec = String(s % 60).padStart(2,'0');
  timerEl.textContent = `${h}:${m}:${sec}`;
}

function updateStartPauseUI() {
  if (!startPauseBtn) return;
  startPauseBtn.textContent = running ? 'Pause' : 'Start';
}

function start() {
  if (!running) {
    running = true;
    startTime = Date.now();
    interval = setInterval(updateTimer, 500);
    if (timerEl) {
      timerEl.classList.add('running');
      timerEl.classList.remove('paused');
    }
    updateStartPauseUI();
  }
}
function pause() {
  if (running) {
    running = false;
    total += Date.now() - startTime;
    clearInterval(interval);
    if (timerEl) {
      timerEl.classList.add('paused');
      timerEl.classList.remove('running');
    }
    updateStartPauseUI();
  }
}
function reset() {
  running = false;
  total = 0;
  clearInterval(interval);
  updateTimer();
  if (timerEl) {
    timerEl.classList.remove('running');
    timerEl.classList.remove('paused');
  }
  updateStartPauseUI();
}

if (startPauseBtn) {
  startPauseBtn.onclick = () => (running ? pause() : start());
}
document.getElementById('reset').onclick = reset;

// Open options/settings from popup
function openOptions() {
  if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  else window.open('options.html');
}
const settingsBtn = document.getElementById('open-settings');
if (settingsBtn) settingsBtn.addEventListener('click', openOptions);
const settingsFooterBtn = document.getElementById('open-settings-footer');
if (settingsFooterBtn) settingsFooterBtn.addEventListener('click', openOptions);

// Focus Mode toggle (true => blocking ON, break_mode=false)
const focusToggle = document.getElementById('focus-toggle');
const content = document.getElementById('content');
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const ACTIVE_PANEL_KEY = 'focusmate_active_panel';

function openCollapsible(el) {
  if (!el) return;
  el.classList.add('open');
  // Set to measured height to animate
  const target = el.scrollHeight;
  el.style.maxHeight = target + 'px';
  // After transition, clear max-height so internal content can grow naturally
  const onEnd = (e) => {
    if (e.propertyName === 'max-height') {
      el.style.maxHeight = 'none';
      el.removeEventListener('transitionend', onEnd);
    }
  };
  el.addEventListener('transitionend', onEnd);
}

function closeCollapsible(el) {
  if (!el) return;
  // Set explicit current height to enable closing transition
  el.style.maxHeight = el.scrollHeight + 'px';
  // Force reflow so the browser acknowledges the current height before we collapse
  void el.offsetHeight;
  el.classList.remove('open');
  el.style.maxHeight = '0px';
}

function applyContentVisibility(isOn) {
  if (!content) return;
  if (isOn) openCollapsible(content);
  else closeCollapsible(content);
}

function activatePanel(id) {
  panels.forEach(p => p.classList.toggle('active', p.id === id));
  tabs.forEach(t => {
    const active = t.getAttribute('data-target') === id;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', String(active));
  });
  storageSet({ [ACTIVE_PANEL_KEY]: id });
}

// Topic and blocklist elements
const topicInput = document.getElementById('topic-input');
const addTopicBtn = document.getElementById('add-topic');
const manualBlockInput = document.getElementById('manual-block');
const blockSiteBtn = document.getElementById('block-site');
const blockedListEl = document.getElementById('blocked-list');
const blockCurrentBtn = document.getElementById('block-current');
const topicsListEl = document.getElementById('topics-list');

const TOPICS_KEY = 'focusmate_topics';

// Screen Time elements
const currentSiteEl = document.getElementById('current-site');
const siteTimeEl = document.getElementById('site-time');
const resetSiteTimeBtn = document.getElementById('reset-site-time');
const usageListEl = document.getElementById('usage-list');

let screenTimeInterval = null;
let currentHostname = '';
let siteStartTime = Date.now();

// Screen Time functionality
function formatTime(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

async function getCurrentTabHostname() {
  try {
    const tabs = await new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
    const tab = Array.isArray(tabs) ? tabs[0] : tabs;
    if (tab?.url) {
      try {
        const url = new URL(tab.url);
        return url.hostname.replace(/^www\./, '');
      } catch {
        return '';
      }
    }
  } catch (e) {
    console.warn('Failed to get current tab:', e);
  }
  return '';
}

async function updateScreenTime() {
  const hostname = await getCurrentTabHostname();
  
  if (hostname !== currentHostname) {
    // Save time for previous site
    if (currentHostname) {
      const timeSpent = Math.floor((Date.now() - siteStartTime) / 1000);
      await saveSiteTime(currentHostname, timeSpent);
    }
    
    // Reset for new site
    currentHostname = hostname;
    siteStartTime = Date.now();
    
    if (currentSiteEl) {
      currentSiteEl.textContent = hostname ? `Current: ${hostname}` : 'Current: None';
    }
  }
  
  // Update current site timer
  if (hostname && siteTimeEl) {
    const currentTime = Math.floor((Date.now() - siteStartTime) / 1000);
    siteTimeEl.textContent = formatTime(currentTime);
  }
  
  // Update usage list
  await updateUsageList();
}

async function saveSiteTime(hostname, seconds) {
  if (!hostname || seconds <= 0) return;
  
  const key = `screentime_${hostname}`;
  const data = await storageGet([key]);
  const existing = data[key] || 0;
  await storageSet({ [key]: existing + seconds });
}

async function getSiteTime(hostname) {
  if (!hostname) return 0;
  const key = `screentime_${hostname}`;
  const data = await storageGet([key]);
  return data[key] || 0;
}

async function resetSiteTime(hostname) {
  if (!hostname) return;
  const key = `screentime_${hostname}`;
  await storageSet({ [key]: 0 });
}

async function updateUsageList() {
  if (!usageListEl) return;
  
  // Get all screen time data
  const data = await storageGet(null);
  const usage = [];
  
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('screentime_') && value > 0) {
      const hostname = key.replace('screentime_', '');
      usage.push({ hostname, time: value });
    }
  }
  
  // Sort by time spent (descending)
  usage.sort((a, b) => b.time - a.time);
  
  // Display top 5 sites
  usageListEl.innerHTML = '';
  const displayCount = Math.min(5, usage.length);
  
  for (let i = 0; i < displayCount; i++) {
    const { hostname, time } = usage[i];
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    li.style.alignItems = 'center';
    li.style.padding = '4px 0';
    
    const siteSpan = document.createElement('span');
    siteSpan.textContent = hostname;
    siteSpan.style.fontSize = '12px';
    siteSpan.style.color = 'var(--text)';
    
    const timeSpan = document.createElement('span');
    timeSpan.textContent = formatTime(time);
    timeSpan.style.fontSize = '11px';
    timeSpan.style.color = 'var(--muted)';
    timeSpan.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    
    li.appendChild(siteSpan);
    li.appendChild(timeSpan);
    usageListEl.appendChild(li);
  }
  
  if (usage.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No usage data yet';
    li.style.color = 'var(--muted)';
    li.style.fontSize = '12px';
    li.style.textAlign = 'center';
    li.style.padding = '8px 0';
    usageListEl.appendChild(li);
  }
}

// Reset current site time
if (resetSiteTimeBtn) {
  resetSiteTimeBtn.addEventListener('click', async () => {
    if (currentHostname) {
      await resetSiteTime(currentHostname);
      siteStartTime = Date.now();
      if (siteTimeEl) {
        siteTimeEl.textContent = '00:00:00';
      }
      await updateUsageList();
    }
  });
}

function normalizeDomain(s) {
  try {
    s = s.trim();
    if (!s) return '';
    // remove protocol and path
    if (!s.startsWith('http')) s = 'https://' + s;
    const u = new URL(s);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return s.split('/')[0].replace(/^www\./, '').trim();
  }
}

function renderBlocked(list) {
  blockedListEl.innerHTML = '';
  (Array.isArray(list) ? list : []).forEach(site => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = site;
    span.className = 'site';
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.className = 'remove';
    removeBtn.addEventListener('click', async () => {
      const { focusmate_blocklist = [] } = await storageGet('focusmate_blocklist');
      const next = (focusmate_blocklist || []).filter(s => s !== site);
      await storageSet({ focusmate_blocklist: next });
      renderBlocked(next);
    });
    li.appendChild(span);
    li.appendChild(removeBtn);
    blockedListEl.appendChild(li);
  });
}

// Add functionality for recommended sites buttons
function addRecommendedSite(site) {
  return async function() {
    const { focusmate_blocklist = [] } = await storageGet('focusmate_blocklist');
    const set = new Set(focusmate_blocklist);
    set.add(site);
    const next = Array.from(set);
    await storageSet({ focusmate_blocklist: next });
    renderBlocked(next);
  };
}

// Add event listeners for recommended sites buttons
function setupRecommendedSites() {
  const recommendedContainer = document.getElementById('recommended-sites');
  if (!recommendedContainer) return;

  // Use event delegation for the recommended sites container
  recommendedContainer.addEventListener('click', async function(e) {
    if (e.target.tagName === 'BUTTON' && e.target.hasAttribute('data-site')) {
      const site = e.target.getAttribute('data-site');
      const { focusmate_blocklist = [] } = await storageGet('focusmate_blocklist');
      const set = new Set(focusmate_blocklist);
      
      if (!set.has(site)) {
        set.add(site);
        const next = Array.from(set);
        await storageSet({ focusmate_blocklist: next });
        renderBlocked(next);
        
        // Add visual feedback
        e.target.style.background = 'var(--accent)';
        e.target.style.color = 'white';
        e.target.style.borderColor = 'var(--accent)';
        e.target.textContent = '✓ ' + e.target.textContent;
        
        // Revert after 1.5 seconds
        setTimeout(() => {
          e.target.style.background = '';
          e.target.style.color = '';
          e.target.style.borderColor = '';
          e.target.textContent = e.target.textContent.replace('✓ ', '');
        }, 1500);
      }
    }
  });
}

function renderTopics(list, active) {
  if (!topicsListEl) return;
  topicsListEl.innerHTML = '';
  (Array.isArray(list) ? list : []).forEach(topic => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = topic;
    span.className = 'site' + (active && active === topic ? ' active' : '');
    span.title = 'Click to set as active topic';
    span.addEventListener('click', async () => {
      await storageSet({ focusmate_topic: topic });
      const data = await storageGet([TOPICS_KEY]);
      const topics = Array.isArray(data[TOPICS_KEY]) ? data[TOPICS_KEY] : [];
      renderTopics(topics, topic);
      topicInput.value = topic;
    });

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.className = 'remove';
    removeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const data = await storageGet([TOPICS_KEY, 'focusmate_topic']);
      const topics = Array.isArray(data[TOPICS_KEY]) ? data[TOPICS_KEY] : [];
      const next = topics.filter(t => t !== topic);
      const updates = { [TOPICS_KEY]: next };
      if (data.focusmate_topic === topic) {
        updates['focusmate_topic'] = next[0] || '';
        topicInput.value = updates['focusmate_topic'] || '';
      }
      await storageSet(updates);
      renderTopics(next, updates['focusmate_topic'] ?? active);
    });

    li.appendChild(span);
    li.appendChild(removeBtn);
    topicsListEl.appendChild(li);
  });
}

addTopicBtn.addEventListener('click', async () => {
  const v = (topicInput.value || '').trim();
  if (!v) return;
  const data = await storageGet([TOPICS_KEY, 'focusmate_topic']);
  const topics = Array.isArray(data[TOPICS_KEY]) ? data[TOPICS_KEY] : [];
  const set = new Set(topics);
  set.add(v);
  const nextTopics = Array.from(set);
  await storageSet({ [TOPICS_KEY]: nextTopics, focusmate_topic: v });
  renderTopics(nextTopics, v);
});

blockSiteBtn.addEventListener('click', async () => {
  const raw = manualBlockInput.value;
  if (!raw.trim()) return;
  const parts = raw.split(',');
  const toAdd = parts.map(normalizeDomain).filter(Boolean);
  const { focusmate_blocklist = [] } = await storageGet('focusmate_blocklist');
  const set = new Set(focusmate_blocklist);
  toAdd.forEach(s => set.add(s));
  const next = Array.from(set);
  await storageSet({ focusmate_blocklist: next });
  manualBlockInput.value = '';
  renderBlocked(next);
});

if (blockCurrentBtn) {
  blockCurrentBtn.addEventListener('click', async () => {
    try {
      const tabs = await new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
      const tab = Array.isArray(tabs) ? tabs[0] : tabs;
      const url = tab?.url;
      if (!url) return;
      let host = '';
      try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return; // ignore chrome://, file://, etc.
        host = u.hostname.replace(/^www\./, '');
      } catch {
        return;
      }
      const { focusmate_blocklist = [] } = await storageGet('focusmate_blocklist');
      const set = new Set(focusmate_blocklist || []);
      set.add(host);
      const next = Array.from(set);
      await storageSet({ focusmate_blocklist: next });
      renderBlocked(next);
    } catch (e) {
      console.warn('Failed to block current site', e);
    }
  });
}

async function setFocusMode(isOn) {
  await storageSet({ focusmate_break_mode: !isOn });
  applyContentVisibility(isOn);
  if (focusToggle) {
    focusToggle.classList.toggle('on', isOn);
  }
}

if (focusToggle) {
  focusToggle.addEventListener('click', async () => {
    const { focusmate_break_mode = false } = await storageGet('focusmate_break_mode');
    const isOn = !Boolean(focusmate_break_mode);
    setFocusMode(!isOn);
  });
  // Keyboard accessibility
  focusToggle.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const { focusmate_break_mode = false } = await storageGet('focusmate_break_mode');
      const isOn = !Boolean(focusmate_break_mode);
      setFocusMode(!isOn);
    }
  });
}

// Wire Tabs
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const id = tab.getAttribute('data-target');
    if (id) activatePanel(id);
  });
});

// Initialize UI with saved values
(async function init() {
  try {
    const { focusmate_topic = '', focusmate_blocklist = [], focusmate_break_mode = false, [TOPICS_KEY]: topics = [], [ACTIVE_PANEL_KEY]: savedPanel } = await storageGet([
      'focusmate_topic',
      'focusmate_blocklist',
      'focusmate_break_mode',
      TOPICS_KEY,
      ACTIVE_PANEL_KEY
    ]);
    topicInput.value = focusmate_topic || '';
    const isOn = !Boolean(focusmate_break_mode);
    // Initialize collapsed/open state without jitter
    if (isOn) {
      content.classList.add('open');
      content.style.maxHeight = 'none';
    } else {
      content.classList.remove('open');
      content.style.maxHeight = '0px';
    }
    if (focusToggle) focusToggle.classList.toggle('on', isOn);
    renderBlocked(Array.isArray(focusmate_blocklist) ? focusmate_blocklist : []);
    renderTopics(Array.isArray(topics) ? topics : [], focusmate_topic);
    setupRecommendedSites(); // Setup recommended sites functionality
    updateTimer();
    updateStartPauseUI();

    // Initialize Screen Time
    await updateScreenTime();
    if (!screenTimeInterval) {
      screenTimeInterval = setInterval(updateScreenTime, 1000);
    }

    // Activate saved panel or default to timer
    activatePanel(savedPanel || 'panel-timer');
  } catch (e) {
    console.warn('Failed to init popup state', e);
  }
})();

// Cleanup on popup close
window.addEventListener('beforeunload', async () => {
  if (screenTimeInterval) {
    clearInterval(screenTimeInterval);
  }
  // Save current site time before closing
  if (currentHostname) {
    const timeSpent = Math.floor((Date.now() - siteStartTime) / 1000);
    await saveSiteTime(currentHostname, timeSpent);
  }
});
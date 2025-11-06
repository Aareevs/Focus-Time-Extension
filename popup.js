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

// Zen Mode toggle (true => blocking ON, break_mode=false)
const zenToggle = document.getElementById('zen-toggle');
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

// Pomodoro elements
const pomoWorkInput = document.getElementById('pomo-work');
const pomoBreakInput = document.getElementById('pomo-break');
const pomoTimerEl = document.getElementById('pomo-timer');
const pomoStartPauseBtn = document.getElementById('pomo-start-pause');
const pomoResetBtn = document.getElementById('pomo-reset');
const pomoCyclesEl = document.getElementById('pomo-cycles');
const pomoPhaseEl = document.getElementById('pomo-phase');

let pomoRunning = false;
let pomoInterval = null;
let pomoPhase = 'Work'; // 'Work' | 'Break'
let pomoSecondsLeft = 25 * 60;
let pomoCycles = 0;

function intBetween(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (Number.isFinite(n)) return Math.min(max, Math.max(min, n));
  return fallback;
}

function fmtMMSS(totalSeconds) {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function updatePomoUI() {
  if (pomoTimerEl) pomoTimerEl.textContent = fmtMMSS(pomoSecondsLeft);
  if (pomoCyclesEl) pomoCyclesEl.textContent = String(pomoCycles);
  if (pomoPhaseEl) pomoPhaseEl.textContent = pomoPhase;
  if (pomoTimerEl) {
    pomoTimerEl.classList.toggle('running', pomoRunning);
    pomoTimerEl.classList.toggle('paused', !pomoRunning);
  }
}

function updatePomoStartPauseUI() {
  if (!pomoStartPauseBtn) return;
  pomoStartPauseBtn.textContent = pomoRunning ? 'Pause' : 'Start';
}

function setPomoPhase(nextPhase) {
  pomoPhase = nextPhase;
  const workMin = intBetween(pomoWorkInput?.value || 25, 1, 180, 25);
  const breakMin = intBetween(pomoBreakInput?.value || 5, 1, 60, 5);
  pomoSecondsLeft = (nextPhase === 'Work' ? workMin : breakMin) * 60;
  updatePomoUI();
}

function tickPomodoro() {
  if (!pomoRunning) return;
  pomoSecondsLeft -= 1;
  if (pomoSecondsLeft <= 0) {
    if (pomoPhase === 'Work') {
      pomoCycles += 1;
      setPomoPhase('Break');
    } else {
      setPomoPhase('Work');
    }
  }
  updatePomoUI();
}

function startPomodoro() {
  if (pomoRunning) return;
  pomoRunning = true;
  if (!pomoInterval) pomoInterval = setInterval(tickPomodoro, 1000);
  updatePomoUI();
  updatePomoStartPauseUI();
}

function pausePomodoro() {
  if (!pomoRunning) return;
  pomoRunning = false;
  updatePomoUI();
  updatePomoStartPauseUI();
}

function resetPomodoro() {
  pomoRunning = false;
  clearInterval(pomoInterval);
  pomoInterval = setInterval(tickPomodoro, 1000); // keep interval for immediate start later
  pomoCycles = 0;
  setPomoPhase('Work');
  updatePomoUI();
  updatePomoStartPauseUI();
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

async function setZenMode(isOn) {
  await storageSet({ focusmate_break_mode: !isOn });
  applyContentVisibility(isOn);
  if (zenToggle) {
    zenToggle.classList.toggle('on', isOn);
  }
}

if (zenToggle) {
  zenToggle.addEventListener('click', async () => {
    const { focusmate_break_mode = false } = await storageGet('focusmate_break_mode');
    const isOn = !Boolean(focusmate_break_mode);
    setZenMode(!isOn);
  });
  // Keyboard accessibility
  zenToggle.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const { focusmate_break_mode = false } = await storageGet('focusmate_break_mode');
      const isOn = !Boolean(focusmate_break_mode);
      setZenMode(!isOn);
    }
  });
}

// Wire Pomodoro controls
if (pomoStartPauseBtn) pomoStartPauseBtn.addEventListener('click', () => (pomoRunning ? pausePomodoro() : startPomodoro()));
if (pomoResetBtn) pomoResetBtn.addEventListener('click', resetPomodoro);
if (pomoWorkInput) pomoWorkInput.addEventListener('change', () => {
  if (!pomoRunning && pomoPhase === 'Work') setPomoPhase('Work');
});
if (pomoBreakInput) pomoBreakInput.addEventListener('change', () => {
  if (!pomoRunning && pomoPhase === 'Break') setPomoPhase('Break');
});

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
    if (zenToggle) zenToggle.classList.toggle('on', isOn);
  renderBlocked(Array.isArray(focusmate_blocklist) ? focusmate_blocklist : []);
  renderTopics(Array.isArray(topics) ? topics : [], focusmate_topic);
    updateTimer();
  updateStartPauseUI();

    // Initialize Pomodoro defaults
    if (pomoWorkInput && !pomoWorkInput.value) pomoWorkInput.value = '25';
    if (pomoBreakInput && !pomoBreakInput.value) pomoBreakInput.value = '5';
    setPomoPhase('Work');
    // prepare ticking; not running until user hits Start
    if (!pomoInterval) pomoInterval = setInterval(tickPomodoro, 1000);
  updatePomoStartPauseUI();

    // Activate saved panel or default to timer
    activatePanel(savedPanel || 'panel-timer');
  } catch (e) {
    console.warn('Failed to init popup state', e);
  }
})();
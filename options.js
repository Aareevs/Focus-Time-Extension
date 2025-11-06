const input = document.getElementById('api-key');
const save = document.getElementById('save');
const clear = document.getElementById('clear');
const toggle = document.getElementById('toggle-visibility');
const toggleLabel = document.getElementById('toggle-label');
const status = document.getElementById('status');

function setStatus(txt, ms = 2000) {
  status.textContent = txt || '';
  if (ms && txt) setTimeout(() => (status.textContent = ''), ms);
}

chrome.storage.local.get('focusmate_api_key', data => {
  input.value = data.focusmate_api_key || '';
});

function applyToggle(on) {
  input.type = on ? 'text' : 'password';
  if (toggle) {
    toggle.classList.toggle('on', on);
    toggle.setAttribute('aria-checked', String(on));
  }
}

if (toggle) {
  toggle.addEventListener('click', () => {
    const isOn = toggle.classList.contains('on');
    applyToggle(!isOn);
  });
  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const isOn = toggle.classList.contains('on');
      applyToggle(!isOn);
    }
  });
}

if (toggleLabel) {
  toggleLabel.addEventListener('click', () => {
    const isOn = toggle.classList.contains('on');
    applyToggle(!isOn);
  });
}

// initialize toggle state based on current input type
applyToggle(input?.type === 'text');

save.onclick = () => {
  const v = input.value.trim();
  if (!v) return setStatus('Enter a non-empty key');
  chrome.storage.local.set({ focusmate_api_key: v }, () => {
    setStatus('Saved');
  });
};

clear.onclick = () => {
  if (!confirm('Clear saved API key?')) return;
  chrome.storage.local.remove('focusmate_api_key', () => {
    input.value = '';
    setStatus('Cleared');
  });
};
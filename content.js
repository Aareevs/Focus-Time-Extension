// Content script: relays window messages to background
console.log('ZEN MODE content script active');

window.addEventListener('message', (event) => {
	// Only accept messages from the same window context
	if (event.source !== window) return;
	const data = event.data;
	if (!data || typeof data !== 'object') return;

	if (data.type === 'FOCUSMATE_ALLOW' && typeof data.minutes === 'number') {
		try {
			chrome.runtime.sendMessage({ type: 'ALLOW_DOMAIN', minutes: data.minutes, domain: location.hostname });
		} catch (e) {
			// In rare cases chrome.runtime may be unavailable; ignore
			console.warn('Failed to send allow message', e);
		}
	}
});
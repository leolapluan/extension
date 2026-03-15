// background.js — Service Worker for Personal Tips Extension
// Global interval: one shared alarm picks a random active tip each cycle.

const ALARM_NAME = 'tips-global-interval';

// ─── Alarm Management ────────────────────────────────────────────────────────

async function getConfig() {
    const { globalConfig = { intervalMs: 1800000 } } = await chrome.storage.sync.get('globalConfig');
    return globalConfig;
}

async function scheduleGlobalAlarm() {
    const config = await getConfig();
    const delayMinutes = config.intervalMs / 60000;
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: delayMinutes });
}

// ─── Show Tip ─────────────────────────────────────────────────────────────────

async function showRandomTip() {
    const { tips = [] } = await chrome.storage.sync.get('tips');
    const activeTips = tips.filter(t => t.status === 'active');
    if (activeTips.length === 0) return;

    const tip = activeTips[Math.floor(Math.random() * activeTips.length)];
    await displayTip(tip.text);
}

/** Send tip to the active tab's content script as a scrolling ticker.
 *  Falls back to a Chrome notification if the tab can't receive messages. */
async function displayTip(text) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab && tab.id && /^https?:/.test(tab.url || '')) {
            await chrome.tabs.sendMessage(tab.id, { type: 'SHOW_TIP', text });
            return;
        }
    } catch (_) {
        // Tab can't receive messages — fall through to notification
    }

    // Fallback: Chrome notification
    chrome.notifications.create(`notif-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icon128.png',
        title: '💡 Personal Tip',
        message: text,
        priority: 1,
    });
}

// ─── Event Listeners ─────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(scheduleGlobalAlarm);
chrome.runtime.onStartup.addListener(scheduleGlobalAlarm);

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    await showRandomTip();
});

/** Handle messages from popup (test button) */
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'MANUAL_TEST') {
        showRandomTip();
    }
});

/** React to storage changes — restart alarm if global config changed */
chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'sync') return;
    if (changes.globalConfig) {
        await scheduleGlobalAlarm();
    }
});

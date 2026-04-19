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
    const allData = await chrome.storage.sync.get(null);
    let activeTips = [];
    
    for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith('tip-') && value.status === 'active') {
            activeTips.push(value);
        } else if (key === 'tips' && Array.isArray(value)) {
            activeTips.push(...value.filter(t => t.status === 'active'));
        }
    }

    if (activeTips.length === 0) return;

    const config = await getConfig();
    const selectedTag = config.selectedTag;
    
    if (selectedTag && selectedTag !== 'all') {
        if (selectedTag === 'uncategorized') {
            activeTips = activeTips.filter(t => {
                const matches = t.text.match(/#\p{L}[\p{L}\p{N}_-]*/gu);
                return !matches || matches.length === 0;
            });
        } else {
            activeTips = activeTips.filter(t => {
                const matches = t.text.match(/#\p{L}[\p{L}\p{N}_-]*/gu);
                const tags = matches ? matches.map(tag => tag.toLowerCase()) : [];
                return tags.includes(selectedTag);
            });
        }
    }

    if (activeTips.length === 0) return;

    const tip = activeTips[Math.floor(Math.random() * activeTips.length)];
    const displayStr = tip.text.replace(/#\p{L}[\p{L}\p{N}_-]*/gu, '').replace(/\s{2,}/g, ' ').trim();
    await displayTip(tip.id, displayStr, config.scrollSpeed || 150);
}

/** Send tip to the active tab's content script as a scrolling ticker.
 *  Falls back to a Chrome notification if the tab can't receive messages. */
async function displayTip(tipId, text, scrollSpeed = 150) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab && tab.id && /^https?:/.test(tab.url || '')) {
            // Inject content script on-demand for existing tabs
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
            
            // Send message after ensuring script is injected
            chrome.tabs.sendMessage(tab.id, { type: 'SHOW_TIP', tipId, text, scrollSpeed });
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

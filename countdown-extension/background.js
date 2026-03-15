// background.js — service worker for countdown timer

const ALARM_NAME = 'countdown-tick';
const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html');

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) return;

    const data = await chrome.storage.local.get(['timerEndMs', 'timerState']);
    if (data.timerState !== 'running') return;

    const now = Date.now();
    const remaining = data.timerEndMs - now;

    if (remaining <= 0) {
        // Timer done
        await chrome.storage.local.set({
            timerState: 'done',
            timerRemainingMs: 0,
        });
        chrome.alarms.clear(ALARM_NAME);

        // Play chime via offscreen document
        await playDoneSound();

        // Fire notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon128.png',
            title: '⏱ Timer Done!',
            message: 'Your countdown has finished.',
            priority: 2,
        });
    } else {
        await chrome.storage.local.set({ timerRemainingMs: remaining });
    }
});

async function playDoneSound() {
    // Check if offscreen document is already open
    const existing = await chrome.offscreen.hasDocument?.();
    if (!existing) {
        await chrome.offscreen.createDocument({
            url: OFFSCREEN_URL,
            reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
            justification: 'Play chime when countdown timer finishes',
        });
    }

    // Send message to the offscreen doc to play the chime
    chrome.runtime.sendMessage({ type: 'PLAY_DONE_SOUND' });

    // Close the offscreen doc after the chime has had time to play (~1.5s)
    setTimeout(async () => {
        try { await chrome.offscreen.closeDocument(); } catch (_) { }
    }, 2000);
}

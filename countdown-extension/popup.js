// popup.js — Countdown Timer Extension

const CIRCUMFERENCE = 2 * Math.PI * 80; // r=80 => ~502.65
const ALARM_NAME = 'countdown-tick';

// DOM refs
const displayTime = document.getElementById('display-time');
const displayLabel = document.getElementById('display-label');
const ringProgress = document.getElementById('ring-progress');
const inputH = document.getElementById('input-hours');
const inputM = document.getElementById('input-minutes');
const inputS = document.getElementById('input-seconds');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const statusTag = document.getElementById('status-tag');

// Ring setup
ringProgress.style.strokeDasharray = CIRCUMFERENCE;
ringProgress.style.strokeDashoffset = 0;

let pollInterval = null;
let totalMs = 0;        // total duration for this run
let state = 'idle';     // 'idle' | 'running' | 'paused' | 'done'

// ── Helpers ──────────────────────────────────────────────────────────────────

function pad(n) { return String(Math.floor(n)).padStart(2, '0'); }

function msToHMS(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return { h, m, sec };
}

function hmsToMs(h, m, s) {
    return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000;
}

function setDisplay(ms) {
    const { h, m, sec } = msToHMS(ms);
    displayTime.textContent = `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function setRing(remainingMs, totalMs) {
    const ratio = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
    ringProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - ratio);
}

function setStatus(s) {
    state = s;
    statusTag.className = 'status-tag';
    switch (s) {
        case 'running':
            statusTag.textContent = '● Running';
            statusTag.classList.add('running');
            displayLabel.textContent = 'remaining';
            btnStart.textContent = '▶ Start'; btnStart.disabled = true;
            btnPause.textContent = '⏸ Pause'; btnPause.disabled = false;
            setInputsDisabled(true);
            break;
        case 'paused':
            statusTag.textContent = '⏸ Paused';
            statusTag.classList.add('paused');
            displayLabel.textContent = 'paused';
            btnStart.textContent = '▶ Resume'; btnStart.disabled = false;
            btnPause.textContent = '⏸ Pause'; btnPause.disabled = true;
            setInputsDisabled(true);
            break;
        case 'done':
            statusTag.textContent = '✓ Done!';
            statusTag.classList.add('done');
            displayLabel.textContent = 'done';
            btnStart.textContent = '▶ Start'; btnStart.disabled = true;
            btnPause.textContent = '⏸ Pause'; btnPause.disabled = true;
            setInputsDisabled(false);
            stopPoll();
            setDisplay(0);
            setRing(0, 1);
            break;
        default: // idle
            statusTag.textContent = 'Set a duration above';
            displayLabel.textContent = 'ready';
            btnStart.textContent = '▶ Start'; btnStart.disabled = false;
            btnPause.textContent = '⏸ Pause'; btnPause.disabled = true;
            setInputsDisabled(false);
    }
}

function setInputsDisabled(disabled) {
    inputH.disabled = disabled;
    inputM.disabled = disabled;
    inputS.disabled = disabled;
}

// ── Polling ───────────────────────────────────────────────────────────────────

function startPoll() {
    stopPoll();
    pollInterval = setInterval(syncFromStorage, 500);
}

function stopPoll() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

async function syncFromStorage() {
    const data = await chrome.storage.local.get([
        'timerState', 'timerEndMs', 'timerRemainingMs', 'timerTotalMs'
    ]);

    const storageState = data.timerState || 'idle';
    const remaining = (storageState === 'running')
        ? Math.max(0, data.timerEndMs - Date.now())
        : (data.timerRemainingMs ?? 0);
    const total = data.timerTotalMs || 1;

    setDisplay(remaining);
    setRing(remaining, total);

    if (storageState !== state) {
        setStatus(storageState);
        if (storageState === 'idle' || storageState === 'done') stopPoll();
    }
}

// ── Load last-used duration on open ──────────────────────────────────────────

async function init() {
    const data = await chrome.storage.local.get([
        'lastDurationMs', 'timerState', 'timerEndMs', 'timerRemainingMs', 'timerTotalMs'
    ]);

    // Restore last‑used duration into inputs (always)
    if (data.lastDurationMs > 0) {
        const { h, m, sec } = msToHMS(data.lastDurationMs);
        inputH.value = h;
        inputM.value = m;
        inputS.value = sec;
    }

    const storageState = data.timerState || 'idle';
    totalMs = data.timerTotalMs || 0;

    if (storageState === 'running' || storageState === 'paused') {
        const remaining = storageState === 'running'
            ? Math.max(0, data.timerEndMs - Date.now())
            : (data.timerRemainingMs ?? 0);
        setDisplay(remaining);
        setRing(remaining, totalMs);
        setStatus(storageState);
        startPoll();
    } else if (storageState === 'done') {
        setDisplay(0);
        setRing(0, 1);
        setStatus('done');
    } else {
        // idle — show the last‑used time in the ring display too
        if (data.lastDurationMs > 0) setDisplay(data.lastDurationMs);
        setStatus('idle');
    }
}

// ── Button handlers ───────────────────────────────────────────────────────────

btnStart.addEventListener('click', async () => {
    const data = await chrome.storage.local.get(['timerState', 'timerRemainingMs', 'timerTotalMs']);
    const storageState = data.timerState || 'idle';

    if (storageState === 'paused') {
        // Resume: push endMs forward by remaining time
        const remaining = data.timerRemainingMs ?? 0;
        const endMs = Date.now() + remaining;
        await chrome.storage.local.set({ timerState: 'running', timerEndMs: endMs });
        await chrome.alarms.clear(ALARM_NAME);
        await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 / 60 }); // ~1s
        setStatus('running');
        startPoll();
        return;
    }

    // Fresh start
    const h = parseInt(inputH.value) || 0;
    const m = parseInt(inputM.value) || 0;
    const s = parseInt(inputS.value) || 0;
    const ms = hmsToMs(h, m, s);
    if (ms <= 0) return;

    totalMs = ms;
    const endMs = Date.now() + ms;

    await chrome.storage.local.set({
        timerState: 'running',
        timerEndMs: endMs,
        timerRemainingMs: ms,
        timerTotalMs: ms,
        lastDurationMs: ms,   // ← remember this as the new default
    });

    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 / 60 });

    setDisplay(ms);
    setRing(ms, ms);
    setStatus('running');
    startPoll();
});

btnPause.addEventListener('click', async () => {
    const data = await chrome.storage.local.get(['timerEndMs']);
    const remaining = Math.max(0, (data.timerEndMs || Date.now()) - Date.now());
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.storage.local.set({
        timerState: 'paused',
        timerRemainingMs: remaining,
    });
    setDisplay(remaining);
    setRing(remaining, totalMs);
    setStatus('paused');
    stopPoll();
});

btnReset.addEventListener('click', async () => {
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.storage.local.set({
        timerState: 'idle',
        timerRemainingMs: 0,
        timerEndMs: 0,
    });

    // Restore last-used duration in inputs & display
    const data = await chrome.storage.local.get('lastDurationMs');
    const last = data.lastDurationMs || 0;
    if (last > 0) {
        const { h, m, sec } = msToHMS(last);
        inputH.value = h;
        inputM.value = m;
        inputS.value = sec;
        totalMs = last;
        setDisplay(last);
        setRing(last, last);
    } else {
        setDisplay(0);
        setRing(0, 1);
    }

    setStatus('idle');
    stopPoll();
});

// ── Clamp inputs on blur ──────────────────────────────────────────────────────

[inputM, inputS].forEach((el) => {
    el.addEventListener('blur', () => {
        let v = parseInt(el.value);
        if (isNaN(v) || v < 0) v = 0;
        if (v > 59) v = 59;
        el.value = v;
    });
});
inputH.addEventListener('blur', () => {
    let v = parseInt(inputH.value);
    if (isNaN(v) || v < 0) v = 0;
    inputH.value = v;
});

init();

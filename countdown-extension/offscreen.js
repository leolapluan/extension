// offscreen.js — plays a pleasant chime when the timer ends

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PLAY_DONE_SOUND') {
        playChime();
    }
});

function playChime() {
    const ctx = new AudioContext();

    // Three-note ascending chime: C5 → E5 → G5
    const notes = [523.25, 659.25, 783.99];
    const noteLength = 0.28;   // seconds per note
    const gap = 0.06;          // gap between notes

    notes.forEach((freq, i) => {
        const start = i * (noteLength + gap);

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

        // Soft attack, gentle decay
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + noteLength);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + noteLength);
    });

    // Close the AudioContext automatically after the chime finishes
    const totalDuration = notes.length * (noteLength + gap) + 0.3;
    setTimeout(() => ctx.close(), totalDuration * 1000);
}

// content.js — Scrolling ticker overlay for Personal Tips

(function () {
    // Prevent duplicate injection
    if (window.__tipsTicker) return;
    window.__tipsTicker = true;

    // ── Styles ────────────────────────────────────────────────────────────────
    const STYLE = `
        #tips-ticker-root {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 2147483647;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            pointer-events: none;
        }

        #tips-ticker-bar {
            background: linear-gradient(90deg, #110a0a 0%, #1e0a0a 40%, #1e0a0a 60%, #110a0a 100%);
            border-top: 2px solid #e53e3e;
            box-shadow: 0 -4px 30px rgba(229, 62, 62, 0.35), 0 -1px 0 rgba(229, 62, 62, 0.2);
            height: 44px;
            display: flex;
            align-items: center;
            overflow: hidden;
            transform: translateY(100%);
            transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
            pointer-events: auto;
        }

        #tips-ticker-bar.visible {
            transform: translateY(0);
        }

        #tips-ticker-label {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            gap: 7px;
            padding: 0 14px 0 16px;
            border-right: 1px solid rgba(229, 62, 62, 0.3);
            height: 100%;
        }

        #tips-ticker-label .label-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #e53e3e;
            animation: tipPulse 1.4s ease-in-out infinite;
            box-shadow: 0 0 8px rgba(229, 62, 62, 0.8);
        }

        @keyframes tipPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50%       { transform: scale(0.6); opacity: 0.5; }
        }

        #tips-ticker-label .label-text {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #e53e3e;
        }

        #tips-ticker-scroll {
            flex: 1;
            overflow: hidden;
            height: 100%;
            display: flex;
            align-items: center;
            position: relative;
        }

        #tips-ticker-text {
            white-space: nowrap;
            font-size: 14px;
            font-weight: 500;
            color: #f5e6e6;
            letter-spacing: 0.01em;
            padding-left: 100%;
            animation: tickerScroll linear 1 forwards;
            will-change: transform;
        }

        @keyframes tickerScroll {
            0%   { transform: translateX(0); }
            100% { transform: translateX(calc(-100% - 100vw)); }
        }

        #tips-ticker-close {
            flex-shrink: 0;
            width: 36px;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(229, 62, 62, 0.6);
            cursor: pointer;
            font-size: 14px;
            transition: color 0.15s;
            border-left: 1px solid rgba(229, 62, 62, 0.2);
        }

        #tips-ticker-close:hover { color: #e53e3e; }
    `;

    // ── DOM ───────────────────────────────────────────────────────────────────
    const styleEl = document.createElement('style');
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);

    const root = document.createElement('div');
    root.id = 'tips-ticker-root';
    root.innerHTML = `
        <div id="tips-ticker-bar">
            <div id="tips-ticker-label">
                <div class="label-dot"></div>
                <span class="label-text">Tip</span>
            </div>
            <div id="tips-ticker-scroll">
                <span id="tips-ticker-text"></span>
            </div>
            <div id="tips-ticker-close">✕</div>
        </div>
    `;
    document.body.appendChild(root);

    const bar      = root.querySelector('#tips-ticker-bar');
    const textEl   = root.querySelector('#tips-ticker-text');
    const closeBtn = root.querySelector('#tips-ticker-close');

    let hideTimer = null;

    function showTip(text) {
        // Reset
        clearTimeout(hideTimer);
        textEl.style.animation = 'none';
        textEl.textContent = text;
        bar.classList.add('visible');

        // Calculate scroll duration based on text length: roughly 80px/sec, min 6s
        const duration = Math.max(6, text.length * 0.12);
        // Force reflow before re-applying animation
        void textEl.offsetWidth;
        textEl.style.animation = `tickerScroll ${duration}s linear 1 forwards`;

        // Hide after scroll completes + 0.5s buffer
        hideTimer = setTimeout(hide, (duration + 0.5) * 1000);
    }

    function hide() {
        bar.classList.remove('visible');
    }

    closeBtn.addEventListener('click', () => {
        clearTimeout(hideTimer);
        hide();
    });

    // ── Message Listener ──────────────────────────────────────────────────────
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'SHOW_TIP') {
            showTip(msg.text);
        }
    });
})();

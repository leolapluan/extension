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
            will-change: transform;
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

    // Add Modal to HTML
    const modalHtml = `
        <div id="tips-modal-backdrop" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 2147483648; align-items: center; justify-content: center; backdrop-filter: blur(2px); pointer-events: auto;">
            <div id="tips-modal" style="background: #1a0e0e; border: 1px solid #3a1a1a; border-radius: 12px; padding: 24px; max-width: 400px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.5); position: relative;">
                <div id="tips-modal-close" style="position: absolute; top: 12px; right: 12px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: rgba(229, 62, 62, 0.6); border-radius: 50%; font-size: 14px; transition: color 0.15s;">✕</div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid #3a1a1a; padding-bottom: 12px;">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: #e53e3e; box-shadow: 0 0 8px rgba(229, 62, 62, 0.8);"></div>
                    <span style="color: #e53e3e; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">Tip</span>
                </div>
                <textarea id="tips-modal-content" style="width: 100%; min-height: 100px; background: rgba(255,255,255,0.02); border: 1px solid #3a1a1a; color: #f5e6e6; font-size: 16px; line-height: 1.6; font-weight: 400; word-wrap: break-word; resize: vertical; border-radius: 8px; padding: 12px; margin-bottom: 16px; font-family: inherit; box-sizing: border-box; outline: none; transition: border-color 0.2s;"></textarea>
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button id="tips-modal-inactive" style="background: transparent; color: #e53e3e; border: 1px solid rgba(229, 62, 62, 0.4); border-radius: 6px; padding: 8px 16px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;">Mark Inactive</button>
                    <button id="tips-modal-save" style="background: #e53e3e; color: white; border: none; border-radius: 6px; padding: 8px 16px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s;">Save</button>
                </div>
            </div>
        </div>
    `;
    root.insertAdjacentHTML('beforeend', modalHtml);

    const bar      = root.querySelector('#tips-ticker-bar');
    const textEl   = root.querySelector('#tips-ticker-text');
    const closeBtn = root.querySelector('#tips-ticker-close');
    const backdrop = root.querySelector('#tips-modal-backdrop');
    const modalContent = root.querySelector('#tips-modal-content');
    const modalClose = root.querySelector('#tips-modal-close');
    const modalSave  = root.querySelector('#tips-modal-save');
    const modalInactive = root.querySelector('#tips-modal-inactive');

    let hideTimer = null;
    let currentTipText = '';
    let currentTipId = null;

    modalClose.addEventListener('click', () => {
        backdrop.style.display = 'none';
        hide();
    });
    
    // Add hover effect for modal close button
    modalClose.addEventListener('mouseenter', () => modalClose.style.color = '#e53e3e');
    modalClose.addEventListener('mouseleave', () => modalClose.style.color = 'rgba(229, 62, 62, 0.6)');

    modalSave.addEventListener('mouseenter', () => modalSave.style.background = '#c53030');
    modalSave.addEventListener('mouseleave', () => modalSave.style.background = '#e53e3e');

    modalInactive.addEventListener('mouseenter', () => { modalInactive.style.background = 'rgba(229, 62, 62, 0.1)'; modalInactive.style.borderColor = '#e53e3e'; });
    modalInactive.addEventListener('mouseleave', () => { modalInactive.style.background = 'transparent'; modalInactive.style.borderColor = 'rgba(229, 62, 62, 0.4)'; });

    modalContent.addEventListener('focus', () => modalContent.style.borderColor = '#e53e3e');
    modalContent.addEventListener('blur', () => modalContent.style.borderColor = '#3a1a1a');

    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            backdrop.style.display = 'none';
            hide();
        }
    });

    modalSave.addEventListener('click', () => {
        const newText = modalContent.value.trim();
        if (newText && currentTipId) {
            chrome.storage.sync.get(`tip-${currentTipId}`, (data) => {
                const key = `tip-${currentTipId}`;
                const tip = data[key];
                if (tip) {
                    tip.text = newText;
                    chrome.storage.sync.set({ [key]: tip }, () => {
                        currentTipText = newText;
                        textEl.textContent = newText;
                        modalSave.textContent = 'Saved!';
                        setTimeout(() => {
                            modalSave.textContent = 'Save';
                            backdrop.style.display = 'none';
                            hide();
                        }, 800);
                    });
                }
            });
        }
    });

    modalInactive.addEventListener('click', () => {
        if (currentTipId) {
            chrome.storage.sync.get(`tip-${currentTipId}`, (data) => {
                const key = `tip-${currentTipId}`;
                const tip = data[key];
                if (tip && tip.status !== 'inactive') {
                    tip.status = 'inactive';
                    chrome.storage.sync.set({ [key]: tip }, () => {
                        modalInactive.textContent = 'Inactivated!';
                        setTimeout(() => {
                            modalInactive.textContent = 'Mark Inactive';
                            backdrop.style.display = 'none';
                            hide();
                        }, 800);
                    });
                }
            });
        }
    });

    bar.addEventListener('click', (e) => {
        if (e.target === closeBtn) return; // let close btn handle itself
        
        // Show modal with full tip text in textarea
        modalContent.value = currentTipText;
        backdrop.style.display = 'flex';
        
        // Pause scrolling ticker instead of hiding
        clearTimeout(hideTimer);
        
        if (textEl.getAnimations) {
            textEl.getAnimations().forEach(anim => anim.pause());
        } else {
            textEl.style.animationPlayState = 'paused';
        }
    });

    function showTip(tipId, text, speed = 150) {
        currentTipId = tipId;
        currentTipText = text;
        // Reset
        clearTimeout(hideTimer);
        textEl.textContent = text;
        bar.classList.add('visible');

        // Cancel previous animation if any
        if (textEl.getAnimations) {
            textEl.getAnimations().forEach(anim => anim.cancel());
        }

        // Force reflow before calculations
        void textEl.offsetWidth;

        const containerWidth = root.querySelector('#tips-ticker-scroll').offsetWidth;
        const rawTextWidth = textEl.scrollWidth;

        // With Web Animations API:
        // text starts at containerWidth (right edge of scrolling container)
        // text ends at -rawTextWidth (fully past the left edge)
        const distance = containerWidth + rawTextWidth;
        const durationMs = (distance / speed) * 1000;

        // Fallback for browsers without animate API
        if (!textEl.animate) {
            textEl.style.transition = `transform ${durationMs}ms linear`;
            textEl.style.transform = `translateX(-${rawTextWidth}px)`;
        } else {
            textEl.animate([
                { transform: `translateX(${containerWidth}px)` },
                { transform: `translateX(-${rawTextWidth}px)` }
            ], {
                duration: durationMs,
                iterations: 1,
                fill: 'forwards'
            });
        }

        // Hide after scroll completes + 0.5s buffer
        hideTimer = setTimeout(hide, durationMs + 500);
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
            showTip(msg.tipId, msg.text, msg.scrollSpeed || 150);
        }
    });
})();

/**
 * PrepMate Interview Avatar — Professional Executive Persona
 * Realistic Interviewer Visualization & Audio Dynamics
 * States: idle | speaking | thinking | listening
 */

class PrepMateAvatar {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.state = 'idle';
        this._init();
    }

    _init() {
        if (!this.container.querySelector('.avatar-interviewer-ring')) {
            this.container.innerHTML = `
                <div class="avatar-interviewer-ring" id="interviewer-avatar-ring">
                    <div class="avatar-interviewer" id="interviewer-avatar-preview">
                        <span id="interviewer-initials">MV</span>
                    </div>
                </div>
                <div class="camera-off-indicator interviewer-off-indicator">
                    <span class="cam-off-icon">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </span>
                    <span id="interviewer-state-badge">Người phỏng vấn</span>
                </div>
            `;
        }
    }

    setState(state) {
        this.state = state;
        if (!this.container) return;

        this.container.classList.remove('idle', 'speaking', 'thinking', 'listening');
        this.container.classList.add(state);

        const tile = document.getElementById('interviewer-tile');
        if (tile) {
            tile.classList.remove('idle', 'speaking', 'thinking', 'listening');
            tile.classList.add(state);
        }

        const ring = document.getElementById('interviewer-avatar-ring');
        if (ring) {
            ring.classList.toggle('speaking', state === 'speaking');
        }

        const stateBadge = document.getElementById('interviewer-state-badge');
        if (stateBadge) {
            if (state === 'speaking') stateBadge.innerText = 'Đang trao đổi...';
            else if (state === 'listening') stateBadge.innerText = 'Đang lắng nghe...';
            else if (state === 'thinking') stateBadge.innerText = 'Đang ghi nhận...';
            else stateBadge.innerText = 'Người phỏng vấn';
        }

        const wave = document.getElementById('voice-wave');
        if (wave) {
            wave.classList.toggle('active', state === 'speaking' || state === 'listening');
        }
    }

    destroy() {
        // Clean up
    }

    resize() {}
}

let _pmAvatar = null;

function pmAvatarInit(containerId) {
    if (_pmAvatar) { _pmAvatar.destroy(); _pmAvatar = null; }
    _pmAvatar = new PrepMateAvatar(containerId);
}

function pmAvatarSetState(state) {
    if (_pmAvatar) _pmAvatar.setState(state);
}

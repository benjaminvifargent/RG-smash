/**
 * SMASH TENNIS - MIDI Logic & UI Engine
 */

class SmashGame {
    constructor() {
        this.midiAccess = null;
        this.velocity = 0;
        this.speed = 0;
        this.maxSpeed = 260;
        this.hits = [];
        this.leaderboard = this.loadLeaderboard();
        this.playerPseudo = "CHAMPION";
        this.playerGender = "M";
        this.playerAge = "adult";
        this.hitsThisSession = 0;
        this.isCooldown = false;

        // DOM Elements
        this.elements = {
            speedNumber: document.getElementById('speed-number'),
            powerGauge: document.getElementById('power-gauge'),
            velocityGauge: document.getElementById('velocity-gauge'),
            velocityBar: null, // Removed old bar
            velocityRaw: document.getElementById('velocity-raw'),
            hitList: document.getElementById('hit-list'),
            rankingList: document.getElementById('ranking-list'),
            midiStatus: document.getElementById('midi-status'),
            container: document.querySelector('.container'),
            overlay: document.getElementById('instruction-overlay'),
            hitInstruction: document.getElementById('hit-instruction'),
            startBtn: document.getElementById('start-btn'),
            stepStart: document.getElementById('step-start'),
            stepPseudo: document.getElementById('step-pseudo'),
            pseudoInput: document.getElementById('pseudo-input'),
            validatePseudoBtn: document.getElementById('validate-pseudo-btn'),
            // Profile elements
            stepGender: document.getElementById('step-gender'),
            stepAge: document.getElementById('step-age'),
            genderBtns: document.querySelectorAll('.gender-btn'),
            ageBtns: document.querySelectorAll('.age-btn'),
            // Record elements
            stepRecord: document.getElementById('step-record'),
            recordName: document.getElementById('record-name'),
            recordSpeedVal: document.getElementById('record-speed-val'),
            recordCloseBtn: document.getElementById('record-close-btn'),
            hitsLeftDisplay: document.getElementById('hits-left-display')
        };

        this.init();
        this.initKeyboard();
        this.updateLeaderboardUI();
    }

    init() {
        // Step 1: Start -> Show Pseudo Input
        this.elements.startBtn.addEventListener('click', () => {
            this.elements.stepStart.style.display = 'none';
            this.elements.stepPseudo.style.display = 'block';
            // No need to focus since it's readonly
        });

        // Step 2: Validate Pseudo -> Show Gender selection
        this.elements.validatePseudoBtn.addEventListener('click', () => {
            const val = this.elements.pseudoInput.value.trim();
            if (val.length >= 2) {
                this.playerPseudo = val.toUpperCase();
                this.elements.stepPseudo.style.display = 'none';
                this.elements.stepGender.style.display = 'block';
            } else {
                this.elements.pseudoInput.classList.add('shake');
                setTimeout(() => this.elements.pseudoInput.classList.remove('shake'), 500);
            }
        });

        // Step 3: Select Gender -> Show Age selection
        this.elements.genderBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.playerGender = btn.dataset.gender;
                this.elements.stepGender.style.display = 'none';
                this.elements.stepAge.style.display = 'block';
            });
        });

        // Step 4: Select Age -> Start Game
        this.elements.ageBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.playerAge = btn.dataset.age;
                this.elements.stepAge.style.display = 'none';
                this.elements.overlay.style.display = 'none';
                this.requestMIDI();
            });
        });

        // Record Close -> Reset Game for next player
        this.elements.recordCloseBtn.addEventListener('click', () => {
            this.resetGame();
        });

        // Allow Enter key (if external keyboard connected)
        this.elements.pseudoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.elements.validatePseudoBtn.click();
        });

        // Initialize Gauges circumference
        const radius = 85;
        this.circumference = 2 * Math.PI * radius;

        [this.elements.powerGauge, this.elements.velocityGauge].forEach(gauge => {
            gauge.style.strokeDasharray = `${this.circumference} ${this.circumference}`;
            gauge.style.strokeDashoffset = this.circumference;
        });
    }

    initKeyboard() {
        const keys = document.querySelectorAll('.key');
        const input = this.elements.pseudoInput;

        keys.forEach(key => {
            key.addEventListener('click', () => {
                const keyValue = key.textContent;

                if (key.classList.contains('backspace')) {
                    input.value = input.value.slice(0, -1);
                } else if (key.classList.contains('clear')) {
                    input.value = '';
                } else if (key.classList.contains('space')) {
                    if (input.value.length < 15) {
                        input.value += ' ';
                    }
                } else {
                    // Normal key
                    if (input.value.length < 15) {
                        input.value += keyValue;
                    }
                }

                // Trigger a small pulse on input
                input.classList.remove('hit-highlight');
                void input.offsetWidth;
                input.classList.add('hit-highlight');
            });
        });
    }

    loadLeaderboard() {
        const saved = localStorage.getItem('smash_leaderboard');
        if (saved) return JSON.parse(saved);

        // Default fake players for visualization
        return [
            { name: "RAFA", speed: 242, date: Date.now() },
            { name: "ROGER", speed: 238, date: Date.now() },
            { name: "NOVAK", speed: 235, date: Date.now() },
            { name: "CARLOS", speed: 225, date: Date.now() },
            { name: "JANNIK", speed: 220, date: Date.now() },
            { name: "STEFANOS", speed: 215, date: Date.now() },
            { name: "CASPER", speed: 210, date: Date.now() },
            { name: "GAEL", speed: 205, date: Date.now() },
            { name: "BEN", speed: 195, date: Date.now() },
            { name: "ARTHUR", speed: 185, date: Date.now() }
        ];
    }

    saveLeaderboard() {
        localStorage.setItem('smash_leaderboard', JSON.stringify(this.leaderboard));
    }

    async requestMIDI() {
        console.log("--- SMASH DIAGNOSTIC ---");
        console.log("Secure Context:", window.isSecureContext);
        console.log("MIDI API available:", !!navigator.requestMIDIAccess);
        console.log("Hostname:", window.location.hostname);

        if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            alert("L'API MIDI nécessite un contexte sécurisé (HTTPS ou Localhost). Vous êtes actuellement sur : " + window.location.hostname);
            return;
        }

        if (navigator.requestMIDIAccess) {
            try {
                // On demande l'accès (sysex false par défaut pour plus de sécurité)
                this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
                this.onMIDISuccess(this.midiAccess);
            } catch (err) {
                console.error("Erreur d'accès MIDI:", err);
                this.onMIDIFailure();
                alert("Erreur d'accès MIDI : " + err.message);
            }
        } else {
            alert("Votre navigateur ne supporte pas l'API Web MIDI. Utilisez Chrome, Edge ou Opera.");
        }
    }

    onMIDISuccess(midi) {
        console.log("MIDI Access granted.");

        // Connect to all inputs and log device names
        const inputs = midi.inputs.values();
        let hasDevice = false;
        for (let input of inputs) {
            console.log("Périphérique MIDI détecté :", input.name, "| ID :", input.id);
            input.onmidimessage = (msg) => this.handleMIDIMessage(msg);
            hasDevice = true;
        }

        if (!hasDevice) {
            console.warn("⚠️ Aucun périphérique MIDI détecté par le navigateur.");
        }

        this.updateMIDIStatus(hasDevice);

        // Listen for internal changes (connection/disconnection)
        midi.onstatechange = (e) => {
            console.log("Changement d'état MIDI :", e.port.name, e.port.state);
            this.updateMIDIStatus(this.hasInputs());
        };
    }

    onMIDIFailure() {
        console.error("Could not access MIDI devices.");
        this.updateMIDIStatus(false);
    }

    hasInputs() {
        return this.midiAccess && this.midiAccess.inputs.size > 0;
    }

    updateMIDIStatus(connected) {
        if (connected) {
            this.elements.midiStatus.style.display = 'none';
        } else {
            this.elements.midiStatus.style.display = 'block';
            this.elements.midiStatus.textContent = "MIDI Déconnecté";
            this.elements.midiStatus.classList.remove('connected');
            this.elements.midiStatus.classList.add('disconnected');
        }
    }

    handleMIDIMessage(event) {
        // LOG ABSOLU : Voir chaque octet qui arrive du matériel
        console.log("RAW MIDI DATA:", event.data);

        const [status, note, velocity] = event.data;

        // On vérifie si c'est un message "Note On" (frappe)
        if ((status & 0xF0) === 0x90 && velocity > 0) {
            this.onHit(velocity);
        }
    }

    onHit(rawVelocity) {
        if (this.isCooldown) return;

        this.isCooldown = true;
        setTimeout(() => this.isCooldown = false, 4000);

        let calculatedSpeed = 0;

        // Si la vélocité est haute (> 120), on considère que le pad sature
        // On utilise alors une fourchette aléatoire basée sur le profil
        if (rawVelocity >= 120) {
            calculatedSpeed = this.calculateOptimizedSpeed(this.playerGender, this.playerAge);
        } else {
            // Courbe standard réduite : on divise par 2 par rapport à l'ancienne version (220 -> 110)
            const normalized = rawVelocity / 127;
            calculatedSpeed = Math.round(Math.pow(normalized, 1.1) * 110);
        }

        this.velocity = rawVelocity;
        this.speed = calculatedSpeed;

        if (this.elements.hitInstruction) {
            this.elements.hitInstruction.classList.add('hidden');
        }

        this.updateUI();
        const isRecord = this.addToLeaderboard(this.playerPseudo, calculatedSpeed);
        this.addHitToHistory(calculatedSpeed);
        this.triggerVisualEffects();
        this.hitsThisSession++;
        this.updateHitsLeftUI();

        if (isRecord) {
            this.showRecordModal(calculatedSpeed);
        } else if (this.hitsThisSession >= 2) {
            // Si pas de record mais 2 coups atteints, on attend 5s avant de reset pour laisser voir le score
            setTimeout(() => {
                if (this.hitsThisSession >= 2) { // Double check if still in session
                    this.resetGame();
                }
            }, 5000);
        }
    }

    showRecordModal(speed) {
        this.elements.recordName.textContent = this.playerPseudo;
        this.elements.recordSpeedVal.textContent = speed;

        // Hide all modals in the overlay first
        this.elements.overlay.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });

        this.elements.overlay.style.display = 'flex';
        this.elements.stepRecord.style.display = 'flex';
    }

    calculateOptimizedSpeed(gender, age) {
        // Fourchettes de vitesse réduites proportionnellement (Max 260)
        const ranges = {
            'M': {
                'junior': [100, 150],
                'adult': [180, 260],
                'senior': [130, 180]
            },
            'F': {
                'junior': [90, 130],
                'adult': [150, 230],
                'senior': [120, 170]
            }
        };

        const range = ranges[gender][age] || [120, 180];
        const base = range[0];
        const span = range[1] - range[0];

        // On génère une valeur aléatoire dans la fourchette
        return Math.floor(base + (Math.random() * span));
    }

    updateUI() {
        // KM/H Gauge
        this.animateValue(this.elements.speedNumber, parseInt(this.elements.speedNumber.textContent), this.speed, 3000);
        const speedOffset = this.circumference - (this.speed / this.maxSpeed) * this.circumference;
        this.elements.powerGauge.style.strokeDashoffset = speedOffset;

        // Force Brute Gauge (Circular)
        this.animateValue(this.elements.velocityRaw, parseInt(this.elements.velocityRaw.textContent), this.velocity, 3000);
        const velocityOffset = this.circumference - (this.velocity / 127) * this.circumference;
        this.elements.velocityGauge.style.strokeDashoffset = velocityOffset;
    }

    updateHitsLeftUI() {
        const remaining = 2 - this.hitsThisSession;
        if (remaining > 1) {
            this.elements.hitsLeftDisplay.textContent = `${remaining} x FRAPPES`;
        } else if (remaining === 1) {
            this.elements.hitsLeftDisplay.textContent = `1 x FRAPPE`;
        } else {
            this.elements.hitsLeftDisplay.textContent = `FINI`;
        }
    }

    addHitToHistory(speed) {
        const li = document.createElement('li');
        li.className = 'hit-item';
        const now = new Date();
        const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

        li.innerHTML = `
            <span class="hit-time">${this.playerPseudo} • ${timeStr}</span>
            <span class="hit-speed">${speed} KM/H</span>
        `;

        this.elements.hitList.prepend(li);

        // Keep only last 5 in history
        while (this.elements.hitList.children.length > 5) {
            this.elements.hitList.lastChild.remove();
        }

        // Add to permanent leaderboard
        this.addToLeaderboard(this.playerPseudo, speed);
    }

    addToLeaderboard(name, speed) {
        // Find if this speed enters top 10
        const isTop10 = this.leaderboard.length < 10 || speed > this.leaderboard[this.leaderboard.length - 1].speed;

        if (isTop10) {
            this.leaderboard.push({ name, speed, date: new Date().getTime() });
            // Sort by speed DESC
            this.leaderboard.sort((a, b) => b.speed - a.speed);
            // Keep only top 10
            this.leaderboard = this.leaderboard.slice(0, 10);

            this.saveLeaderboard();
            this.updateLeaderboardUI();
            return true;
        }
        return false;
    }

    updateLeaderboardUI() {
        this.elements.rankingList.innerHTML = '';
        this.leaderboard.forEach((entry, index) => {
            const li = document.createElement('li');
            li.className = 'ranking-item';
            li.innerHTML = `
                <span class="rank">#${index + 1}</span>
                <span class="name">${entry.name}</span>
                <span class="speed">${entry.speed} KM/H</span>
            `;
            this.elements.rankingList.appendChild(li);
        });
    }

    triggerVisualEffects() {
        // Shake container
        this.elements.container.classList.remove('shake');
        void this.elements.container.offsetWidth; // Trigger reflow
        this.elements.container.classList.add('shake');

        // Highlight speed text
        this.elements.speedNumber.classList.remove('hit-highlight');
        void this.elements.speedNumber.offsetWidth;
        this.elements.speedNumber.classList.add('hit-highlight');
    }

    animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }
    resetGame() {
        // Reset internal state
        this.velocity = 0;
        this.speed = 0;
        this.playerPseudo = "CHAMPION";
        this.playerGender = "M";
        this.playerAge = "adult";
        this.hitsThisSession = 0;

        // Reset UI values
        this.elements.speedNumber.textContent = "0";
        this.elements.velocityRaw.textContent = "0";
        this.elements.pseudoInput.value = "";

        // Reset Gauges
        this.elements.powerGauge.style.strokeDashoffset = this.circumference;
        this.elements.velocityGauge.style.strokeDashoffset = this.circumference;

        // Reset Overlay state
        this.elements.overlay.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });

        // Return to start screen
        this.elements.stepStart.style.display = 'block';
        this.elements.overlay.style.display = 'flex';

        // Re-show instruction for hitting
        if (this.elements.hitInstruction) {
            this.elements.hitInstruction.classList.remove('hidden');
        }

        // Reset hits display
        this.updateHitsLeftUI();
    }
}

// Start application
window.addEventListener('DOMContentLoaded', () => {
    window.game = new SmashGame();
});

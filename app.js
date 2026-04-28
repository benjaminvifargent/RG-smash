/**
 * SMASH TENNIS - MIDI Logic & UI Engine
 */

class SmashGame {
    constructor() {
        this.midiAccess = null;
        this.velocity = 0;
        this.speed = 0;
        this.maxSpeed = 250; 
        this.hits = [];
        this.leaderboard = this.loadLeaderboard();
        this.playerPseudo = "CHAMPION";

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
            // Record elements
            stepRecord: document.getElementById('step-record'),
            recordName: document.getElementById('record-name'),
            recordSpeedVal: document.getElementById('record-speed-val'),
            recordCloseBtn: document.getElementById('record-close-btn')
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

        // Step 2: Validate Pseudo -> Start Game
        this.elements.validatePseudoBtn.addEventListener('click', () => {
            const val = this.elements.pseudoInput.value.trim();
            if (val.length >= 2) {
                this.playerPseudo = val.toUpperCase();
                this.elements.overlay.style.display = 'none';
                this.requestMIDI();
            } else {
                this.elements.pseudoInput.classList.add('shake');
                setTimeout(() => this.elements.pseudoInput.classList.remove('shake'), 500);
            }
        });

        // Record Close
        this.elements.recordCloseBtn.addEventListener('click', () => {
            this.elements.overlay.style.display = 'none';
            this.elements.stepRecord.style.display = 'none';
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
            this.elements.midiStatus.textContent = "MIDI Connecté";
            this.elements.midiStatus.classList.remove('disconnected');
            this.elements.midiStatus.classList.add('connected');
        } else {
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
        // Calculation: Simulation de vitesse
        // On utilise une courbe légèrement exponentielle pour plus de sensations
        // 127 velocity -> ~250 km/h
        const normalized = rawVelocity / 127;
        const calculatedSpeed = Math.round(Math.pow(normalized, 1.1) * this.maxSpeed);

        this.velocity = rawVelocity;
        this.speed = calculatedSpeed;

        if (this.elements.hitInstruction) {
            this.elements.hitInstruction.classList.add('hidden');
        }

        this.updateUI();
        const isRecord = this.addToLeaderboard(this.playerPseudo, calculatedSpeed);
        this.addHitToHistory(calculatedSpeed);
        this.triggerVisualEffects();

        if (isRecord) {
            this.showRecordModal(calculatedSpeed);
        }
    }

    showRecordModal(speed) {
        this.elements.recordName.textContent = this.playerPseudo;
        this.elements.recordSpeedVal.textContent = speed;
        this.elements.overlay.style.display = 'flex';
        this.elements.stepRecord.style.display = 'flex';
    }

    updateUI() {
        // KM/H Gauge
        this.animateValue(this.elements.speedNumber, parseInt(this.elements.speedNumber.textContent), this.speed, 200);
        const speedOffset = this.circumference - (this.speed / this.maxSpeed) * this.circumference;
        this.elements.powerGauge.style.strokeDashoffset = speedOffset;

        // Force Brute Gauge (Circular)
        this.animateValue(this.elements.velocityRaw, parseInt(this.elements.velocityRaw.textContent), this.velocity, 200);
        const velocityOffset = this.circumference - (this.velocity / 127) * this.circumference;
        this.elements.velocityGauge.style.strokeDashoffset = velocityOffset;
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

        // Keep only last 10 in history
        if (this.elements.hitList.children.length > 10) {
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
}

// Start application
window.addEventListener('DOMContentLoaded', () => {
    window.game = new SmashGame();
});

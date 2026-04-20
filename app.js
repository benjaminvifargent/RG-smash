/**
 * SMASH TENNIS - MIDI Logic & UI Engine
 */

class SmashGame {
    constructor() {
        this.midiAccess = null;
        this.velocity = 0;
        this.speed = 0;
        this.maxSpeed = 250; // km/h record simulation
        this.hits = [];

        // DOM Elements
        this.elements = {
            speedNumber: document.getElementById('speed-number'),
            powerGauge: document.getElementById('power-gauge'),
            velocityBar: document.getElementById('velocity-bar'),
            velocityRaw: document.getElementById('velocity-raw'),
            hitList: document.getElementById('hit-list'),
            midiStatus: document.getElementById('midi-status'),
            container: document.querySelector('.container'),
            overlay: document.getElementById('instruction-overlay'),
            startBtn: document.getElementById('start-btn')
        };

        this.init();
    }

    init() {
        this.elements.startBtn.addEventListener('click', () => {
            this.elements.overlay.style.display = 'none';
            this.requestMIDI();
        });

        // Initialize Gauge circumference
        const radius = 90;
        this.circumference = 2 * Math.PI * radius;
        this.elements.powerGauge.style.strokeDasharray = `${this.circumference} ${this.circumference}`;
        this.elements.powerGauge.style.strokeDashoffset = this.circumference;
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

        this.updateUI();
        this.addHitToHistory(calculatedSpeed);
        this.triggerVisualEffects();
    }

    updateUI() {
        // Speed Display
        this.animateValue(this.elements.speedNumber, parseInt(this.elements.speedNumber.textContent), this.speed, 200);

        // Gauge Display
        const offset = this.circumference - (this.speed / this.maxSpeed) * this.circumference;
        this.elements.powerGauge.style.strokeDashoffset = offset;

        // Raw Velocity Bar
        this.elements.velocityBar.style.width = `${(this.velocity / 127) * 100}%`;
        this.elements.velocityRaw.textContent = `${this.velocity} / 127`;
    }

    addHitToHistory(speed) {
        const li = document.createElement('li');
        li.className = 'hit-item';
        const now = new Date();
        const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

        li.innerHTML = `
            <span class="hit-time">${timeStr}</span>
            <span class="hit-speed">${speed} KM/H</span>
        `;

        this.elements.hitList.prepend(li);

        // Keep only last 10
        if (this.elements.hitList.children.length > 10) {
            this.elements.hitList.lastChild.remove();
        }
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

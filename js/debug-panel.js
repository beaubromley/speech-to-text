/**
 * On-screen Debug Log Panel
 * Captures console.log/warn/error and displays them in a floating panel.
 * Useful for debugging on mobile where the browser console is inaccessible.
 */
class DebugPanel {
    constructor() {
        this.entries = [];
        this.maxEntries = 200;
        this.isVisible = false;

        this._createDOM();
        this._interceptConsole();
    }

    _createDOM() {
        // Toggle button
        this.toggleBtn = document.createElement('button');
        this.toggleBtn.className = 'debug-toggle-btn';
        this.toggleBtn.textContent = 'LOG';
        this.toggleBtn.addEventListener('click', () => this.toggle());

        // Panel
        this.panel = document.createElement('div');
        this.panel.className = 'debug-panel hidden';

        // Header
        const header = document.createElement('div');
        header.className = 'debug-panel-header';
        header.innerHTML = '<span>Debug Log</span>';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'debug-clear-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', () => this.copyAll());

        const clearBtn = document.createElement('button');
        clearBtn.className = 'debug-clear-btn';
        clearBtn.textContent = 'Clear';
        clearBtn.addEventListener('click', () => this.clear());

        const closeBtn = document.createElement('button');
        closeBtn.className = 'debug-clear-btn';
        closeBtn.textContent = 'X';
        closeBtn.addEventListener('click', () => this.toggle());

        header.appendChild(copyBtn);
        header.appendChild(clearBtn);
        header.appendChild(closeBtn);

        // Log container
        this.logContainer = document.createElement('div');
        this.logContainer.className = 'debug-log-container';

        this.panel.appendChild(header);
        this.panel.appendChild(this.logContainer);

        document.body.appendChild(this.toggleBtn);
        document.body.appendChild(this.panel);
    }

    _interceptConsole() {
        const origLog = console.log.bind(console);
        const origWarn = console.warn.bind(console);
        const origError = console.error.bind(console);

        console.log = (...args) => {
            origLog(...args);
            this._addEntry('log', args);
        };
        console.warn = (...args) => {
            origWarn(...args);
            this._addEntry('warn', args);
        };
        console.error = (...args) => {
            origError(...args);
            this._addEntry('error', args);
        };
    }

    _addEntry(level, args) {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        const message = args.map(a => {
            if (typeof a === 'string') return a;
            try { return JSON.stringify(a); } catch { return String(a); }
        }).join(' ');

        if (this.entries.length >= this.maxEntries) {
            this.entries.shift();
            if (this.logContainer.firstChild) {
                this.logContainer.removeChild(this.logContainer.firstChild);
            }
        }

        this.entries.push({ level, time, message });

        const el = document.createElement('div');
        el.className = `debug-entry ${level}`;
        el.textContent = `[${time}] ${message}`;
        this.logContainer.appendChild(el);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    toggle() {
        this.isVisible = !this.isVisible;
        this.panel.classList.toggle('hidden', !this.isVisible);
    }

    copyAll() {
        const text = this.entries.map(e => `[${e.time}] [${e.level}] ${e.message}`).join('\n');
        navigator.clipboard.writeText(text).catch(() => {
            // Fallback for older browsers
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        });
    }

    clear() {
        this.entries = [];
        this.logContainer.innerHTML = '';
    }
}

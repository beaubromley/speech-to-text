# Speech-to-Text

A mobile-friendly web app for real-time speech transcription using your phone's microphone. Perfect for taking notes during lectures, meetings, or any spoken content.

## Features

- **Real-time transcription** using Web Speech API
- **Mobile-optimized** with large touch-friendly buttons
- **Auto-restart mechanism** keeps listening during pauses
- **Copy to clipboard** for easy note-taking
- **Export as text file** to save your transcriptions
- **Auto-save** to prevent data loss
- **Wake Lock** keeps screen on during recording
- **Offline support** for previously loaded pages
- **No backend required** - runs entirely in the browser

## Demo

Visit the live demo at: `https://yourusername.github.io/speech-to-text`

## Quick Start

### Option 1: Use Online (Recommended)

1. Visit the hosted app (requires HTTPS)
2. Grant microphone permission when prompted
3. Tap START to begin recording
4. Speak naturally - transcription appears in real-time
5. Tap STOP when finished
6. Use COPY or EXPORT to save your transcript

### Option 2: Run Locally

1. Clone or download this repository
2. Since microphone access requires HTTPS, use one of these methods:

   **Method A: Python HTTP Server**
   ```bash
   # Python 3
   python -m http.server 8000
   # Then visit: http://localhost:8000
   # Note: localhost is treated as secure context
   ```

   **Method B: Node.js HTTP Server**
   ```bash
   npx http-server -p 8000
   # Then visit: http://localhost:8000
   ```

3. Open in Chrome or Edge browser for best results
4. Grant microphone permission
5. Start transcribing!

## Browser Support

| Browser | Desktop | Mobile | Notes |
|---------|---------|--------|-------|
| Chrome | ✅ Full | ✅ Full | **Recommended** |
| Edge | ✅ Full | ✅ Full | **Recommended** |
| Safari | ⚠️ Limited | ⚠️ Limited | Basic support only |
| Firefox | ⚠️ Limited | ❌ No | Limited API support |

**Best experience:** Chrome or Edge on Android

## How It Works

### Web Speech API Mode (Default)

The app uses the browser's built-in Speech Recognition API with a critical enhancement:

**Auto-restart mechanism** - The API normally stops after 7-10 seconds of silence. This app automatically restarts recognition to enable continuous transcription throughout entire lectures.

```javascript
recognition.onend = () => {
  if (stillRecording) {
    setTimeout(() => recognition.start(), 300);  // Auto-restart
  }
};
```

**Features:**
- True real-time transcription (< 1 second delay)
- Shows interim results as you speak (gray italic text)
- Final results appear in black
- Requires internet connection
- Free to use

**Requirements:**
- HTTPS connection (or localhost)
- Internet connection
- Microphone permission
- Chrome or Edge browser (recommended)

### Whisper WASM Mode (Experimental)

**Status:** Not fully implemented - placeholder only

The Whisper mode is included as a placeholder for future offline transcription. Full implementation requires:
- Whisper.cpp WASM library
- Model download (31-75MB)
- Web Worker setup
- Audio processing pipeline

**Not recommended** for live lectures due to:
- 2-10x slower than real-time on mobile
- Large model download
- Higher CPU and battery usage

## Usage Guide

### Starting a Recording

1. **Choose Mode**: Web Speech API (recommended for lectures)
2. **Grant Permission**: Allow microphone access when prompted
3. **Tap START**: Large green button begins recording
4. **Speak Naturally**: Transcription appears in real-time
5. **Keep Talking**: App continues listening during pauses
6. **Tap STOP**: Red button stops recording

### During Recording

- Screen stays on (Wake Lock prevents sleep)
- Gray italic text = interim results (still processing)
- Black text = final results (confirmed)
- Auto-scrolls to show latest transcription
- Auto-saves every second to prevent data loss

### After Recording

- **Copy**: Tap to copy entire transcript to clipboard
- **Export**: Download as .txt file with timestamp
- **Clear**: Remove transcript (asks for confirmation)

### Tips for Best Results

1. **Speak clearly** at a normal pace
2. **Reduce background noise** when possible
3. **Keep phone close** (within 1-2 feet)
4. **Use Chrome or Edge** browser
5. **Check internet connection** (required for Web Speech)
6. **Grant microphone permission** permanently
7. **Close other apps** to free up resources
8. **Use headphone mic** for better audio in noisy environments

## Troubleshooting

### Microphone Permission Denied

**iOS:**
1. Go to Settings → Safari
2. Tap Camera & Microphone
3. Enable for this site

**Android:**
1. Open Chrome
2. Tap the three dots menu
3. Settings → Site Settings → Microphone
4. Find your site and allow

**Desktop:**
1. Click the lock icon in the address bar
2. Enable microphone access

### Not Working in Browser

- ✅ Use Chrome or Edge (best support)
- ✅ Ensure you're on HTTPS (or localhost)
- ✅ Check internet connection
- ✅ Try refreshing the page
- ❌ Avoid Firefox and Safari if possible

### Transcription Stops After a Few Seconds

This should not happen due to the auto-restart mechanism. If it does:
1. Check browser console for errors (F12)
2. Ensure internet connection is stable
3. Try refreshing the page
4. Grant microphone permission again

### Accuracy Issues

The transcription quality depends on:
- Speech clarity and pace
- Background noise levels
- Microphone quality
- Internet connection speed
- Speaker's accent

For better accuracy:
- Speak clearly and at moderate pace
- Use in quiet environments
- Use external microphone if available
- Check internet speed

## Deployment

### GitHub Pages (Free & Easy)

1. Create a new GitHub repository
2. Upload all project files
3. Go to Settings → Pages
4. Source: Deploy from main branch
5. Your app will be available at: `https://username.github.io/repo-name`

**Advantages:**
- Free hosting
- Automatic HTTPS
- No server setup required
- Easy updates via git push

### Alternative Hosting

Any static hosting service works:
- **Netlify**: Drag & drop deployment
- **Vercel**: Connect GitHub repo
- **Cloudflare Pages**: Fast global CDN
- **Firebase Hosting**: Google's platform

**Requirements:**
- Must serve over HTTPS
- No backend needed
- All static files

## File Structure

```
speech-to-text/
├── index.html              # Main entry point and UI
├── css/
│   └── styles.css          # Mobile-first responsive styles
├── js/
│   ├── app.js              # Main application controller
│   ├── web-speech.js       # Web Speech API implementation
│   ├── whisper-wasm.js     # Whisper WASM (placeholder)
│   ├── ui-controller.js    # UI state management
│   └── utils.js            # Helper functions
└── README.md               # This file
```

## Technical Details

### Core Technologies

- **Web Speech API**: Browser's native speech recognition
- **MediaRecorder API**: Audio capture
- **Wake Lock API**: Prevent screen sleep
- **Clipboard API**: Copy to clipboard
- **LocalStorage**: Auto-save transcripts
- **Vanilla JavaScript**: No framework dependencies

### Key Implementation Details

**Auto-restart Logic** (`js/web-speech.js:69-88`)
```javascript
recognition.onend = () => {
    if (shouldRestart && isRecording) {
        setTimeout(() => {
            recognition.start();
        }, 300);
    }
};
```

**Wake Lock** (`js/utils.js:91-108`)
```javascript
await navigator.wakeLock.request('screen');
```

**Auto-save** (`js/app.js:30-32`)
```javascript
this.autoSave = Utils.debounce((text) => {
    Utils.storage.saveTranscript(text);
}, 1000);
```

### Privacy & Data

- **Web Speech mode**: Audio sent to Google's servers for processing
- **Whisper mode** (when implemented): Fully local processing
- **No analytics**: No tracking or data collection
- **Auto-save**: Stored locally in browser (not on server)
- **Export**: Files saved to your device only

### Browser API Requirements

| API | Required | Fallback |
|-----|----------|----------|
| SpeechRecognition | Yes | Show error message |
| MediaDevices | Yes | Show error message |
| Wake Lock | No | Works without it |
| Clipboard | No | Manual copy fallback |
| LocalStorage | No | No auto-save |
| WebAssembly | No | Whisper unavailable |

## Development

### Prerequisites

- Modern web browser (Chrome/Edge recommended)
- Text editor
- Local web server (for HTTPS/localhost)

### Setup

```bash
# Clone repository
git clone https://github.com/yourusername/speech-to-text.git
cd speech-to-text

# Run local server
python -m http.server 8000

# Open browser
open http://localhost:8000
```

### Testing Checklist

- [ ] Microphone permission granted
- [ ] Start recording works
- [ ] Real-time transcription appears
- [ ] Interim results show (gray italic)
- [ ] Final results confirm (black text)
- [ ] Auto-restart works (speak, pause, speak)
- [ ] Stop recording works
- [ ] Copy to clipboard works
- [ ] Export as text works
- [ ] Clear transcript works (with confirmation)
- [ ] Auto-save restores after refresh
- [ ] Wake lock keeps screen on
- [ ] Mobile UI is touch-friendly
- [ ] Mode switching works
- [ ] Help modal displays
- [ ] Error messages display

## Future Enhancements

Potential improvements:

- [ ] Full Whisper WASM implementation
- [ ] Multiple language support
- [ ] Custom vocabulary/terms
- [ ] Punctuation commands ("period", "comma")
- [ ] Speaker diarization (identify speakers)
- [ ] Timestamp markers
- [ ] Search within transcript
- [ ] Multiple transcript sessions
- [ ] Cloud sync (optional)
- [ ] PWA for offline use
- [ ] Dark mode theme

## Contributing

Contributions welcome! Areas that need work:

1. **Whisper Integration**: Complete the WASM implementation
2. **Language Support**: Add multi-language options
3. **Accuracy**: Improve transcription quality
4. **Testing**: Cross-browser compatibility
5. **Documentation**: Improve guides and examples

## License

MIT License - Free to use and modify

## Credits

- Built with Web Speech API
- Whisper by OpenAI
- Icons: Unicode emoji
- No external dependencies

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check browser console for errors (F12)
- Verify HTTPS and microphone permissions
- Test in Chrome/Edge first

## Acknowledgments

- OpenAI Whisper for inspiration
- Web Speech API contributors
- Open source community

---

**Made for students, by students. Happy note-taking!**

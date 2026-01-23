# Speech-to-Text

Web app for transcribing speech to text. Works on mobile and desktop.

## Features

- Real-time transcription with Web Speech API
- Offline transcription with Transformers.js or Whisper Turbo
- Auto-saves transcripts
- Copy to clipboard or export as text file
- Keeps screen on during recording

## Usage

### Web Speech (Default)
- Fast, real-time transcription
- Needs internet connection
- Works best on Chrome/Edge
- Good for live note-taking

### Transformers Mode
- Offline after 40MB model download
- Slow on mobile (30-50 sec per 10 sec audio)
- Decent on laptop (8-15 sec per 10 sec audio)
- Better accuracy than Web Speech

### Whisper Turbo Mode
- Offline after 40MB model download
- Slow on mobile (15-30 sec per 10 sec audio)
- Fast on laptop (3-8 sec per 10 sec audio)
- Good balance of speed and accuracy

## Requirements

- HTTPS connection (or localhost)
- Chrome or Edge browser recommended
- Microphone permission

## Running Locally

```bash
# Clone repo
git clone https://github.com/yourusername/speech-to-text.git
cd speech-to-text

# Start local server
python -m http.server 8000

# Open http://localhost:8000
```

## Deployment

### GitHub Pages
1. Push to GitHub
2. Go to Settings → Pages
3. Select main branch
4. Done

## Microphone Permissions

If denied:
- **iOS**: Settings → Safari → Microphone
- **Android**: Chrome → Site Settings → Microphone
- **Desktop**: Click lock icon in address bar

## Browser Support

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome  | Yes     | Yes    |
| Edge    | Yes     | Yes    |
| Safari  | Limited | Limited |
| Firefox | Limited | No     |

## File Structure

```
speech-to-text/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── web-speech.js
│   ├── transformers-whisper.js
│   ├── whisper-turbo.js
│   ├── audio-processor.js
│   ├── ui-controller.js
│   └── utils.js
└── README.md
```

## Notes

- Web Speech sends audio to Google's servers
- Transformers/Whisper process locally but are slower
- Transcripts stored in browser localStorage
- Wake Lock API prevents screen sleep during recording

## License

MIT

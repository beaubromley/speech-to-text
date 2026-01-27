# Speech-to-Text

Web app for transcribing speech to text using the Web Speech API. Works on mobile and desktop.

## Features

- Real-time transcription with Web Speech API
- Fast, live transcription
- AI-powered summary generation using Google Gemini
- Customizable AI prompts
- Word count and preview mode for long transcripts
- Auto-saves transcripts
- Copy to clipboard or export as text file
- Keeps screen on during recording

## Requirements

- HTTPS connection (or localhost)
- Chrome or Edge browser recommended
- Microphone permission
- Internet connection

## Setup

### AI Summary (Optional)

To use the AI summary feature with Google Gemini:

1. Get a free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Copy `js/config.example.js` to `js/config.js`
3. Replace `YOUR_GEMINI_API_KEY_HERE` with your actual API key in `js/config.js`

**Note:** `js/config.js` is in `.gitignore` and will not be committed to git.

The AI summary feature will automatically detect the type of content (meeting, presentation, lecture, etc.) and provide an appropriate summary with key points and action items.

## Running Locally

```bash
# Clone repo
git clone https://github.com/yourusername/speech-to-text.git
cd speech-to-text

# Set up API key (optional, for AI summary)
cp js/config.example.js js/config.js
# Edit js/config.js and add your Gemini API key

# Start local server
python -m http.server 8000

# Open http://localhost:8000
```

## Using AI Summary

1. Record or load a transcript
2. Click **Generate Summary** to use the default smart prompt
3. Or click **Edit Prompt** to customize the prompt before generating
4. The AI will analyze the transcript and provide:
   - For meetings: Overview, key points, decisions, and action items
   - For presentations: Main topic, key concepts, and recommendations
   - For interviews: Context, main topics, and insights
   - For other content: Appropriate analysis based on context
5. Copy or export the summary using the buttons below the summary

**Prompt Customization:**
- Click **Edit Prompt** to customize how the AI summarizes
- Your prompt must include `{TRANSCRIPT}` where the transcript will be inserted
- Click **Reset to Default** to restore the original prompt

## Deployment

### GitHub Pages

#### Without AI Summary:
1. Push to GitHub
2. Go to Settings → Pages
3. Select main branch
4. Done

#### With AI Summary (Using GitHub Secrets):
1. Go to your repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `GEMINI_API_KEY`
4. Value: Your Gemini API key
5. Create a GitHub Actions workflow to inject the key during deployment

**Alternative:** Since this is a client-side app, you can also:
- Use environment variables in your hosting platform (Netlify, Vercel, etc.)
- Or manually update `js/config.js` after deployment (less secure)

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
├── .gitignore
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── web-speech.js
│   ├── audio-processor.js
│   ├── ui-controller.js
│   ├── utils.js
│   ├── gemini-api.js         # AI summary integration
│   ├── config.example.js     # Template for API key
│   └── config.js             # Your API key (not committed)
└── README.md
```

## Notes

- Web Speech sends audio to Google's servers for processing
- Transcripts stored in browser localStorage
- Wake Lock API prevents screen sleep during recording
- Works best in quiet environments

## License

MIT

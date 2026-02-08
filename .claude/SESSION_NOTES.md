# Session Notes - Speech-to-Text

## Current State
- Feature-rich web app for real-time speech transcription with Talkboy theme
- 12 features implemented and committed/pushed
- Git remote: https://github.com/beaubromley/speech-to-text
- Latest commit: `72ab620` on `main` (pushed to origin)

## File Structure
```
speech-to-text/
├── .gitignore
├── .github/
│   └── workflows/
│       └── deploy.yml            # GitHub Pages deployment
├── README.md
├── conversation-log.md           # Dev conversation log
├── index.html                    # Main web page (updated)
├── css/
│   └── styles.css                # Talkboy theme styling (rewritten)
├── js/
│   ├── app.js                    # Main application logic (heavily updated)
│   ├── web-speech.js             # Web Speech API integration
│   ├── audio-processor.js        # Audio processing
│   ├── ui-controller.js          # UI management (updated - markdown rendering)
│   ├── utils.js                  # Utility functions (updated - summary/auto-summary storage)
│   ├── gemini-api.js             # Google Gemini AI (updated - TL;DR, speakers, follow-up)
│   ├── vu-meter.js               # NEW - VU meter audio level visualization
│   ├── word-cloud.js             # NEW - Live word frequency cloud
│   ├── config.example.js         # Template for API key
│   ├── config.js                 # Actual API key (gitignored)
│   ├── transformers-whisper.js   # Whisper via Transformers.js
│   ├── whisper-turbo.js          # Whisper Turbo integration
│   └── whisper-turbo-worker.js   # Web Worker for Whisper
└── .claude/
    └── SESSION_NOTES.md
```

## Project Overview
- **What it does**: Web app for real-time speech-to-text transcription using Web Speech API, with AI-powered summary generation via Google Gemini
- **Tech stack**: Pure HTML/CSS/JavaScript + marked.js CDN (no build tools, no server deps)
- **Theme**: Talkboy (90s tape recorder) - silver plastic body, green LED text, 3D buttons, cassette reels
- **APIs used**: Web Speech API (browser), Web Audio API (VU meter), Google Gemini API (summaries + follow-up), Web Share API (sharing)

## Features Added This Session
1. **TL;DR in AI prompt** - Summary now starts with a 1-2 sentence TL;DR section
2. **Summary persistence** - AI summary saved to localStorage, restored on reload
3. **Talkboy CSS theme** - Complete visual overhaul (silver body, green terminal text, 3D buttons, LED status)
4. **Markdown rendering** - AI summary renders formatted markdown via `marked` library
5. **Speaker labels** - Prompt instructs Gemini to identify/label different speakers
6. **Auto-summarize toggle** - Toggle switch to auto-generate summary when recording stops
7. **Cassette tape reels** - SVG spinning reels animation during recording (different speeds L/R)
8. **VU meter** - 16-segment LED bar (green/yellow/red) with real-time mic levels via Web Audio API
9. **Timestamp markers** - Yellow MARK button during recording inserts `[MM:SS]` into transcript
10. **Follow-up questions** - Chat input below summary to ask Gemini questions about the transcript
11. **Share button** - Web Share API on mobile, clipboard fallback on desktop (includes summary + transcript)
12. **Live word cloud** - Toggleable real-time word frequency display, filters stop words

## Key Architecture Notes
- `Utils.storage` handles all localStorage: transcript, summary, mode, auto-summary preference
- `VUMeter` class opens its own audio stream (Web Audio API AnalyserNode) separate from Web Speech API
- `WordCloud` class is CSS-based (no canvas), updates on transcript change when visible
- `GeminiAPI.askFollowUp()` sends transcript + summary + question for contextual Q&A
- Follow-up thread is DOM-only (not persisted to localStorage)
- Cassette reels toggle via `.recording` class on `#cassette-reels` section

## Git Status
- All changes committed and pushed to origin/main
- Commit `72ab620`: "Add Talkboy theme, AI enhancements, and interactive features"
- Working tree clean

## Important Decisions
- Used `marked` library via CDN for markdown rendering (no build step needed)
- VU meter uses separate mic stream from Web Speech API (Web Speech doesn't expose its stream)
- Word cloud is CSS-based with Russo One font (no canvas/SVG rendering)
- Follow-up Q&A thread is ephemeral (not saved to localStorage) - by design to keep it lightweight
- Talkboy theme uses Russo One + Share Tech Mono Google Fonts

## Next Steps
- Test on mobile (especially VU meter, share button, cassette reels sizing)
- Consider: dark/light mode toggle ("Talkgirl" pink theme variant)

---
_Last updated: 2026-02-07_

/**
 * Google Gemini API Integration
 * Handles AI summary generation using Google's Gemini API
 */

class GeminiAPI {
    constructor() {
        this.apiKey = window.CONFIG?.GEMINI_API_KEY || '';
        this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
        this.defaultPrompt = this.getDefaultPrompt();
        this.customPrompt = null;
    }

    /**
     * Get the default AI prompt
     * @returns {string} - Default prompt template
     */
    getDefaultPrompt() {
        return `You are an intelligent assistant analyzing a transcript. Your task is to:

1. First, provide a TL;DR — a 1-2 sentence summary of the entire transcript.
2. Determine what type of content this is (meeting, presentation, lecture, interview, conversation, etc.)
3. Then provide an appropriate detailed summary based on the content type:

For MEETINGS:
- Brief overview of the meeting
- Key discussion points
- Decisions made
- Action items with responsible parties (if mentioned)

For PRESENTATIONS/LECTURES:
- Main topic and purpose
- Key points and concepts covered
- Important takeaways
- Recommendations or conclusions

For INTERVIEWS:
- Subject and context
- Main topics discussed
- Notable quotes or insights
- Key conclusions

For CONVERSATIONS/OTHER:
- Context and participants (if identifiable)
- Main topics discussed
- Key points or conclusions

SPEAKER IDENTIFICATION:
- If you can identify distinct speakers (by name, role, or vocal cues mentioned in transcript), include a "## Speakers" section listing each speaker and their role/context.
- Throughout the summary, attribute key points and quotes to specific speakers when possible (e.g., "**John** suggested..." or "**Speaker 1** noted...").
- If only one speaker is apparent, skip the Speakers section.

Start your response with a "## TL;DR" section, then "## Speakers" (if multiple), then follow with the detailed summary under appropriate headings. Format your response clearly with headings and bullet points. Be concise but comprehensive.

Here is the transcript to analyze:

{TRANSCRIPT}`;
    }

    /**
     * Set a custom prompt
     * @param {string} prompt - Custom prompt template (must include {TRANSCRIPT} placeholder)
     */
    setCustomPrompt(prompt) {
        if (!prompt.includes('{TRANSCRIPT}')) {
            throw new Error('Custom prompt must include {TRANSCRIPT} placeholder');
        }
        this.customPrompt = prompt;
    }

    /**
     * Reset to default prompt
     */
    resetPrompt() {
        this.customPrompt = null;
    }

    /**
     * Get current prompt (custom or default)
     * @returns {string} - Current prompt template
     */
    getCurrentPrompt() {
        return this.customPrompt || this.defaultPrompt;
    }

    /**
     * Check if API key is configured
     * @returns {boolean} - True if API key is set
     */
    isConfigured() {
        return this.apiKey && this.apiKey !== 'YOUR_GEMINI_API_KEY_HERE';
    }

    /**
     * Generate summary from transcript
     * @param {string} transcript - The transcript text to summarize
     * @returns {Promise<string>} - Generated summary
     */
    async generateSummary(transcript) {
        if (!this.isConfigured()) {
            throw new Error('Gemini API key not configured. Please add your API key to js/config.js');
        }

        if (!transcript || transcript.trim().length === 0) {
            throw new Error('No transcript available to summarize');
        }

        // Prepare the prompt with transcript
        const prompt = this.getCurrentPrompt().replace('{TRANSCRIPT}', transcript);

        // Prepare request body
        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 65536,
            }
        };

        try {
            const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
            }

            const data = await response.json();

            // Extract generated text from response
            const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!summary) {
                throw new Error('No summary generated from API response');
            }

            return summary;

        } catch (error) {
            console.error('Gemini API Error:', error);
            throw error;
        }
    }

    /**
     * Ask a follow-up question about the transcript
     * @param {string} transcript - The original transcript
     * @param {string} summary - The generated summary
     * @param {string} question - The user's follow-up question
     * @returns {Promise<string>} - AI response
     */
    async askFollowUp(transcript, summary, question) {
        if (!this.isConfigured()) {
            throw new Error('Gemini API key not configured');
        }

        const prompt = `You previously analyzed this transcript and produced the summary below. Now answer the user's follow-up question.

TRANSCRIPT:
${transcript}

YOUR PREVIOUS SUMMARY:
${summary}

USER'S QUESTION:
${question}

Answer concisely and directly. Use markdown formatting.`;

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 4096,
            }
        };

        try {
            const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
            }

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
        } catch (error) {
            console.error('Gemini Follow-up Error:', error);
            throw error;
        }
    }

    /**
     * Validate transcript length (Gemini has token limits)
     * @param {string} transcript - Transcript to validate
     * @returns {Object} - Validation result
     */
    validateTranscript(transcript) {
        const maxChars = 30000; // Conservative limit for Gemini
        const chars = transcript.length;

        if (chars === 0) {
            return {
                valid: false,
                message: 'Transcript is empty'
            };
        }

        if (chars > maxChars) {
            return {
                valid: false,
                message: `Transcript too long (${chars} chars). Maximum is ${maxChars} characters.`
            };
        }

        return {
            valid: true,
            message: 'Transcript is valid'
        };
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.GeminiAPI = GeminiAPI;
}

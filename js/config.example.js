/**
 * Configuration File Example
 *
 * Instructions:
 * 1. Copy this file and rename it to config.js in the same directory
 * 2. Replace 'YOUR_GEMINI_API_KEY_HERE' with your actual Google Gemini API key
 * 3. Get your API key from: https://makersuite.google.com/app/apikey
 *
 * Note: config.js is in .gitignore and will NOT be committed to git
 */

const CONFIG = {
    GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY_HERE'
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}

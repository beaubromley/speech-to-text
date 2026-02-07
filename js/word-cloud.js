/**
 * Word Cloud - Real-time word frequency visualization
 * CSS-based rendering with size-mapped words
 */

class WordCloud {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'shall', 'can', 'it', 'its', 'this', 'that',
            'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him',
            'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their', 'what',
            'which', 'who', 'whom', 'where', 'when', 'how', 'not', 'no', 'so',
            'if', 'then', 'than', 'too', 'very', 'just', 'about', 'up', 'out',
            'from', 'into', 'over', 'after', 'before', 'between', 'under', 'again',
            'there', 'here', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
            'other', 'some', 'such', 'only', 'own', 'same', 'also', 'as', 'like',
            'because', 'while', 'during', 'through', 'um', 'uh', 'ah', 'oh', 'yeah',
            'okay', 'ok', 'well', 'right', 'know', 'think', 'thing', 'things',
            'going', 'got', 'get', 'go', 'come', 'make', 'say', 'said', 'really',
            'much', 'many', 'even', 'still', 'back', 'way', 'dont', "don't",
            'im', "i'm", 'its', "it's", 'thats', "that's", 'theyre', "they're"
        ]);
        this.maxWords = 30;
    }

    /**
     * Update the word cloud from transcript text
     * @param {string} text - Transcript text
     */
    update(text) {
        if (!this.container) return;

        const frequencies = this.getWordFrequencies(text);
        if (frequencies.length === 0) {
            this.container.innerHTML = '<span class="wc-empty">Words will appear here...</span>';
            return;
        }

        const maxFreq = frequencies[0][1];
        const minFreq = frequencies[frequencies.length - 1][1];

        let html = '';
        // Shuffle for visual variety
        const shuffled = [...frequencies].sort(() => Math.random() - 0.5);

        for (const [word, count] of shuffled) {
            const size = this.mapSize(count, minFreq, maxFreq);
            const opacity = 0.5 + (count / maxFreq) * 0.5;
            html += `<span class="wc-word" style="font-size:${size}rem;opacity:${opacity}">${word}</span> `;
        }

        this.container.innerHTML = html;
    }

    /**
     * Get word frequencies from text
     * @param {string} text
     * @returns {Array} - Sorted [word, count] pairs
     */
    getWordFrequencies(text) {
        if (!text || text.trim().length === 0) return [];

        const words = text.toLowerCase()
            .replace(/\[[\d:]+\]/g, '') // Remove timestamp markers
            .replace(/[^\w\s']/g, '')
            .split(/\s+/)
            .filter(w => w.length > 2 && !this.stopWords.has(w));

        const freq = {};
        for (const word of words) {
            freq[word] = (freq[word] || 0) + 1;
        }

        return Object.entries(freq)
            .filter(([, count]) => count >= 2) // Only words appearing 2+ times
            .sort((a, b) => b[1] - a[1])
            .slice(0, this.maxWords);
    }

    /**
     * Map frequency to font size
     */
    mapSize(count, min, max) {
        if (max === min) return 1;
        const ratio = (count - min) / (max - min);
        return 0.65 + ratio * 1.35; // 0.65rem to 2rem
    }
}

if (typeof window !== 'undefined') {
    window.WordCloud = WordCloud;
}

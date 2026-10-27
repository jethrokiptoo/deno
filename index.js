/**
 * LexiPulse Architecture & State Engine
 */

const API_BASE_URL =
    'https://api.dictionaryapi.dev/api/v2/entries/en/';

// Curated discovery words
const DISCOVERY_WORDS = [
    {
        word: 'synthwave',
        def: 'A microgenre of electronic music inspired by 1980s film soundtracks and video games.'
    },
    {
        word: 'cybernetics',
        def: 'The science of communications and automatic control systems in machines and living things.'
    },
    {
        word: 'ethereal',
        def: 'Extremely delicate and light in a way that seems too perfect for this world.'
    },
    {
        word: 'quantum',
        def: 'A discrete quantity of energy proportional in magnitude to the frequency of the radiation.'
    },
    {
        word: 'hologram',
        def: 'A three-dimensional image formed by the interference of light beams from a laser.'
    },
    {
        word: 'neon',
        def: 'Giving off a bright electric fluorescence or vivid color effect.'
    }
];

// App state
let currentWordData = null;
let activeAudioUrl = null;

let searchHistory =
    JSON.parse(localStorage.getItem('lexipulse_history')) || [];

let savedBookmarks =
    JSON.parse(localStorage.getItem('lexipulse_bookmarks')) || [];

// Canvas animation variables
let isAudioPlaying = false;
let waveformAnimId = null;
let mindmapNodes = [];

// DOM elements
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');

const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const resultsContainer = document.getElementById('resultsContainer');

const resultWord = document.getElementById('resultWord');
const resultPhonetic = document.getElementById('resultPhonetic');
const meaningsContainer = document.getElementById('meaningsContainer');
const sourceUrl = document.getElementById('sourceUrl');

const playAudioBtn = document.getElementById('playAudioBtn');
const playIcon = document.getElementById('playIcon');
const audioPlayer = document.getElementById('audioPlayer');

const bookmarkToggleBtn =
    document.getElementById('bookmarkToggleBtn');

const bookmarkCount = document.getElementById('bookmarkCount');

const bookmarkDrawer = document.getElementById('bookmarkDrawer');
const historyDrawer = document.getElementById('historyDrawer');
const drawerBackdrop = document.getElementById('drawerBackdrop');

// Initialize application
window.addEventListener('DOMContentLoaded', () => {
    initBackgroundParticleCanvas();
    initWaveformCanvas();
    initWordOfDay();
    updateBookmarkBadge();
    setupEventListeners();

    // Load the first word
    loadWord('synthwave');
});

// Set up event listeners
function setupEventListeners() {
    searchInput.addEventListener('input', (event) => {
        if (event.target.value.trim().length > 0) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        searchInput.focus();
    });

    playAudioBtn.addEventListener('click', playPronunciation);

    bookmarkToggleBtn.addEventListener('click', toggleBookmark);

    document
        .getElementById('bookmarksBtn')
        .addEventListener('click', openBookmarkDrawer);

    document
        .getElementById('closeBookmarkBtn')
        .addEventListener('click', closeDrawers);

    document
        .getElementById('historyBtn')
        .addEventListener('click', openHistoryDrawer);

    document
        .getElementById('closeHistoryBtn')
        .addEventListener('click', closeDrawers);

    drawerBackdrop.addEventListener('click', closeDrawers);

    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        if (
            event.key === '/' &&
            document.activeElement !== searchInput
        ) {
            event.preventDefault();
            searchInput.focus();
            searchInput.select();
        } else if (event.key === 'Escape') {
            closeDrawers();
        }
    });
}

// Initialize the word of the day
function initWordOfDay() {
    const todayIndex =
        new Date().getDate() % DISCOVERY_WORDS.length;

    const item = DISCOVERY_WORDS[todayIndex];

    document.getElementById('wotdWord').textContent = item.word;
    document.getElementById('wotdDef').textContent = item.def;

    document.getElementById('wotdBtn').onclick = () => {
        loadWord(item.word);
    };
}

// Load a random discovery word
function triggerSurpriseWord() {
    const randomIndex = Math.floor(
        Math.random() * DISCOVERY_WORDS.length
    );

    loadWord(DISCOVERY_WORDS[randomIndex].word);
}

// Handle search form submission
function handleSearch(event) {
    event.preventDefault();

    const query = searchInput.value.trim().toLowerCase();

    if (query) {
        loadWord(query);
    }
}

// Fetch a word from the dictionary API
async function loadWord(word) {
    word = word.trim().toLowerCase();

    if (!word) return;

    searchInput.value = word;
    clearSearchBtn.classList.remove('hidden');

    showLoading(true);

    try {
        const response = await fetch(
            `${API_BASE_URL}${encodeURIComponent(word)}`
        );

        if (!response.ok) {
            if (response.status === 404) {
                showError(
                    'TERM NOT FOUND',
                    `No quantum entry exists for "${word}". Double check your spelling or search another word.`
                );
            } else {
                showError(
                    'API SERVICE ERROR',
                    'Failed to retrieve dictionary data. Try again later.'
                );
            }

            return;
        }

        const data = await response.json();

        currentWordData = data[0];

        addToHistory(word);
        renderWordData(currentWordData);

    } catch (error) {
        showError(
            'NETWORK ERROR',
            'Connection lost. Please verify your internet connection.'
        );
    } finally {
        showLoading(false);
    }
}

// Display dictionary data on the page
function renderWordData(data) {
    errorState.classList.add('hidden');
    resultsContainer.classList.remove('hidden');

    resultWord.textContent = data.word;

    // Extract phonetic spelling and audio URL
    let phoneticText = data.phonetic || '';

    activeAudioUrl = null;

    if (data.phonetics && data.phonetics.length > 0) {
        for (const phonetic of data.phonetics) {
            if (!phoneticText && phonetic.text) {
                phoneticText = phonetic.text;
            }

            if (phonetic.audio) {
                activeAudioUrl = phonetic.audio;

                if (phonetic.text) {
                    phoneticText = phonetic.text;
                }

                break;
            }
        }
    }

    resultPhonetic.textContent =
        phoneticText || 'Phonetic unavailable';

    if (activeAudioUrl) {
        audioPlayer.src = activeAudioUrl;
    } else {
        audioPlayer.src = '';
    }

    updateBookmarkButtonState(data.word);

    sourceUrl.href = data.sourceUrls
        ? data.sourceUrls[0]
        : `https://en.wiktionary.org/wiki/${data.word}`;

    renderMeanings(data.meanings || []);
    renderMindmap(data);
}

// Display definitions, synonyms, and antonyms
function renderMeanings(meanings) {
    meaningsContainer.innerHTML = '';

    if (meanings.length === 0) {
        meaningsContainer.innerHTML =
            `<div class="text-slate-500 italic">No detailed definitions found.</div>`;

        return;
    }

    meanings.forEach((meaning) => {
        const card = document.createElement('div');

        card.className =
            'glass-panel p-6 rounded-3xl border border-slate-800 space-y-4';

        // Part of speech heading
        const posHeader = document.createElement('div');

        posHeader.className =
            'flex items-center gap-3 border-b border-slate-800 pb-3';

        posHeader.innerHTML = `
            <span class="text-xs font-mono-code font-bold uppercase tracking-wider px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-lg">
                ${meaning.partOfSpeech}
            </span>

            <div class="h-[1px] flex-grow bg-gradient-to-r from-slate-800 to-transparent"></div>
        `;

        card.appendChild(posHeader);

        // Definitions list
        const definitionsList = document.createElement('ul');

        definitionsList.className = 'space-y-3 pl-2';

        meaning.definitions.forEach((definition) => {
            const listItem = document.createElement('li');

            listItem.className =
                'flex items-start gap-3 text-slate-200 text-base leading-relaxed';

            listItem.innerHTML = `
                <span class="text-cyan-400 font-mono-code text-xs mt-1.5">▸</span>

                <div class="space-y-1 flex-grow">
                    <p>${definition.definition}</p>

                    ${
                        definition.example
                            ? `<p class="text-sm text-purple-300/80 italic font-light">"${definition.example}"</p>`
                            : ''
                    }
                </div>
            `;

            definitionsList.appendChild(listItem);
        });

        card.appendChild(definitionsList);

        // Synonym buttons
        if (meaning.synonyms && meaning.synonyms.length > 0) {
            const synonymBox = document.createElement('div');

            synonymBox.className =
                'pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2';

            synonymBox.innerHTML = `
                <span class="text-xs font-semibold text-slate-400 mr-1 font-mono-code">
                    Synonyms:
                </span>
            `;

            meaning.synonyms.slice(0, 8).forEach((synonym) => {
                const button = document.createElement('button');

                button.className =
                    'px-3 py-1 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-medium rounded-xl transition-all active:scale-95';

                button.textContent = synonym;

                button.onclick = () => loadWord(synonym);

                synonymBox.appendChild(button);
            });

            card.appendChild(synonymBox);
        }

        // Antonym buttons
        if (meaning.antonyms && meaning.antonyms.length > 0) {
            const antonymBox = document.createElement('div');

            antonymBox.className =
                'pt-2 flex flex-wrap items-center gap-2';

            antonymBox.innerHTML = `
                <span class="text-xs font-semibold text-slate-400 mr-1 font-mono-code">
                    Antonyms:
                </span>
            `;

            meaning.antonyms.slice(0, 6).forEach((antonym) => {
                const button = document.createElement('button');

                button.className =
                    'px-3 py-1 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs font-medium rounded-xl transition-all active:scale-95';

                button.textContent = antonym;

                button.onclick = () => loadWord(antonym);

                antonymBox.appendChild(button);
            });

            card.appendChild(antonymBox);
        }

        meaningsContainer.appendChild(card);
    });
}

// Play word pronunciation
function playPronunciation() {
    if (!currentWordData) return;

    startWaveformAnim();

    if (activeAudioUrl) {
        audioPlayer.play()
            .then(() => {
                playIcon.className = 'fa-solid fa-pause';

                audioPlayer.onended = () => {
                    playIcon.className = 'fa-solid fa-play ml-0.5';
                    stopWaveformAnim();
                };
            })
            .catch(() => {
                fallbackSpeechSynthesis(currentWordData.word);
            });

    } else if (currentWordData.word) {
        fallbackSpeechSynthesis(currentWordData.word);
    }
}

// Use browser speech synthesis if audio is unavailable
function fallbackSpeechSynthesis(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);

        utterance.lang = 'en-US';
        utterance.rate = 0.9;

        playIcon.className = 'fa-solid fa-volume-high';

        utterance.onend = () => {
            playIcon.className = 'fa-solid fa-play ml-0.5';
            stopWaveformAnim();
        };

        utterance.onerror = () => {
            playIcon.className = 'fa-solid fa-play ml-0.5';
            stopWaveformAnim();
        };

        window.speechSynthesis.speak(utterance);

        showToast('Using Synthetic Speech Engine', 'info');

    } else {
        stopWaveformAnim();

        showToast(
            'Audio unsupported on this browser',
            'error'
        );
    }
}

// Initialize the audio waveform
function initWaveformCanvas() {
    const canvas = document.getElementById('waveformCanvas');
    const context = canvas.getContext('2d');

    context.fillStyle = '#0f172a';

    context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    drawWaveformFrame(context, canvas, false);
}

// Animate the waveform while audio is playing
function startWaveformAnim() {
    isAudioPlaying = true;

    const canvas = document.getElementById('waveformCanvas');
    const context = canvas.getContext('2d');

    function loop() {
        if (!isAudioPlaying) return;

        drawWaveformFrame(context, canvas, true);

        waveformAnimId = requestAnimationFrame(loop);
    }

    loop();
}

// Stop waveform animation
function stopWaveformAnim() {
    isAudioPlaying = false;

    if (waveformAnimId) {
        cancelAnimationFrame(waveformAnimId);
    }

    const canvas = document.getElementById('waveformCanvas');
    const context = canvas.getContext('2d');

    drawWaveformFrame(context, canvas, false);
}

// Draw waveform bars
function drawWaveformFrame(context, canvas, active) {
    context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    context.fillStyle = '#090d16';

    context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const numberOfBars = 24;
    const barWidth = 4;
    const gap = 2;

    const startX =
        (canvas.width - numberOfBars * (barWidth + gap)) / 2;

    for (let i = 0; i < numberOfBars; i++) {
        let height = 4;

        if (active) {
            height =
                Math.sin(Date.now() * 0.01 + i * 0.3) * 14 + 18;
        }

        const x = startX + i * (barWidth + gap);
        const y = (canvas.height - height) / 2;

        const gradient = context.createLinearGradient(
            0,
            0,
            0,
            canvas.height
        );

        gradient.addColorStop(0, '#00f3ff');
        gradient.addColorStop(1, '#b537f2');

        context.fillStyle = gradient;

        context.beginPath();

        context.roundRect(
            x,
            y,
            barWidth,
            height,
            2
        );

        context.fill();
    }
}

// Render the interactive synonym mind map
function renderMindmap(data) {
    const container =
        document.getElementById('mindmapCanvasContainer');

    const canvas =
        document.getElementById('synonymMindmapCanvas');

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const context = canvas.getContext('2d');

    // Gather synonyms from all meanings
    let synonyms = [];

    data.meanings.forEach((meaning) => {
        if (meaning.synonyms) {
            synonyms.push(...meaning.synonyms);
        }
    });

    synonyms = [...new Set(synonyms)].slice(0, 6);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    mindmapNodes = [
        {
            word: data.word,
            x: centerX,
            y: centerY,
            main: true
        }
    ];

    const radius =
        Math.min(canvas.width, canvas.height) * 0.32;

    synonyms.forEach((synonym, index) => {
        const angle =
            (index / synonyms.length) * Math.PI * 2;

        mindmapNodes.push({
            word: synonym,
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
            main: false
        });
    });

    // Draw connections
    mindmapNodes.forEach((node) => {
        if (!node.main) {
            context.beginPath();

            context.moveTo(centerX, centerY);
            context.lineTo(node.x, node.y);

            context.strokeStyle =
                'rgba(181, 55, 242, 0.4)';

            context.lineWidth = 1.5;
            context.setLineDash([4, 4]);

            context.stroke();

            context.setLineDash([]);
        }
    });

    // Draw nodes
    mindmapNodes.forEach((node) => {
        context.beginPath();

        context.arc(
            node.x,
            node.y,
            node.main ? 22 : 16,
            0,
            Math.PI * 2
        );

        context.fillStyle = node.main
            ? '#00f3ff'
            : 'rgba(12, 16, 29, 0.9)';

        context.fill();

        context.strokeStyle = node.main
            ? '#b537f2'
            : '#00f3ff';

        context.lineWidth = 2;
        context.stroke();

        context.fillStyle = node.main
            ? '#05070f'
            : '#e2e8f0';

        context.font = node.main
            ? 'bold 11px Orbitron'
            : '10px Plus Jakarta Sans';

        context.textAlign = 'center';
        context.textBaseline = 'middle';

        context.fillText(
            node.word.substring(0, 10),
            node.x,
            node.y
        );
    });

    // Clicking a synonym node searches for that word
    canvas.onclick = (event) => {
        const rect = canvas.getBoundingClientRect();

        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        mindmapNodes.forEach((node) => {
            const distance = Math.hypot(
                node.x - clickX,
                node.y - clickY
            );

            if (distance <= 20 && !node.main) {
                loadWord(node.word);
            }
        });
    };
}

// Initialize the animated particle background
function initBackgroundParticleCanvas() {
    const canvas = document.getElementById('particleCanvas');
    const context = canvas.getContext('2d');

    let particles = [];

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resize);

    resize();

    // Create particles
    for (let i = 0; i < 45; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            radius: Math.random() * 2 + 1
        });
    }

    function animate() {
        context.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        particles.forEach((particle, index) => {
            particle.x += particle.vx;
            particle.y += particle.vy;

            if (
                particle.x < 0 ||
                particle.x > canvas.width
            ) {
                particle.vx *= -1;
            }

            if (
                particle.y < 0 ||
                particle.y > canvas.height
            ) {
                particle.vy *= -1;
            }

            // Draw particle
            context.beginPath();

            context.arc(
                particle.x,
                particle.y,
                particle.radius,
                0,
                Math.PI * 2
            );

            context.fillStyle = 'rgba(0, 243, 255, 0.3)';
            context.fill();

            // Connect nearby particles
            for (
                let j = index + 1;
                j < particles.length;
                j++
            ) {
                const otherParticle = particles[j];

                const distance = Math.hypot(
                    particle.x - otherParticle.x,
                    particle.y - otherParticle.y
                );

                if (distance < 120) {
                    context.beginPath();

                    context.moveTo(
                        particle.x,
                        particle.y
                    );

                    context.lineTo(
                        otherParticle.x,
                        otherParticle.y
                    );

                    context.strokeStyle =
                        `rgba(181, 55, 242, ${0.15 * (1 - distance / 120)})`;

                    context.stroke();
                }
            }
        });

        requestAnimationFrame(animate);
    }

    animate();
}

// Add or remove a bookmark
function toggleBookmark() {
    if (!currentWordData) return;

    const word = currentWordData.word;

    const index = savedBookmarks.findIndex(
        (bookmark) => bookmark.word === word
    );

    if (index >= 0) {
        savedBookmarks.splice(index, 1);

        showToast(
            `Removed "${word}" from saved lexicon`,
            'info'
        );

    } else {
        savedBookmarks.unshift({
            word: word,
            phonetic: resultPhonetic.textContent,
            time: new Date().toLocaleDateString()
        });

        showToast(
            `Saved "${word}" to lexicon`,
            'success'
        );
    }

    localStorage.setItem(
        'lexipulse_bookmarks',
        JSON.stringify(savedBookmarks)
    );

    updateBookmarkButtonState(word);
    updateBookmarkBadge();
    renderBookmarkList();
}

// Update the bookmark icon
function updateBookmarkButtonState(word) {
    const isBookmarked = savedBookmarks.some(
        (bookmark) => bookmark.word === word
    );

    bookmarkToggleBtn.innerHTML = isBookmarked
        ? `<i class="fa-solid fa-bookmark text-pink-400"></i>`
        : `<i class="fa-regular fa-bookmark"></i>`;
}

// Update the bookmark counter
function updateBookmarkBadge() {
    if (savedBookmarks.length > 0) {
        bookmarkCount.textContent = savedBookmarks.length;
        bookmarkCount.classList.remove('hidden');
    } else {
        bookmarkCount.classList.add('hidden');
    }
}

// Display saved bookmarks
function renderBookmarkList() {
    const container = document.getElementById('bookmarkList');

    container.innerHTML = '';

    if (savedBookmarks.length === 0) {
        container.innerHTML = `
            <p class="text-slate-500 text-center py-8 text-sm font-mono-code">
                No saved entries.
            </p>
        `;

        return;
    }

    savedBookmarks.forEach((bookmark) => {
        const item = document.createElement('div');

        item.className =
            'glass-panel p-3.5 rounded-2xl flex items-center justify-between group hover:border-pink-500/50 transition-all';

        item.innerHTML = `
            <div
                class="cursor-pointer flex-grow"
                onclick="loadWord('${bookmark.word}'); closeDrawers();"
            >
                <h4 class="font-bold text-slate-200 capitalize font-orbitron group-hover:text-pink-400 transition-colors">
                    ${bookmark.word}
                </h4>

                <p class="text-xs text-slate-400 font-mono-code">
                    ${bookmark.phonetic || ''}
                </p>
            </div>

            <button
                onclick="removeBookmark('${bookmark.word}', event)"
                class="p-2 text-slate-500 hover:text-pink-400 transition-colors"
            >
                <i class="fa-solid fa-trash-can text-sm"></i>
            </button>
        `;

        container.appendChild(item);
    });
}

// Remove a bookmark
function removeBookmark(word, event) {
    event.stopPropagation();

    savedBookmarks = savedBookmarks.filter(
        (bookmark) => bookmark.word !== word
    );

    localStorage.setItem(
        'lexipulse_bookmarks',
        JSON.stringify(savedBookmarks)
    );

    updateBookmarkBadge();
    renderBookmarkList();

    if (
        currentWordData &&
        currentWordData.word === word
    ) {
        updateBookmarkButtonState(word);
    }
}

// Add a searched word to history
function addToHistory(word) {
    searchHistory = searchHistory.filter(
        (historyWord) => historyWord !== word
    );

    searchHistory.unshift(word);

    if (searchHistory.length > 20) {
        searchHistory.pop();
    }

    localStorage.setItem(
        'lexipulse_history',
        JSON.stringify(searchHistory)
    );
}

// Display search history
function renderHistoryList() {
    const container =
        document.getElementById('historyDrawerList');

    container.innerHTML = '';

    if (searchHistory.length === 0) {
        container.innerHTML = `
            <p class="text-slate-500 text-center py-8 text-sm font-mono-code">
                History timeline empty.
            </p>
        `;

        return;
    }

    searchHistory.forEach((word) => {
        const item = document.createElement('div');

        item.className =
            'glass-panel p-3 rounded-xl flex items-center justify-between cursor-pointer hover:border-purple-500/50 transition-all';

        item.onclick = () => {
            loadWord(word);
            closeDrawers();
        };

        item.innerHTML = `
            <span class="capitalize text-slate-300 font-medium font-mono-code">
                ${word}
            </span>

            <i class="fa-solid fa-chevron-right text-xs text-slate-600"></i>
        `;

        container.appendChild(item);
    });
}

// Clear search history
function clearHistory() {
    searchHistory = [];

    localStorage.removeItem('lexipulse_history');

    renderHistoryList();

    showToast('Search timeline cleared', 'info');
}

// Open saved words drawer
function openBookmarkDrawer() {
    closeDrawers();

    renderBookmarkList();

    bookmarkDrawer.classList.remove('translate-x-full');
    drawerBackdrop.classList.remove('hidden');
}

// Open search history drawer
function openHistoryDrawer() {
    closeDrawers();

    renderHistoryList();

    historyDrawer.classList.remove('translate-x-full');
    drawerBackdrop.classList.remove('hidden');
}

// Close drawers
function closeDrawers() {
    bookmarkDrawer.classList.add('translate-x-full');
    historyDrawer.classList.add('translate-x-full');

    drawerBackdrop.classList.add('hidden');
}

// Copy word details
function copyWordDetails() {
    if (!currentWordData) return;

    const copyText =
        `${currentWordData.word} (${resultPhonetic.textContent})\nSource: LexiPulse Quantum Lexicon`;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(copyText);
    } else {
        const area = document.createElement('textarea');

        area.value = copyText;

        document.body.appendChild(area);

        area.select();

        document.execCommand('copy');

        document.body.removeChild(area);
    }

    showToast('Word details copied to clipboard!', 'success');
}

// Share word details
function shareWord() {
    if (!currentWordData) return;

    if (navigator.share) {
        navigator.share({
            title: `LexiPulse - ${currentWordData.word}`,
            text: `Explore definition of ${currentWordData.word} on LexiPulse!`,
            url: window.location.href
        }).catch(() => {});
    } else {
        copyWordDetails();
    }
}

// Show loading state
function showLoading(isLoading) {
    if (isLoading) {
        loadingState.classList.remove('hidden');
        resultsContainer.classList.add('hidden');
        errorState.classList.add('hidden');
    } else {
        loadingState.classList.add('hidden');
    }
}

// Show an error message
function showError(title, message) {
    resultsContainer.classList.add('hidden');
    loadingState.classList.add('hidden');

    document.getElementById('errorTitle').textContent = title;
    document.getElementById('errorMessage').textContent = message;

    errorState.classList.remove('hidden');
}

// Clear search input and focus it
function clearAndFocusSearch() {
    searchInput.value = '';
    searchInput.focus();

    errorState.classList.add('hidden');
}

// Display toast notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');

    let borderStyle =
        'border-purple-500/50 text-purple-300';

    if (type === 'success') {
        borderStyle =
            'border-cyan-500/50 text-cyan-300';
    }

    if (type === 'error') {
        borderStyle =
            'border-pink-500/50 text-pink-300';
    }

    toast.className =
        `pointer-events-auto px-4 py-3 rounded-2xl border shadow-xl text-xs font-mono-code flex items-center gap-3 transition-all transform translate-y-2 opacity-0 glass-panel ${borderStyle}`;

    toast.innerHTML = `
        <i class="fa-solid ${
            type === 'success'
                ? 'fa-circle-check text-cyan-400'
                : type === 'error'
                    ? 'fa-circle-xmark text-pink-400'
                    : 'fa-circle-info text-purple-400'
        }"></i>

        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');

        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
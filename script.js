// @ts-nocheck
// =========================================
// USpeak - Lógica de búsqueda dinámica + YouTube
// =========================================

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

// Referencias al DOM
const wordInput = document.getElementById('word-input');
const searchBtn = document.getElementById('search-btn');

// Panel de detalles
const wordTitle = document.getElementById('dynamic-word');
const wordType = document.getElementById('dynamic-type');
const tabsContainer = document.getElementById('dynamic-tabs');
const definitionBox = document.getElementById('dynamic-definition');
const audioBtn = document.getElementById('dynamic-audio');
const examplesList = document.getElementById('dynamic-examples');

// Sección de video
const videoWordTitle = document.getElementById('video-word-title');
const videoMeaningCount = document.getElementById('video-meaning-count');
const videoDescriptionText = document.getElementById('video-description-text');
const videoGrid = document.getElementById('video-grid');
const examplesTitle = document.getElementById('examples-title');
const ytPlayer = document.getElementById('yt-player');
const placeholderMessage = document.getElementById('video-placeholder-message');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const playPauseBtn = document.getElementById('play-pause-btn');
const videoCounter = document.getElementById('video-counter');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const downloadBtn = document.getElementById('download-btn');

// Estado global
let currentEntry = null;
let currentMeaningIndex = 0;
let currentVideoIndex = 0;
let totalVideos = 10; // Cantidad estimada de videos por búsqueda
let currentSearchQuery = '';

// =========================================
// Búsqueda principal
// =========================================
async function searchWord() {
    const word = wordInput.value.trim().toLowerCase();
    if (!word) {
        wordInput.focus();
        return;
    }

    // Estado de carga
    wordTitle.textContent = 'Buscando...';
    wordType.textContent = '';
    definitionBox.innerHTML = '<em>Cargando definición...</em>';
    audioBtn.style.display = 'none';
    tabsContainer.innerHTML = '';
    examplesList.innerHTML = '';
    videoWordTitle.textContent = word;
    videoMeaningCount.textContent = '— significados';
    videoDescriptionText.textContent = 'Cargando videos...';
    videoGrid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1;">Cargando ejemplos...</p>';

    try {
        const response = await fetch(`${API_BASE}${encodeURIComponent(word)}`);
        if (!response.ok) throw new Error('not found');
        const data = await response.json();
        currentEntry = data[0];
        currentMeaningIndex = 0;
        renderEntry(currentEntry);
        loadYouTubeVideos(word, currentEntry.meanings[0].partOfSpeech);
    } catch (error) {
        console.error('Error API:', error);
        wordTitle.textContent = word;
        wordType.textContent = '';
        definitionBox.innerHTML = `<em style="color: var(--accent-red);">No se encontró "${word}". Intenta con otra palabra.</em>`;
        audioBtn.style.display = 'none';
        tabsContainer.innerHTML = '';
        examplesList.innerHTML = '';
        videoWordTitle.textContent = word;
        videoMeaningCount.textContent = '— significados';
        videoDescriptionText.textContent = 'No hay datos disponibles.';
        videoGrid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1;">No hay ejemplos disponibles.</p>';
        hideYouTubePlayer();
    }
}

// =========================================
// Renderiza la entrada completa
// =========================================
function renderEntry(entry) {
    wordTitle.textContent = entry.word;

    // 1. Renderizar pestañas de categorías gramaticales
    tabsContainer.innerHTML = '';
    entry.meanings.forEach((meaning, index) => {
        const tab = document.createElement('button');
        tab.className = 'tab' + (index === 0 ? ' active' : '');
        tab.textContent = `${meaning.partOfSpeech} (${meaning.definitions.length})`;
        tab.addEventListener('click', () => renderMeaning(index));
        tabsContainer.appendChild(tab);
    });

    // 2. Renderizar el primer significado
    renderMeaning(0);

    // 3. Actualizar encabezado de video
    videoWordTitle.textContent = entry.word;
    videoMeaningCount.textContent = `${entry.meanings.length} significado${entry.meanings.length !== 1 ? 's' : ''}`;

    // 4. Renderizar la cuadrícula de ejemplos
    renderExamplesGrid(entry);
}

// =========================================
// Renderiza un significado específico
// =========================================
function renderMeaning(index) {
    currentMeaningIndex = index;
    const meaning = currentEntry.meanings[index];

    // Actualizar tabs activos
    const tabs = tabsContainer.querySelectorAll('.tab');
    tabs.forEach((tab, i) => tab.classList.toggle('active', i === index));

    // Tipo gramatical
    wordType.textContent = meaning.partOfSpeech.toUpperCase();

    // Definición
    const firstDef = meaning.definitions[0];
    definitionBox.innerHTML = `<strong>1.</strong> ${firstDef.definition}`;

    // Audio + IPA
    const phonetic = currentEntry.phonetics.find(p => p.audio) || currentEntry.phonetics[0];
    if (phonetic && phonetic.audio) {
        audioBtn.style.display = 'flex';
        audioBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            ${phonetic.text || currentEntry.phonetic || ''}
        `;
        audioBtn.onclick = () => new Audio(phonetic.audio).play().catch(() => {});
    } else if (currentEntry.phonetic) {
        audioBtn.style.display = 'flex';
        audioBtn.innerHTML = `<span>${currentEntry.phonetic}</span>`;
        audioBtn.onclick = null;
    } else {
        audioBtn.style.display = 'none';
    }

    // Ejemplos escritos del significado actual
    let examplesHTML = '';
    let count = 0;
    for (const def of meaning.definitions) {
        if (def.example && count < 5) {
            examplesHTML += `
                <div class="example-item">
                    <p>"${def.example}"</p>
                    <span class="source">- ${meaning.partOfSpeech}</span>
                </div>
            `;
            count++;
        }
    }
    if (examplesHTML) {
        examplesList.innerHTML = examplesHTML;
    } else {
        examplesList.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">No hay ejemplos escritos para este significado.</p>';
    }

    // Actualizar videos al cambiar de significado
    if (currentEntry) {
        loadYouTubeVideos(currentEntry.word, meaning.partOfSpeech);
    }
}

// =========================================
// Carga videos de YouTube embebidos
// =========================================
function loadYouTubeVideos(word, partOfSpeech) {
    // Construir query optimizada para encontrar la palabra hablada
    // Agregamos "USA" y "speaking" para favorecer acentos americanos
    currentSearchQuery = `${word} ${partOfSpeech} American English`;
    currentVideoIndex = 0;
    totalVideos = 10;

    const encodedQuery = encodeURIComponent(currentSearchQuery);

    // Usamos el iframe de YouTube con listType=search
    // Esto muestra una lista de videos que coinciden con la búsqueda
    const embedUrl = `https://www.youtube.com/embed?listType=search&list=${encodedQuery}&autoplay=1&rel=0&modestbranding=1`;

    // Mostrar el iframe, ocultar el placeholder
    placeholderMessage.style.display = 'none';
    ytPlayer.style.display = 'block';
    ytPlayer.src = embedUrl;

    // Actualizar UI
    videoDescriptionText.textContent = `Reproduciendo videos con "${word}" (${partOfSpeech}) en inglés americano. Usa los botones ⏮ y ⏭ para navegar.`;
    videoCounter.textContent = `${currentVideoIndex + 1} / ${totalVideos}`;
}

// =========================================
// Oculta el reproductor de YouTube
// =========================================
function hideYouTubePlayer() {
    ytPlayer.style.display = 'none';
    ytPlayer.src = '';
    placeholderMessage.style.display = 'flex';
}

// =========================================
// Navegación entre videos (simulada)
// =========================================
function navigateVideo(direction) {
    if (!currentSearchQuery) return;

    if (direction === 'next') {
        currentVideoIndex = (currentVideoIndex + 1) % totalVideos;
    } else {
        currentVideoIndex = (currentVideoIndex - 1 + totalVideos) % totalVideos;
    }

    // Recargar iframe con un índice diferente para forzar nueva búsqueda
    // Añadimos un parámetro random para evitar caché
    const encodedQuery = encodeURIComponent(currentSearchQuery);
    const cacheBuster = Date.now();
    ytPlayer.src = `https://www.youtube.com/embed?listType=search&list=${encodedQuery}&autoplay=1&rel=0&modestbranding=1&t=${cacheBuster}`;

    videoCounter.textContent = `${currentVideoIndex + 1} / ${totalVideos}`;
}

// =========================================
// Renderiza la cuadrícula de ejemplos escritos
// =========================================
function renderExamplesGrid(entry) {
    const allExamples = [];
    entry.meanings.forEach(meaning => {
        meaning.definitions.forEach(def => {
            if (def.example) {
                allExamples.push({ text: def.example, pos: meaning.partOfSpeech });
            }
        });
    });

    if (allExamples.length === 0) {
        examplesTitle.textContent = 'More real examples';
        videoGrid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1;">No hay ejemplos disponibles para esta palabra.</p>';
        return;
    }

    examplesTitle.textContent = `More real examples (${allExamples.length})`;
    videoGrid.innerHTML = '';

    // Mostrar hasta 8 ejemplos
    allExamples.slice(0, 8).forEach((ex, i) => {
        const card = document.createElement('div');
        card.className = 'video-card';

        const searchQuery = encodeURIComponent(ex.text + ' American English');
        const thumbnail = document.createElement('div');
        thumbnail.className = 'card-thumbnail';
        thumbnail.innerHTML = `
            <span class="card-duration">#${i + 1}</span>
            <div class="card-overlay"><span>${ex.text}</span></div>
            <div class="play-icon-small">
                <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </div>
        `;
        thumbnail.addEventListener('click', () => {
            // Reproducir en el reproductor principal
            currentSearchQuery = ex.text + ' American English';
            ytPlayer.src = `https://www.youtube.com/embed?listType=search&list=${searchQuery}&autoplay=1&rel=0&modestbranding=1`;
            placeholderMessage.style.display = 'none';
            ytPlayer.style.display = 'block';
            videoDescriptionText.textContent = `Reproduciendo: "${ex.text}"`;
            
            // Scroll al reproductor
            ytPlayer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        card.appendChild(thumbnail);
        videoGrid.appendChild(card);
    });
}

// =========================================
// Eventos
// =========================================
searchBtn.addEventListener('click', searchWord);
wordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchWord();
});

prevBtn.addEventListener('click', () => navigateVideo('prev'));
nextBtn.addEventListener('click', () => navigateVideo('next'));

playPauseBtn.addEventListener('click', () => {
    // Enviar mensaje al iframe de YouTube para play/pause
    if (ytPlayer.contentWindow) {
        ytPlayer.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    }
});

fullscreenBtn.addEventListener('click', () => {
    if (ytPlayer.requestFullscreen) {
        ytPlayer.requestFullscreen();
    } else if (ytPlayer.webkitRequestFullscreen) {
        ytPlayer.webkitRequestFullscreen();
    }
});

// Filtros visuales
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const parent = btn.parentElement;
        parent.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Botón de descarga
downloadBtn.addEventListener('click', () => {
    alert('Función de descarga offline en desarrollo. Se integrará con yt-dlp + FFmpeg en la versión PC.');
});

// Cargar una búsqueda inicial de ejemplo (opcional, se puede quitar)
// wordInput.value = 'run';
// searchWord();
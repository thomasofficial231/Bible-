/* ============================================================
   SCRIPT.JS — Bible Mood Verses
   Vanilla JavaScript — no frameworks needed.

   HOW IT WORKS:
   1. On load, verses.json is fetched and stored in `allVerses`.
   2. When a mood button is clicked, the matching mood's verses
      are filtered and a random one is shown.
   3. "Another Verse →" picks the next verse from the same pool,
      cycling through without repeating until the pool is exhausted.
   4. Copy / Share use the Clipboard and Web Share APIs.
   ============================================================ */

// -----------------------------------------------------------
// 1. STATE — tracks the current session
// -----------------------------------------------------------
let allVerses      = [];   // all verses loaded from verses.json
let currentPool    = [];   // verses available for the current mood/random session
let currentMood    = null; // string key e.g. "sad", "peace", or "random"
let isRandom       = false; // true when the Random button was used

// Mood display names (maps data-mood values → readable label)
// ✏️  Add a new entry here if you add a new mood category.
const MOOD_LABELS = {
  sad:       '🕊 Sad',
  anxious:   '🌿 Anxious / Worried',
  fear:      '🛡 Afraid',
  lonely:    '🤍 Lonely',
  strength:  '⚡ Need Strength',
  peace:     '☁️ Need Peace',
  thankful:  '🙏 Thankful',
  random:    '✦ Random Verse',
};

// -----------------------------------------------------------
// 2. DOM REFERENCES
// -----------------------------------------------------------
const moodScreen   = document.getElementById('mood-screen');
const verseScreen  = document.getElementById('verse-screen');
const moodLabel    = document.getElementById('mood-label');
const verseText    = document.getElementById('verse-text');
const verseRef     = document.getElementById('verse-ref');
const backBtn      = document.getElementById('back-btn');
const anotherBtn   = document.getElementById('another-btn');
const copyBtn      = document.getElementById('copy-btn');
const shareBtn     = document.getElementById('share-btn');
const randomBtn    = document.getElementById('random-btn');
const toast        = document.getElementById('toast');

// -----------------------------------------------------------
// 3. LOAD VERSES FROM verses.json
// -----------------------------------------------------------
async function loadVerses() {
  try {
    const response = await fetch('verses.json');
    if (!response.ok) throw new Error('Could not load verses.json');

    // verses.json uses // comments, so we strip them before parsing.
    // Standard JSON doesn't support comments, but this lets you
    // annotate the file for easy editing.
    const rawText = await response.text();
    const stripped = rawText.replace(/\/\/[^\n]*/g, '');   // remove // comments
    allVerses = JSON.parse(stripped);

    console.log(`✅ Loaded ${allVerses.length} verses.`);
    initEventListeners();
  } catch (err) {
    console.error('⚠️ Error loading verses:', err);
    // Show a friendly fallback in case the file is missing
    allVerses = [{
      mood: 'error',
      verse: 'Your word is a lamp for my feet, a light on my path.',
      reference: 'Psalm 119:105',
    }];
    initEventListeners();
  }
}

// -----------------------------------------------------------
// 4. HELPERS
// -----------------------------------------------------------

/**
 * Returns all verses matching the given mood string.
 * If mood is "random" or not specified, returns allVerses.
 */
function getVersesByMood(mood) {
  if (!mood || mood === 'random') return [...allVerses];
  return allVerses.filter(v => v.mood === mood);
}

/**
 * Fisher-Yates shuffle — randomises array in place, returns it.
 */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Sets up a fresh shuffled pool for the current mood/random session.
 */
function buildPool(mood) {
  const verses = getVersesByMood(mood);
  currentPool = shuffle(verses);
}

/**
 * Pops the next verse from the pool.
 * If the pool is empty, reshuffles so the user can keep going.
 */
function nextVerse() {
  if (currentPool.length === 0) {
    buildPool(isRandom ? 'random' : currentMood);
  }
  return currentPool.pop();
}

// -----------------------------------------------------------
// 5. UI — SHOW / HIDE SCREENS
// -----------------------------------------------------------
function showVerseScreen() {
  moodScreen.classList.remove('active');
  verseScreen.classList.add('active');
  // Re-trigger animation on verse card
  const card = document.getElementById('verse-card');
  card.style.animation = 'none';
  // Force reflow so removing the animation class takes effect
  void card.offsetWidth;
  card.style.animation = '';
}

function showMoodScreen() {
  verseScreen.classList.remove('active');
  moodScreen.classList.add('active');
}

// -----------------------------------------------------------
// 6. UI — DISPLAY A VERSE
// -----------------------------------------------------------
function displayVerse(verseObj) {
  verseText.textContent = verseObj.verse;
  verseRef.textContent  = verseObj.reference;

  // Set the mood label at the top of the verse screen
  if (isRandom) {
    moodLabel.textContent = MOOD_LABELS['random'];
  } else {
    moodLabel.textContent = MOOD_LABELS[currentMood] || '';
  }
}

// -----------------------------------------------------------
// 7. TOAST NOTIFICATION
// -----------------------------------------------------------
let toastTimeout;

function showToast(message) {
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2500);
}

// -----------------------------------------------------------
// 8. COPY VERSE TO CLIPBOARD
// -----------------------------------------------------------
async function copyVerse() {
  const text = `"${verseText.textContent}" — ${verseRef.textContent}`;
  try {
    await navigator.clipboard.writeText(text);
    showToast('✔ Verse copied to clipboard!');
  } catch {
    // Fallback for older browsers
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity  = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('✔ Verse copied!');
  }
}

// -----------------------------------------------------------
// 9. SHARE VERSE (Web Share API — works on mobile)
// -----------------------------------------------------------
async function shareVerse() {
  const shareText = `"${verseText.textContent}" — ${verseRef.textContent}\n\nShared from Bible Mood Verses`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Bible Mood Verses',
        text:  shareText,
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        // User cancelled — that's fine; only show error for real failures
        showToast('Could not share. Try copying instead.');
      }
    }
  } else {
    // Web Share API not available — fall back to copying
    await copyVerse();
    showToast('✔ Copied — paste to share!');
  }
}

// -----------------------------------------------------------
// 10. EVENT LISTENERS
// -----------------------------------------------------------
function initEventListeners() {

  // ---- Mood buttons ----
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentMood = btn.dataset.mood;
      isRandom    = false;
      buildPool(currentMood);

      const verse = nextVerse();
      if (!verse) {
        showToast('No verses found for this mood.');
        return;
      }
      displayVerse(verse);
      showVerseScreen();
    });
  });

  // ---- Random Verse button ----
  randomBtn.addEventListener('click', () => {
    currentMood = 'random';
    isRandom    = true;
    buildPool('random');

    const verse = nextVerse();
    if (!verse) { showToast('No verses loaded.'); return; }
    displayVerse(verse);
    showVerseScreen();
  });

  // ---- Another Verse button ----
  anotherBtn.addEventListener('click', () => {
    const verse = nextVerse();
    if (!verse) { showToast('No more verses.'); return; }

    // Animate the card out then back in
    const card = document.getElementById('verse-card');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';

    displayVerse(verse);
  });

  // ---- Back button ----
  backBtn.addEventListener('click', () => {
    showMoodScreen();
    // Clear pool so next visit to same mood starts fresh
    currentPool = [];
    currentMood = null;
    isRandom    = false;
  });

  // ---- Copy button ----
  copyBtn.addEventListener('click', copyVerse);

  // ---- Share button ----
  shareBtn.addEventListener('click', shareVerse);
}

// -----------------------------------------------------------
// 11. KICK OFF
// -----------------------------------------------------------
loadVerses();
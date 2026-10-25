const state = {
isReviewMode: false,
currentIndex: 0,
timeRemaining: 120 * 60,
timerId: null,
isPaused: false,
questions: [],
passages: {},
userAnswers: {} // Key: index (0-based), Value: 'A' | 'B' | 'C' | 'D'
};

// DOM Elements Registry
const DOM = {
appHeaderTitle: document.getElementById('appHeaderTitle'),
timerDisplay: document.getElementById('timerDisplay'),
btnPause: document.getElementById('btnPause'),
btnFullscreen: document.getElementById('btnFullscreen'),
btnSubmitTop: document.getElementById('btnSubmitTop'),

questionWorkspace: document.getElementById('questionWorkspace'),
questionScrollBody: document.getElementById('questionScrollBody'),
passageContainer: document.getElementById('passageContainer'),
passageText: document.getElementById('passageText'),
questionNumber: document.getElementById('questionNumber'),
topicTag: document.getElementById('topicTag'),
questionText: document.getElementById('questionText'),
optionsContainer: document.getElementById('optionsContainer'),

reviewDetails: document.getElementById('reviewDetails'),
userStatusText: document.getElementById('userStatusText'),
correctAnswerText: document.getElementById('correctAnswerText'),
explanationText: document.getElementById('explanationText'),

attemptActions: document.getElementById('attemptActions'),
reviewActions: document.getElementById('reviewActions'),
btnPrev: document.getElementById('btnPrev'),
btnNext: document.getElementById('btnNext'),
btnClear: document.getElementById('btnClear'),
btnSaveNext: document.getElementById('btnSaveNext'),

paletteGrid: document.getElementById('paletteGrid'),
paletteCount: document.getElementById('paletteCount'),
paletteLegend: document.getElementById('paletteLegend'),

startModal: document.getElementById('startModal'),
btnStartConfirmed: document.getElementById('btnStartConfirmed'),
submitModal: document.getElementById('submitModal'),
submitSummaryStats: document.getElementById('submitSummaryStats'),
btnCancelSubmit: document.getElementById('btnCancelSubmit'),
btnConfirmSubmit: document.getElementById('btnConfirmSubmit'),
resultModal: document.getElementById('resultModal'),
btnEnterReview: document.getElementById('btnEnterReview')
};

/* =========================================================================

Data Fetching (Direct GitHub Pages integration)
========================================================================= */
async function fetchExamFiles() {
try {
const [pRes, qRes] = await Promise.all([
fetch('passage.json').catch(() => null),
fetch('questions_2024.json').catch(() => null)
]);

if (pRes && pRes.ok) {
  const pData = await pRes.json();
  pData.forEach(p => { state.passages[p.passageid] = p.passage; });
}

if (qRes && qRes.ok) {
  state.questions = await qRes.json();
}


} catch (err) {
console.error('Failed to load local JSON files. Check relative file names on GitHub.', err);
}
}

/* =========================================================================
2. Timer Implementation
========================================================================= */
function startTimer() {
if (state.timerId) clearInterval(state.timerId);
renderTimer();

state.timerId = setInterval(() => {
if (!state.isPaused && state.timeRemaining > 0) {
state.timeRemaining--;
renderTimer();
if (state.timeRemaining <= 0) {
clearInterval(state.timerId);
executeSubmitScoring();
}
}
}, 1000);
}

function renderTimer() {
const h = String(Math.floor(state.timeRemaining / 3600)).padStart(2, '0');
const m = String(Math.floor((state.timeRemaining % 3600) / 60)).padStart(2, '0');
const s = String(state.timeRemaining % 60).padStart(2, '0');
DOM.timerDisplay.textContent = ${h}:${m}:${s};
}

/* =========================================================================
3. Fullscreen Controller
========================================================================= */
function toggleFullScreen() {
const doc = window.document;
const docEl = doc.documentElement;

const requestFull = docEl.requestFullscreen || docEl.webkitRequestFullScreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
const cancelFull = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;

if (!doc.fullscreenElement && !doc.webkitFullscreenElement && !doc.mozFullScreenElement && !doc.msFullscreenElement) {
if (requestFull) {
requestFull.call(docEl).catch(() => {});
}
DOM.btnFullscreen.textContent = 'Exit Fullscreen';
} else {
if (cancelFull) {
cancelFull.call(doc).catch(() => {});
}
DOM.btnFullscreen.textContent = 'Fullscreen';
}
}

/* =========================================================================
4. Question & Passage Rendering Engine
========================================================================= */
function renderQuestion(index) {
if (!state.questions || state.questions.length === 0) return;
state.currentIndex = index;
const q = state.questions[index];

// 1. Passage Rendering: Stacked ABOVE Question
if (q.passageid && state.passages[q.passageid]) {
DOM.passageContainer.style.display = 'block';
DOM.passageText.textContent = state.passages[q.passageid];
} else {
DOM.passageContainer.style.display = 'none';
}

// 2. Question Text & Numbering
DOM.questionNumber.textContent = Question ${index + 1} of ${state.questions.length};
DOM.questionText.textContent = q.question;

// 3. Topic Visibility Rule: STRICTLY hidden during attempt, visible only during review
if (state.isReviewMode && q.topic) {
DOM.topicTag.style.display = 'inline-block';
DOM.topicTag.textContent = q.topic;
} else {
DOM.topicTag.style.display = 'none';
}

// 4. Options
DOM.optionsContainer.innerHTML = '';
const letters = ['A', 'B', 'C', 'D'];
const userSelected = state.userAnswers[index];

q.options.forEach((optText, optIdx) => {
const letter = letters[optIdx];
const isSelected = userSelected === letter;

const row = document.createElement('div');
row.className = `option-row ${isSelected ? 'selected' : ''}`;

if (!state.isReviewMode) {
  row.onclick = () => {
    state.userAnswers[index] = letter;
    renderQuestion(index);
  };
} else {
  row.style.cursor = 'default';
}

const badge = document.createElement('div');
badge.className = 'option-letter-badge';
badge.textContent = letter;

const textSpan = document.createElement('div');
textSpan.className = 'option-text-body';
textSpan.textContent = optText;

row.appendChild(badge);
row.appendChild(textSpan);
DOM.optionsContainer.appendChild(row);


});

// 5. Review Explanation Box
if (state.isReviewMode) {
DOM.reviewDetails.style.display = 'block';
const hasAttempted = userSelected !== undefined;
const isCorrect = userSelected === q.answer;

DOM.reviewDetails.className = `review-panel ${
  !hasAttempted ? '' : (isCorrect ? 'correct' : 'wrong')
}`;

DOM.userStatusText.textContent = `Your Choice: ${hasAttempted ? `(${userSelected})` : 'Unattempted'}`;
DOM.userStatusText.className = `review-status ${hasAttempted ? (isCorrect ? 'text-green' : 'text-red') : ''}`;

DOM.correctAnswerText.textContent = `Official UPSC Key: (${q.answer})`;
DOM.correctAnswerText.className = 'review-key text-green';

DOM.explanationText.textContent = q.explanation || 'Official UPSC answer key verified.';


} else {
DOM.reviewDetails.style.display = 'none';
}

// Disable Prev on first question
DOM.btnPrev.disabled = (index === 0);

// Scroll back to top
DOM.questionScrollBody.scrollTop = 0;

renderPalette();
}

/* =========================================================================
5. Question Palette Logic & Strict Colour Codes
========================================================================= */
function updatePaletteLegend() {
if (!state.isReviewMode) {
DOM.paletteLegend.innerHTML = <strong>Status:</strong><br> Attempted: <span style="color: var(--exam-green); font-weight: bold;">Green</span> &bull;  Unattempted: <span>No Color</span>;
} else {
DOM.paletteLegend.innerHTML = <strong>Review Status:</strong><br> Correct: <span style="color: var(--exam-green); font-weight: bold;">Green</span> &bull;  Wrong: <span style="color: var(--exam-red); font-weight: bold;">Red</span> &bull;  Unattempted: <span>No Color</span>;
}
}

function renderPalette() {
DOM.paletteGrid.innerHTML = '';
let attemptedCount = 0;

state.questions.forEach((q, i) => {
const btn = document.createElement('button');
btn.type = 'button';
btn.className = 'palette-btn';
btn.textContent = i + 1;

if (i === state.currentIndex) {
  btn.classList.add('active');
}

const userAns = state.userAnswers[i];
const isAttempted = userAns !== undefined;
if (isAttempted) attemptedCount++;

if (!state.isReviewMode) {
  // Rule 1: Attempted = Green, Unattempted = No color
  if (isAttempted) {
    btn.classList.add('attempted');
  }
} else {
  // Rule 2: Review = Correct Green, Wrong Red, Unattempted No color
  if (isAttempted) {
    if (userAns === q.answer) {
      btn.classList.add('review-correct');
    } else {
      btn.classList.add('review-wrong');
    }
  }
}

btn.onclick = () => renderQuestion(i);
DOM.paletteGrid.appendChild(btn);


});

DOM.paletteCount.textContent = ${attemptedCount}/${state.questions.length} Attempted;
}

/* =========================================================================
6. Submission & UPSC Standard Scoring Calculation
========================================================================= */
function showSubmitModal() {
const attempted = Object.keys(state.userAnswers).length;
const unattempted = state.questions.length - attempted;
DOM.submitSummaryStats.textContent = Attempted: ${attempted} | Unattempted: ${unattempted};
DOM.submitModal.style.display = 'flex';
}

function executeSubmitScoring() {
DOM.submitModal.style.display = 'none';
if (state.timerId) clearInterval(state.timerId);

let correct = 0;
let wrong = 0;

state.questions.forEach((q, idx) => {
const userChoice = state.userAnswers[idx];
if (userChoice) {
if (userChoice === q.answer) correct++;
else wrong++;
}
});

const total = state.questions.length;
const unattempted = total - (correct + wrong);

// Standard UPSC CSAT Scoring: +2.5 for correct, -2.5/3 (-0.8333) for incorrect
const score = (correct * 2.5) - (wrong * (2.5 / 3));
const isQualified = score >= 66.0;

document.getElementById('resTotal').textContent = total;
document.getElementById('resAttempted').textContent = correct + wrong;
document.getElementById('resUnattempted').textContent = unattempted;
document.getElementById('resCorrect').textContent = correct;
document.getElementById('resWrong').textContent = wrong;
document.getElementById('resFinalScore').textContent = ${score.toFixed(2)} / 200;

const statusBadge = document.getElementById('resStatus');
statusBadge.textContent = isQualified ? "QUALIFIED (Score >= 66.00)" : "NOT QUALIFIED (Score < 66.00)";
statusBadge.style.color = isQualified ? "var(--exam-green)" : "var(--exam-red)";

DOM.resultModal.style.display = 'flex';
}

/* =========================================================================
7. Enter Review Mode
========================================================================= */
function enterReviewMode() {
DOM.resultModal.style.display = 'none';
state.isReviewMode = true;

// Header State
DOM.appHeaderTitle.textContent = "UPSC CSAT Review & Solutions";
DOM.timerDisplay.textContent = "Review Finished";
DOM.btnPause.style.display = 'none';
DOM.btnSubmitTop.style.display = 'none';

// Toggle Action Buttons
DOM.attemptActions.style.display = 'none';
DOM.reviewActions.style.display = 'flex';

updatePaletteLegend();
renderQuestion(0);
}

/* =========================================================================
8. Event Listeners & Bootstrapping
========================================================================= */
function attachEvents() {
DOM.btnFullscreen.addEventListener('click', toggleFullScreen);

DOM.btnPause.addEventListener('click', () => {
state.isPaused = !state.isPaused;
DOM.btnPause.textContent = state.isPaused ? 'Resume' : 'Pause';
DOM.btnPause.classList.toggle('btn-primary', state.isPaused);
});

DOM.btnSubmitTop.addEventListener('click', showSubmitModal);
DOM.btnCancelSubmit.addEventListener('click', () => {
DOM.submitModal.style.display = 'none';
});
DOM.btnConfirmSubmit.addEventListener('click', executeSubmitScoring);
DOM.btnEnterReview.addEventListener('click', enterReviewMode);

DOM.btnClear.addEventListener('click', () => {
if (state.isReviewMode) return;
delete state.userAnswers[state.currentIndex];
renderQuestion(state.currentIndex);
});

DOM.btnSaveNext.addEventListener('click', () => {
if (state.currentIndex < state.questions.length - 1) {
renderQuestion(state.currentIndex + 1);
}
});

DOM.btnNext.addEventListener('click', () => {
if (state.currentIndex < state.questions.length - 1) {
renderQuestion(state.currentIndex + 1);
}
});

DOM.btnPrev.addEventListener('click', () => {
if (state.currentIndex > 0) {
renderQuestion(state.currentIndex - 1);
}
});

DOM.btnStartConfirmed.addEventListener('click', () => {
const selectedMode = document.querySelector('input[name="testMode"]:checked').value;

if (selectedMode === 'mixed_20') {
  state.questions = state.questions.slice(0, 20);
  state.timeRemaining = 30 * 60;
} else if (selectedMode === 'mixed_40') {
  state.questions = state.questions.slice(0, 40);
  state.timeRemaining = 60 * 60;
} else {
  state.timeRemaining = 120 * 60;
}

DOM.startModal.style.display = 'none';
updatePaletteLegend();
renderQuestion(0);
startTimer();


});
}

window.addEventListener('DOMContentLoaded', async () => {
attachEvents();
await fetchExamFiles();
renderTimer();
});
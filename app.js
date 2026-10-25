// State Management
const state = {
  isReviewMode: false,
  currentIndex: 0,
  timeRemaining: 120 * 60,
  timerId: null,
  isPaused: false,
  questions: [],
  passages: {},
  userAnswers: {} // index -> 'A' | 'B' | 'C' | 'D'
};

// DOM References
const elements = {
  appHeaderTitle: document.getElementById('appHeaderTitle'),
  timerDisplay: document.getElementById('timerDisplay'),
  btnPause: document.getElementById('btnPause'),
  btnFullscreen: document.getElementById('btnFullscreen'),
  btnSubmitTop: document.getElementById('btnSubmitTop'),
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

// Data Fetching
async function loadTestData() {
  try {
    const [passRes, questRes] = await Promise.all([
      fetch('passage.json').catch(err => { console.warn('passage.json fetch failed:', err); return null; }),
      fetch('questions_2024.json').catch(err => { console.warn('questions_2024.json fetch failed:', err); return null; })
    ]);

    if (passRes && passRes.ok) {
      const passData = await passRes.json();
      passData.forEach(p => { state.passages[p.passageid] = p.passage; });
    }

    if (questRes && questRes.ok) {
      state.questions = await questRes.json();
    }
  } catch (err) {
    console.error('Error loading JSON data:', err);
  }
}

// Timer Functions
function startTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    if (!state.isPaused && state.timeRemaining > 0) {
      state.timeRemaining--;
      renderTimer();
      if (state.timeRemaining <= 0) {
        clearInterval(state.timerId);
        handleTestSubmit();
      }
    }
  }, 1000);
}

function renderTimer() {
  const h = String(Math.floor(state.timeRemaining / 3600)).padStart(2, '0');
  const m = String(Math.floor((state.timeRemaining % 3600) / 60)).padStart(2, '0');
  const s = String(state.timeRemaining % 60).padStart(2, '0');
  elements.timerDisplay.textContent = `${h}:${m}:${s}`;
}

// Fullscreen
function toggleFullScreen() {
  const doc = window.document;
  const docEl = doc.documentElement;

  const requestFull = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
  const cancelFull = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

  if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
    if (requestFull) requestFull.call(docEl).catch(() => {});
    elements.btnFullscreen.textContent = "Exit Fullscreen";
  } else {
    if (cancelFull) cancelFull.call(doc).catch(() => {});
    elements.btnFullscreen.textContent = "Fullscreen";
  }
}

// Question Rendering
function renderQuestion(index) {
  if (!state.questions || state.questions.length === 0) return;
  state.currentIndex = index;
  const q = state.questions[index];

  // 1. Passage Rendering (Above Question)
  if (q.passageid && state.passages[q.passageid]) {
    elements.passageContainer.style.display = 'block';
    elements.passageText.textContent = state.passages[q.passageid];
  } else {
    elements.passageContainer.style.display = 'none';
  }

  // 2. Question Text & Header
  elements.questionNumber.textContent = `Question ${index + 1} of ${state.questions.length}`;
  elements.questionText.textContent = q.question;

  // 3. Topic: Displayed strictly during Review Mode
  if (state.isReviewMode && q.topic) {
    elements.topicTag.style.display = 'inline-block';
    elements.topicTag.textContent = q.topic;
  } else {
    elements.topicTag.style.display = 'none';
  }

  // 4. Options
  elements.optionsContainer.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];
  const currentSelected = state.userAnswers[index];

  q.options.forEach((optText, i) => {
    const letter = letters[i];
    const label = document.createElement('label');
    label.className = `option-item ${currentSelected === letter ? 'selected' : ''}`;

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = `opt_q${index}`;
    input.value = letter;
    input.checked = currentSelected === letter;
    input.disabled = state.isReviewMode;

    if (!state.isReviewMode) {
      label.addEventListener('click', () => {
        state.userAnswers[index] = letter;
        renderQuestion(index);
      });
    }

    const span = document.createElement('span');
    span.textContent = `(${letter}) ${optText}`;

    label.appendChild(input);
    label.appendChild(span);
    elements.optionsContainer.appendChild(label);
  });

  // 5. Review Info Box
  if (state.isReviewMode) {
    elements.reviewDetails.style.display = 'block';
    const isAnswered = currentSelected !== undefined;
    const isCorrect = currentSelected === q.answer;

    elements.reviewDetails.className = `review-box ${
      !isAnswered ? '' : (isCorrect ? 'review-correct' : 'review-wrong')
    }`;

    elements.userStatusText.textContent = `Your Answer: ${currentSelected ? `(${currentSelected})` : 'Unattempted'}`;
    elements.userStatusText.style.color = isCorrect ? 'var(--green-attempted)' : (isAnswered ? 'var(--red-wrong)' : 'var(--text-muted)');

    elements.correctAnswerText.textContent = `Official UPSC Key: (${q.answer})`;
    elements.correctAnswerText.style.color = 'var(--green-attempted)';

    elements.explanationText.textContent = q.explanation || 'No explanation provided.';
  } else {
    elements.reviewDetails.style.display = 'none';
  }

  renderPalette();
}

// Palette Rendering
function renderPalette() {
  elements.paletteGrid.innerHTML = '';
  let attemptedCount = 0;

  state.questions.forEach((q, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'q-btn';
    btn.textContent = i + 1;

    if (i === state.currentIndex) {
      btn.classList.add('active');
    }

    const userAns = state.userAnswers[i];
    const isAttempted = userAns !== undefined;
    if (isAttempted) attemptedCount++;

    if (!state.isReviewMode) {
      // Rule: Attempted Green, Unattempted no color
      if (isAttempted) {
        btn.classList.add('attempted');
      }
    } else {
      // Rule: Review -> Correct Green, Wrong Red, Unattempted no color
      if (isAttempted) {
        if (userAns === q.answer) {
          btn.classList.add('rev-correct');
        } else {
          btn.classList.add('rev-wrong');
        }
      }
    }

    btn.addEventListener('click', () => {
      renderQuestion(i);
    });

    elements.paletteGrid.appendChild(btn);
  });

  elements.paletteCount.textContent = `${attemptedCount}/${state.questions.length}`;
}

// Clear Response
function clearResponse() {
  if (state.isReviewMode) return;
  delete state.userAnswers[state.currentIndex];
  renderQuestion(state.currentIndex);
}

// Submission and Scoring
function showSubmitConfirmation() {
  const attempted = Object.keys(state.userAnswers).length;
  const unattempted = state.questions.length - attempted;
  elements.submitSummaryStats.textContent = `Attempted: ${attempted} | Unattempted: ${unattempted}`;
  elements.submitModal.style.display = 'flex';
}

function handleTestSubmit() {
  elements.submitModal.style.display = 'none';
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
  const score = (correct * 2.5) - (wrong * (2.5 / 3));
  const isQualified = score >= 66.0;

  document.getElementById('resTotal').textContent = total;
  document.getElementById('resAttempted').textContent = correct + wrong;
  document.getElementById('resUnattempted').textContent = unattempted;
  document.getElementById('resCorrect').textContent = correct;
  document.getElementById('resWrong').textContent = wrong;
  document.getElementById('resFinalScore').textContent = `${score.toFixed(2)} / 200`;

  const statusEl = document.getElementById('resStatus');
  statusEl.textContent = isQualified ? "QUALIFIED" : "NOT QUALIFIED";
  statusEl.style.color = isQualified ? "var(--green-attempted)" : "var(--red-wrong)";

  elements.resultModal.style.display = 'flex';
}

function enterReviewMode() {
  elements.resultModal.style.display = 'none';
  state.isReviewMode = true;

  elements.appHeaderTitle.textContent = "UPSC CSAT Review Mode";
  elements.timerDisplay.textContent = "Review Mode";
  elements.btnPause.style.display = 'none';
  elements.btnSubmitTop.style.display = 'none';

  // Toggle button bars
  elements.attemptActions.style.display = 'none';
  elements.reviewActions.style.display = 'flex';

  // Update Legend
  elements.paletteLegend.innerHTML = `
    <strong>Review Status:</strong><br>
    Correct: <span style="color: var(--green-attempted); font-weight: bold;">Green</span> | 
    Wrong: <span style="color: var(--red-wrong); font-weight: bold;">Red</span> | 
    Unattempted: <span>No Color</span>
  `;

  renderQuestion(0);
}

// Event Listeners
function setupEventListeners() {
  elements.btnFullscreen.addEventListener('click', toggleFullScreen);

  elements.btnPause.addEventListener('click', () => {
    state.isPaused = !state.isPaused;
    elements.btnPause.textContent = state.isPaused ? "Resume" : "Pause";
    elements.btnPause.classList.toggle('btn-primary', state.isPaused);
  });

  elements.btnSubmitTop.addEventListener('click', showSubmitConfirmation);
  elements.btnCancelSubmit.addEventListener('click', () => {
    elements.submitModal.style.display = 'none';
  });
  elements.btnConfirmSubmit.addEventListener('click', handleTestSubmit);
  elements.btnEnterReview.addEventListener('click', enterReviewMode);

  elements.btnClear.addEventListener('click', clearResponse);

  elements.btnSaveNext.addEventListener('click', () => {
    if (state.currentIndex < state.questions.length - 1) {
      renderQuestion(state.currentIndex + 1);
    }
  });

  elements.btnNext.addEventListener('click', () => {
    if (state.currentIndex < state.questions.length - 1) {
      renderQuestion(state.currentIndex + 1);
    }
  });

  elements.btnPrev.addEventListener('click', () => {
    if (state.currentIndex > 0) {
      renderQuestion(state.currentIndex - 1);
    }
  });

  elements.btnStartConfirmed.addEventListener('click', () => {
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

    elements.startModal.style.display = 'none';
    renderQuestion(0);
    startTimer();
  });
}

// Initialization
async function init() {
  setupEventListeners();
  await loadTestData();
  renderTimer();
}

window.addEventListener('DOMContentLoaded', init);

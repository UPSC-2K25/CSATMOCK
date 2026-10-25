// State Management
const state = {
  isReviewMode: false,
  currentIndex: 0,
  timeRemaining: 120 * 60,
  timerId: null,
  isPaused: false,
  allQuestions: [],     // Master bank from JSON
  activeQuestions: [],  // Currently loaded mock subset
  passages: {},         // passageid -> text
  userAnswers: {}       // currentIndex -> 'A' | 'B' | 'C' | 'D'
};

// DOM References
const elements = {
  appHeaderTitle: document.getElementById('appHeaderTitle'),
  timerDisplay: document.getElementById('timerDisplay'),
  btnPause: document.getElementById('btnPause'),
  btnFullscreen: document.getElementById('btnFullscreen'),
  btnSubmitTop: document.getElementById('btnSubmitTop'),
  btnRetakeTop: document.getElementById('btnRetakeTop'),
  btnRetakeBottom: document.getElementById('btnRetakeBottom'),
  passageContainer: document.getElementById('passageContainer'),
  passageText: document.getElementById('passageText'),
  questionNumber: document.getElementById('questionNumber'),
  reviewMetaGroup: document.getElementById('reviewMetaGroup'),
  topicTag: document.getElementById('topicTag'),
  sourceTag: document.getElementById('sourceTag'),
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
  selectedYear: document.getElementById('selectedYear'),
  yearSelectorGroup: document.getElementById('yearSelectorGroup'),
  numQuestionsInput: document.getElementById('numQuestionsInput'),
  qCountLimits: document.getElementById('qCountLimits'),
  timerEstimateHint: document.getElementById('timerEstimateHint'),
  btnStartConfirmed: document.getElementById('btnStartConfirmed'),
  submitModal: document.getElementById('submitModal'),
  submitSummaryStats: document.getElementById('submitSummaryStats'),
  btnCancelSubmit: document.getElementById('btnCancelSubmit'),
  btnConfirmSubmit: document.getElementById('btnConfirmSubmit'),
  resultModal: document.getElementById('resultModal'),
  btnEnterReview: document.getElementById('btnEnterReview')
};

// Load Passages and Questions (supports 2024, expandable to 2023, 2022, etc.)
async function loadTestData() {
  try {
    const [passRes, quest2024Res] = await Promise.all([
      fetch('passage.json').catch(e => { console.warn('passage.json load error', e); return null; }),
      fetch('questions_2024.json').catch(e => { console.warn('questions_2024.json load error', e); return null; })
    ]);

    if (passRes && passRes.ok) {
      const pData = await passRes.json();
      pData.forEach(p => { state.passages[p.passageid] = p.passage; });
    }

    if (quest2024Res && quest2024Res.ok) {
      const q2024 = await quest2024Res.json();
      state.allQuestions = [...state.allQuestions, ...q2024];
    }
  } catch (err) {
    console.error('Data initialization failure:', err);
  }
}

// Timer Logic (UPSC Standard: 90 seconds per question)
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
  const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
  const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

  if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
    if (req) req.call(docEl).catch(() => {});
    elements.btnFullscreen.textContent = "Exit Fullscreen";
  } else {
    if (exit) exit.call(doc).catch(() => {});
    elements.btnFullscreen.textContent = "Fullscreen";
  }
}

// Render Question
function renderQuestion(index) {
  if (!state.activeQuestions || state.activeQuestions.length === 0) return;
  state.currentIndex = index;
  const q = state.activeQuestions[index];

  // 1. Passage Rendering (Rendered above question with internal scroll)
  if (q.passageid && state.passages[q.passageid]) {
    elements.passageContainer.style.display = 'flex';
    elements.passageText.textContent = state.passages[q.passageid];
    elements.passageText.scrollTop = 0; // Reset scroll to top
  } else {
    elements.passageContainer.style.display = 'none';
  }

  // 2. Question Number & Metadata
  elements.questionNumber.textContent = `Question ${index + 1} of ${state.activeQuestions.length}`;
  elements.questionText.textContent = q.question;

  // 3. Topic & Year/QNo: Strictly shown only during Review
  if (state.isReviewMode) {
    elements.reviewMetaGroup.style.display = 'flex';
    elements.topicTag.textContent = q.topic || 'General Aptitude';
    elements.sourceTag.textContent = `Year: ${q.year || '2024'} | PYQ QNo: ${q.qno || (index + 1)}`;
  } else {
    elements.reviewMetaGroup.style.display = 'none';
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

  // 5. Review Explanation Box
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

// Right-Hand Question Palette
function renderPalette() {
  elements.paletteGrid.innerHTML = '';
  let attemptedCount = 0;

  state.activeQuestions.forEach((q, i) => {
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
      if (isAttempted) btn.classList.add('attempted');
    } else {
      // Rule: Review -> Correct Green, Wrong Red, Unattempted no color
      if (isAttempted) {
        if (userAns === q.answer) btn.classList.add('rev-correct');
        else btn.classList.add('rev-wrong');
      }
    }

    btn.addEventListener('click', () => {
      renderQuestion(i);
    });

    elements.paletteGrid.appendChild(btn);
  });

  elements.paletteCount.textContent = `${attemptedCount}/${state.activeQuestions.length}`;
}

// Clear Response
function clearResponse() {
  if (state.isReviewMode) return;
  delete state.userAnswers[state.currentIndex];
  renderQuestion(state.currentIndex);
}

// Submit Test & Calculate UPSC CSAT Scores
function showSubmitConfirmation() {
  const attempted = Object.keys(state.userAnswers).length;
  const unattempted = state.activeQuestions.length - attempted;
  elements.submitSummaryStats.textContent = `Attempted: ${attempted} | Unattempted: ${unattempted}`;
  elements.submitModal.style.display = 'flex';
}

function handleTestSubmit() {
  elements.submitModal.style.display = 'none';
  if (state.timerId) clearInterval(state.timerId);

  let correct = 0;
  let wrong = 0;

  state.activeQuestions.forEach((q, idx) => {
    const userChoice = state.userAnswers[idx];
    if (userChoice) {
      if (userChoice === q.answer) correct++;
      else wrong++;
    }
  });

  const total = state.activeQuestions.length;
  const unattempted = total - (correct + wrong);
  const score = (correct * 2.5) - (wrong * (2.5 / 3));
  const maxPossible = total * 2.5;
  const passThreshold = maxPossible * 0.33; // 33% qualifying
  const isQualified = score >= passThreshold;

  document.getElementById('resTotal').textContent = total;
  document.getElementById('resAttempted').textContent = correct + wrong;
  document.getElementById('resUnattempted').textContent = unattempted;
  document.getElementById('resCorrect').textContent = correct;
  document.getElementById('resWrong').textContent = wrong;
  document.getElementById('resFinalScore').textContent = `${score.toFixed(2)} / ${maxPossible.toFixed(1)}`;

  const statusEl = document.getElementById('resStatus');
  statusEl.textContent = isQualified ? "QUALIFIED (≥ 33%)" : "NOT QUALIFIED (< 33%)";
  statusEl.style.color = isQualified ? "var(--green-attempted)" : "var(--red-wrong)";

  elements.resultModal.style.display = 'flex';
}

// Enter Review Mode
function enterReviewMode() {
  elements.resultModal.style.display = 'none';
  state.isReviewMode = true;

  elements.appHeaderTitle.textContent = "UPSC CSAT Review Mode";
  elements.timerDisplay.textContent = "Review Mode";
  elements.btnPause.style.display = 'none';
  elements.btnSubmitTop.style.display = 'none';
  elements.btnRetakeTop.style.display = 'inline-block';

  elements.attemptActions.style.display = 'none';
  elements.reviewActions.style.display = 'flex';

  elements.paletteLegend.innerHTML = `
    <strong>Review Status:</strong><br>
    Correct: <span style="color: var(--green-attempted); font-weight: bold;">Green</span> | 
    Wrong: <span style="color: var(--red-wrong); font-weight: bold;">Red</span> | 
    Unattempted: <span>No Color</span>
  `;

  renderQuestion(0);
}

// Retake / Reset Test
function resetToStartModal() {
  if (state.timerId) clearInterval(state.timerId);

  // Reset State
  state.isReviewMode = false;
  state.currentIndex = 0;
  state.isPaused = false;
  state.userAnswers = {};

  // Reset UI Controls
  elements.appHeaderTitle.textContent = "UPSC CSAT Mock Test Engine";
  elements.btnPause.style.display = 'inline-block';
  elements.btnPause.textContent = "Pause";
  elements.btnSubmitTop.style.display = 'inline-block';
  elements.btnRetakeTop.style.display = 'none';

  elements.attemptActions.style.display = 'flex';
  elements.reviewActions.style.display = 'none';
  elements.reviewDetails.style.display = 'none';
  elements.reviewMetaGroup.style.display = 'none';

  elements.paletteLegend.innerHTML = `
    <strong>Status:</strong><br>
    Attempted: <span class="legend-attempted">Green</span> | Unattempted: <span>No Color</span>
  `;

  // Open config modal
  elements.resultModal.style.display = 'none';
  elements.submitModal.style.display = 'none';
  elements.startModal.style.display = 'flex';
}

// Modal Form Updates (Dynamic Time Calculation)
function updateConfigLimits() {
  const mode = document.querySelector('input[name="mockMode"]:checked').value;
  let availablePool = state.allQuestions;

  if (mode === 'yearwise') {
    elements.yearSelectorGroup.style.display = 'block';
    const yr = parseInt(elements.selectedYear.value, 10);
    availablePool = state.allQuestions.filter(q => q.year === yr);
  } else {
    elements.yearSelectorGroup.style.display = 'none';
  }

  const maxQ = Math.max(1, Math.min(80, availablePool.length || 80));
  elements.qCountLimits.textContent = `1 - ${maxQ}`;
  elements.numQuestionsInput.max = maxQ;

  let currentVal = parseInt(elements.numQuestionsInput.value, 10);
  if (isNaN(currentVal) || currentVal < 1) currentVal = maxQ;
  if (currentVal > maxQ) currentVal = maxQ;
  elements.numQuestionsInput.value = currentVal;

  // 90s (1.5 min) per question
  const totalSeconds = currentVal * 90;
  const mins = Math.floor(totalSeconds / 60);
  elements.timerEstimateHint.textContent = `Calculated duration: ${mins} minutes (90s / question)`;
}

// Attach Event Handlers
function setupEventListeners() {
  elements.btnFullscreen.addEventListener('click', toggleFullScreen);

  elements.btnPause.addEventListener('click', () => {
    state.isPaused = !state.isPaused;
    elements.btnPause.textContent = state.isPaused ? "Resume" : "Pause";
  });

  elements.btnSubmitTop.addEventListener('click', showSubmitConfirmation);
  elements.btnCancelSubmit.addEventListener('click', () => {
    elements.submitModal.style.display = 'none';
  });
  elements.btnConfirmSubmit.addEventListener('click', handleTestSubmit);
  elements.btnEnterReview.addEventListener('click', enterReviewMode);

  // Retake handlers
  elements.btnRetakeTop.addEventListener('click', resetToStartModal);
  elements.btnRetakeBottom.addEventListener('click', resetToStartModal);

  elements.btnClear.addEventListener('click', clearResponse);

  elements.btnSaveNext.addEventListener('click', () => {
    if (state.currentIndex < state.activeQuestions.length - 1) {
      renderQuestion(state.currentIndex + 1);
    }
  });

  elements.btnNext.addEventListener('click', () => {
    if (state.currentIndex < state.activeQuestions.length - 1) {
      renderQuestion(state.currentIndex + 1);
    }
  });

  elements.btnPrev.addEventListener('click', () => {
    if (state.currentIndex > 0) {
      renderQuestion(state.currentIndex - 1);
    }
  });

  // Modal interaction listeners
  document.querySelectorAll('input[name="mockMode"]').forEach(radio => {
    radio.addEventListener('change', updateConfigLimits);
  });
  elements.selectedYear.addEventListener('change', updateConfigLimits);
  elements.numQuestionsInput.addEventListener('input', updateConfigLimits);

  // Start Exam Confirmed
  elements.btnStartConfirmed.addEventListener('click', () => {
    const mode = document.querySelector('input[name="mockMode"]:checked').value;
    let pool = [...state.allQuestions];

    if (mode === 'yearwise') {
      const yr = parseInt(elements.selectedYear.value, 10);
      pool = pool.filter(q => q.year === yr);
    } else {
      // Custom mock across all years: shuffle pool
      pool.sort(() => Math.random() - 0.5);
    }

    const requestedCount = parseInt(elements.numQuestionsInput.value, 10) || 80;
    const actualCount = Math.min(requestedCount, pool.length);

    state.activeQuestions = pool.slice(0, actualCount);

    // UPSC CSAT Standard Time: 90 seconds (1.5 minutes) per question
    state.timeRemaining = actualCount * 90;

    elements.startModal.style.display = 'none';
    renderQuestion(0);
    startTimer();
  });
}

// Initialization
async function init() {
  setupEventListeners();
  await loadTestData();
  updateConfigLimits();
}

window.addEventListener('DOMContentLoaded', init);

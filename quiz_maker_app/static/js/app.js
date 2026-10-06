// ==========================================================================
// QUIZ CRAFT - High Interaction Faculty & Student Quiz Platform
// Audio Synthesizer, Real-Time Assessment, and Dynamic Dashboards
// ==========================================================================

const AppState = {
  user: null,
  activeView: 'auth',
  audioEnabled: true,
  // Faculty state
  facultyQuizzes: [],
  facultyActiveQuizId: null,
  facultyQuestions: [],
  facultySubmissions: [],
  facultyAnalytics: null,
  // Student state
  studentQuizzes: [],
  currentQuiz: null,
  currentQuestions: [],
  currentQuestionIndex: 0,
  studentAnswers: {}, // { [questionId]: "A" }
  quizTimerInterval: null,
  timeRemainingSeconds: 0,
  timeTotalSeconds: 0,
  quizStartTime: null,
  studentHistory: []
};

// --------------------------------------------------------------------------
// 1. Synthesizer Audio Engine (Zero external dependencies)
// --------------------------------------------------------------------------
class SoundEffects {
  constructor() {
    this.ctx = null;
    this.init();
  }

  init() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    } catch (e) {
      console.warn("AudioContext not supported", e);
    }
  }

  ensureContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, duration = 0.1, type = 'sine', gainVal = 0.15) {
    if (!AppState.audioEnabled || !this.ctx) return;
    this.ensureContext();

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  click() {
    this.playTone(800, 0.05, 'triangle', 0.08);
  }

  select() {
    this.playTone(550, 0.08, 'sine', 0.12);
    setTimeout(() => this.playTone(720, 0.09, 'sine', 0.12), 40);
  }

  success() {
    if (!AppState.audioEnabled || !this.ctx) return;
    this.ensureContext();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, High C
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 0.18, 'triangle', 0.15), idx * 75);
    });
  }

  fanfare() {
    if (!AppState.audioEnabled || !this.ctx) return;
    this.ensureContext();
    const chords = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    chords.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 0.35, 'triangle', 0.18), idx * 100);
    });
  }

  warning() {
    this.playTone(320, 0.18, 'sawtooth', 0.15);
    setTimeout(() => this.playTone(280, 0.22, 'sawtooth', 0.15), 180);
  }

  tick() {
    this.playTone(1000, 0.02, 'square', 0.04);
  }
}

const SFX = new SoundEffects();

// --------------------------------------------------------------------------
// 2. Notification Toast System
// --------------------------------------------------------------------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgClasses = {
    success: 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200',
    error: 'bg-rose-950/90 border-rose-500/50 text-rose-200',
    info: 'bg-indigo-950/90 border-indigo-500/50 text-indigo-200',
    warning: 'bg-amber-950/90 border-amber-500/50 text-amber-200'
  }[type] || 'bg-slate-900 border-slate-700 text-slate-200';

  const icons = {
    success: `<i data-lucide="check-circle" class="w-5 h-5 text-emerald-400"></i>`,
    error: `<i data-lucide="alert-circle" class="w-5 h-5 text-rose-400"></i>`,
    info: `<i data-lucide="info" class="w-5 h-5 text-indigo-400"></i>`,
    warning: `<i data-lucide="alert-triangle" class="w-5 h-5 text-amber-400"></i>`
  }[type] || '';

  toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md fade-in transition-all duration-300 ${bgClasses}`;
  toast.innerHTML = `
    ${icons}
    <span class="text-sm font-medium">${message}</span>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --------------------------------------------------------------------------
// 3. API Communication Helper
// --------------------------------------------------------------------------
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(endpoint, options);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

// --------------------------------------------------------------------------
// 4. Initialization & Session Check
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  setupEventListeners();

  // Load audio preference
  const savedAudio = localStorage.getItem('quizcraft_audio');
  if (savedAudio !== null) {
    AppState.audioEnabled = savedAudio === 'true';
    updateAudioToggleButton();
  }

  // Check current session
  try {
    const data = await apiCall('/api/auth/me');
    if (data.logged_in) {
      AppState.user = data.user;
      renderAppHeader();
      if (data.user.role === 'faculty') {
        loadFacultyDashboard();
      } else {
        loadStudentDashboard();
      }
    } else {
      switchView('auth');
    }
  } catch (e) {
    switchView('auth');
  }
});

// --------------------------------------------------------------------------
// 5. Audio Toggle
// --------------------------------------------------------------------------
function updateAudioToggleButton() {
  const btn = document.getElementById('audio-toggle-btn');
  if (!btn) return;
  if (AppState.audioEnabled) {
    btn.innerHTML = `<i data-lucide="volume-2" class="w-5 h-5 text-indigo-400"></i>`;
    btn.title = "Mute Sound Effects";
  } else {
    btn.innerHTML = `<i data-lucide="volume-x" class="w-5 h-5 text-slate-500"></i>`;
    btn.title = "Enable Sound Effects";
  }
  lucide.createIcons();
}

function toggleAudio() {
  AppState.audioEnabled = !AppState.audioEnabled;
  localStorage.setItem('quizcraft_audio', AppState.audioEnabled);
  updateAudioToggleButton();
  if (AppState.audioEnabled) {
    SFX.click();
    showToast("Sound effects enabled", "info");
  } else {
    showToast("Sound effects muted", "info");
  }
}

// --------------------------------------------------------------------------
// 6. View Switcher
// --------------------------------------------------------------------------
function switchView(viewName) {
  AppState.activeView = viewName;
  const views = [
    'auth-view',
    'faculty-view',
    'student-view',
    'quiz-arena-view',
    'quiz-scorecard-view'
  ];

  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const activeEl = document.getElementById(`${viewName}-view`);
  if (activeEl) {
    activeEl.classList.remove('hidden');
    activeEl.classList.add('fade-in');
  }

  renderAppHeader();
  lucide.createIcons();
}

function renderAppHeader() {
  const userSection = document.getElementById('nav-user-section');
  if (!userSection) return;

  if (AppState.user) {
    const isFaculty = AppState.user.role === 'faculty';
    const roleBadge = isFaculty 
      ? `<span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">Faculty</span>`
      : `<span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Student</span>`;

    userSection.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="text-right hidden sm:block">
          <div class="text-sm font-bold text-slate-200 flex items-center gap-2 justify-end">
            ${AppState.user.display_name}
            ${roleBadge}
          </div>
          <div class="text-xs text-slate-400 font-mono">ID: ${AppState.user.login_id}</div>
        </div>
        <button onclick="handleLogout()" class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-rose-900/40 hover:border-rose-700/50 border border-slate-700 transition-all flex items-center gap-1.5">
          <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
          <span>Logout</span>
        </button>
      </div>
    `;
  } else {
    userSection.innerHTML = ``;
  }
  lucide.createIcons();
}

// --------------------------------------------------------------------------
// 7. Authentication Handling (Direct Login ID & Password only)
// --------------------------------------------------------------------------
let authMode = 'login'; // 'login' or 'register'
let authSelectedRole = 'student'; // 'student' or 'faculty'

function setAuthMode(mode) {
  authMode = mode;
  SFX.click();

  const tabLogin = document.getElementById('auth-tab-login');
  const tabRegister = document.getElementById('auth-tab-register');
  const submitBtn = document.getElementById('auth-submit-btn');
  const displayNameGroup = document.getElementById('auth-display-name-group');

  if (mode === 'login') {
    tabLogin.className = "flex-1 py-2 text-center text-sm font-semibold rounded-lg bg-indigo-600 text-white shadow-sm transition";
    tabRegister.className = "flex-1 py-2 text-center text-sm font-semibold rounded-lg text-slate-400 hover:text-white transition";
    submitBtn.innerText = `Sign In as ${authSelectedRole === 'faculty' ? 'Faculty' : 'Student'}`;
    displayNameGroup.classList.add('hidden');
  } else {
    tabRegister.className = "flex-1 py-2 text-center text-sm font-semibold rounded-lg bg-indigo-600 text-white shadow-sm transition";
    tabLogin.className = "flex-1 py-2 text-center text-sm font-semibold rounded-lg text-slate-400 hover:text-white transition";
    submitBtn.innerText = `Create ${authSelectedRole === 'faculty' ? 'Faculty' : 'Student'} Account`;
    displayNameGroup.classList.remove('hidden');
  }
}

function setAuthRole(role) {
  authSelectedRole = role;
  SFX.click();

  const roleFacultyBtn = document.getElementById('role-btn-faculty');
  const roleStudentBtn = document.getElementById('role-btn-student');
  const submitBtn = document.getElementById('auth-submit-btn');

  if (role === 'faculty') {
    roleFacultyBtn.className = "flex-1 py-2.5 px-3 rounded-xl border-2 border-violet-500 bg-violet-500/20 text-white font-semibold flex items-center justify-center gap-2 shadow-lg transition";
    roleStudentBtn.className = "flex-1 py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200 font-medium flex items-center justify-center gap-2 transition";
  } else {
    roleStudentBtn.className = "flex-1 py-2.5 px-3 rounded-xl border-2 border-emerald-500 bg-emerald-500/20 text-white font-semibold flex items-center justify-center gap-2 shadow-lg transition";
    roleFacultyBtn.className = "flex-1 py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200 font-medium flex items-center justify-center gap-2 transition";
  }

  if (authMode === 'login') {
    submitBtn.innerText = `Sign In as ${role === 'faculty' ? 'Faculty' : 'Student'}`;
  } else {
    submitBtn.innerText = `Create ${role === 'faculty' ? 'Faculty' : 'Student'} Account`;
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  SFX.click();

  const loginIdInput = document.getElementById('auth-login-id');
  const passwordInput = document.getElementById('auth-password');
  const displayNameInput = document.getElementById('auth-display-name');

  const login_id = loginIdInput.value.trim();
  const password = passwordInput.value.trim();
  const display_name = displayNameInput ? displayNameInput.value.trim() : '';

  if (!login_id || !password) {
    showToast("Please provide both Login ID and Password", "warning");
    SFX.warning();
    return;
  }

  try {
    let res;
    if (authMode === 'login') {
      res = await apiCall('/api/auth/login', 'POST', {
        login_id,
        password,
        role: authSelectedRole
      });
      showToast(`Welcome back, ${res.user.display_name}!`, "success");
    } else {
      res = await apiCall('/api/auth/register', 'POST', {
        login_id,
        password,
        role: authSelectedRole,
        display_name: display_name || login_id
      });
      showToast(`Account registered successfully as ${authSelectedRole}!`, "success");
    }

    SFX.success();
    AppState.user = res.user;
    renderAppHeader();

    // Reset fields
    loginIdInput.value = '';
    passwordInput.value = '';
    if (displayNameInput) displayNameInput.value = '';

    if (AppState.user.role === 'faculty') {
      loadFacultyDashboard();
    } else {
      loadStudentDashboard();
    }
  } catch (err) {
    SFX.warning();
  }
}

// Quick demo login helpers
async function demoLogin(loginId, password, role) {
  SFX.click();
  try {
    const res = await apiCall('/api/auth/login', 'POST', {
      login_id: loginId,
      password: password,
      role: role
    });
    showToast(`Logged in as ${res.user.display_name}!`, "success");
    SFX.success();
    AppState.user = res.user;
    renderAppHeader();

    if (role === 'faculty') {
      loadFacultyDashboard();
    } else {
      loadStudentDashboard();
    }
  } catch (err) {
    SFX.warning();
  }
}

async function handleLogout() {
  SFX.click();
  try {
    await apiCall('/api/auth/logout', 'POST');
    AppState.user = null;
    showToast("Logged out successfully", "info");
    switchView('auth');
  } catch (err) {}
}

// --------------------------------------------------------------------------
// 8. FACULTY DASHBOARD IMPLEMENTATION
// --------------------------------------------------------------------------
let facultyActiveTab = 'quizzes'; // 'quizzes' or 'results'

async function loadFacultyDashboard() {
  switchView('faculty');
  switchFacultyTab(facultyActiveTab);
  await refreshFacultyQuizzes();
  await refreshFacultyAnalytics();
}

function switchFacultyTab(tab) {
  facultyActiveTab = tab;
  SFX.click();

  const tabQuizzes = document.getElementById('faculty-tab-quizzes');
  const tabResults = document.getElementById('faculty-tab-results');
  const sectionQuizzes = document.getElementById('faculty-section-quizzes');
  const sectionResults = document.getElementById('faculty-section-results');

  if (tab === 'quizzes') {
    tabQuizzes.className = "px-4 py-2 text-sm font-semibold rounded-lg bg-violet-600 text-white shadow transition flex items-center gap-2";
    tabResults.className = "px-4 py-2 text-sm font-semibold rounded-lg text-slate-400 hover:text-white transition flex items-center gap-2";
    sectionQuizzes.classList.remove('hidden');
    sectionResults.classList.add('hidden');
    refreshFacultyQuizzes();
  } else {
    tabResults.className = "px-4 py-2 text-sm font-semibold rounded-lg bg-violet-600 text-white shadow transition flex items-center gap-2";
    tabQuizzes.className = "px-4 py-2 text-sm font-semibold rounded-lg text-slate-400 hover:text-white transition flex items-center gap-2";
    sectionResults.classList.remove('hidden');
    sectionQuizzes.classList.add('hidden');
    refreshFacultyResults();
  }
  lucide.createIcons();
}

async function refreshFacultyQuizzes() {
  try {
    const data = await apiCall('/api/faculty/quizzes');
    AppState.facultyQuizzes = data.quizzes || [];
    renderFacultyQuizzesList();
  } catch (err) {}
}

async function refreshFacultyAnalytics() {
  try {
    const data = await apiCall('/api/faculty/results');
    AppState.facultyAnalytics = data.analytics;
    renderFacultyKPIs();
  } catch (err) {}
}

function renderFacultyKPIs() {
  const kpiQuizzes = document.getElementById('kpi-total-quizzes');
  const kpiSubmissions = document.getElementById('kpi-total-submissions');
  const kpiAvg = document.getElementById('kpi-avg-score');
  const kpiPassRate = document.getElementById('kpi-pass-rate');

  if (kpiQuizzes) kpiQuizzes.innerText = AppState.facultyQuizzes.length;

  if (AppState.facultyAnalytics) {
    if (kpiSubmissions) kpiSubmissions.innerText = AppState.facultyAnalytics.total_submissions;
    if (kpiAvg) kpiAvg.innerText = `${AppState.facultyAnalytics.avg_percentage}%`;
    if (kpiPassRate) kpiPassRate.innerText = `${AppState.facultyAnalytics.pass_rate}%`;
  }
}

function renderFacultyQuizzesList() {
  const container = document.getElementById('faculty-quizzes-grid');
  if (!container) return;

  if (AppState.facultyQuizzes.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center glass-card rounded-2xl border border-slate-800">
        <i data-lucide="book-open" class="w-12 h-12 text-slate-600 mx-auto mb-3"></i>
        <h4 class="text-lg font-bold text-slate-300">No quizzes created yet</h4>
        <p class="text-sm text-slate-500 max-w-md mx-auto mb-5">Create your first interactive quiz with custom questions, time limits, and auto-grading.</p>
        <button onclick="openCreateQuizModal()" class="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm inline-flex items-center gap-2 shadow-lg transition">
          <i data-lucide="plus" class="w-4 h-4"></i> Create First Quiz
        </button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = AppState.facultyQuizzes.map(quiz => {
    const isActive = quiz.is_active === 1;
    const avgScoreDisplay = quiz.avg_score !== null ? `${Math.round(quiz.avg_score)}%` : 'No attempts';

    return `
      <div class="glass-card rounded-2xl p-6 border border-slate-800/80 hover:border-violet-500/40 transition-all flex flex-col justify-between group">
        <div>
          <div class="flex items-start justify-between gap-3 mb-3">
            <span class="px-2.5 py-1 text-xs font-semibold rounded-lg ${isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700/40 text-slate-400 border border-slate-700'}">
              ${isActive ? 'Active for Students' : 'Closed / Inactive'}
            </span>
            <div class="flex items-center gap-1.5">
              <button onclick="toggleQuizActive(${quiz.id}, ${isActive ? 0 : 1})" title="${isActive ? 'Deactivate Quiz' : 'Activate Quiz'}" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
                <i data-lucide="${isActive ? 'pause-circle' : 'play-circle'}" class="w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}"></i>
              </button>
              <button onclick="deleteQuiz(${quiz.id})" title="Delete Quiz" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>

          <h3 class="text-lg font-bold text-white group-hover:text-violet-300 transition mb-2">${quiz.title}</h3>
          <p class="text-sm text-slate-400 line-clamp-2 mb-4">${quiz.description || 'No description provided.'}</p>
        </div>

        <div>
          <div class="grid grid-cols-3 gap-2 py-3 px-3 rounded-xl bg-slate-900/60 border border-slate-800/80 mb-4 text-center">
            <div>
              <div class="text-xs text-slate-400">Questions</div>
              <div class="text-sm font-bold text-slate-200">${quiz.question_count}</div>
            </div>
            <div>
              <div class="text-xs text-slate-400">Time Limit</div>
              <div class="text-sm font-bold text-slate-200">${quiz.time_limit_minutes}m</div>
            </div>
            <div>
              <div class="text-xs text-slate-400">Avg Score</div>
              <div class="text-sm font-bold text-violet-400">${avgScoreDisplay}</div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="openManageQuestionsModal(${quiz.id}, '${escapeHtml(quiz.title)}')" class="flex-1 py-2 px-3 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 hover:text-white border border-violet-500/30 font-semibold text-xs transition flex items-center justify-center gap-1.5">
              <i data-lucide="help-circle" class="w-3.5 h-3.5"></i>
              <span>Questions (${quiz.question_count})</span>
            </button>
            <button onclick="viewQuizResults(${quiz.id})" class="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition flex items-center justify-center gap-1.5" title="View Student Results">
              <i data-lucide="bar-chart-2" class="w-3.5 h-3.5"></i>
              <span>Results (${quiz.submission_count})</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

async function toggleQuizActive(quizId, newStatus) {
  SFX.click();
  try {
    await apiCall(`/api/faculty/quizzes/${quizId}`, 'PUT', { is_active: newStatus });
    showToast(`Quiz status updated`, 'success');
    refreshFacultyQuizzes();
  } catch (err) {}
}

async function deleteQuiz(quizId) {
  if (!confirm("Are you sure you want to delete this quiz? All associated questions and student submissions will be permanently removed.")) {
    return;
  }
  SFX.click();
  try {
    await apiCall(`/api/faculty/quizzes/${quizId}`, 'DELETE');
    showToast("Quiz deleted successfully", "info");
    refreshFacultyQuizzes();
    refreshFacultyAnalytics();
  } catch (err) {}
}

// Modal: Create New Quiz
function openCreateQuizModal() {
  SFX.click();
  const modal = document.getElementById('modal-create-quiz');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('new-quiz-title').focus();
  }
}

function closeCreateQuizModal() {
  SFX.click();
  const modal = document.getElementById('modal-create-quiz');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function handleCreateQuizSubmit(e) {
  e.preventDefault();
  SFX.click();

  const title = document.getElementById('new-quiz-title').value.trim();
  const description = document.getElementById('new-quiz-desc').value.trim();
  const timeLimit = parseInt(document.getElementById('new-quiz-time').value) || 10;
  const passMarks = parseInt(document.getElementById('new-quiz-pass').value) || 60;

  if (!title) {
    showToast("Quiz title is required", "warning");
    return;
  }

  try {
    const res = await apiCall('/api/faculty/quizzes', 'POST', {
      title,
      description,
      time_limit_minutes: timeLimit,
      passing_percentage: passMarks
    });

    showToast("Quiz created successfully!", "success");
    SFX.success();
    closeCreateQuizModal();
    // Reset inputs
    document.getElementById('new-quiz-title').value = '';
    document.getElementById('new-quiz-desc').value = '';
    refreshFacultyQuizzes();

    // Directly open questions manager for this new quiz so faculty can add questions immediately
    openManageQuestionsModal(res.quiz_id, title);
  } catch (err) {}
}

// Modal: Manage Questions for a Quiz
let currentEditingQuizId = null;

async function openManageQuestionsModal(quizId, quizTitle) {
  SFX.click();
  currentEditingQuizId = quizId;
  document.getElementById('manage-questions-quiz-title').innerText = quizTitle;

  const modal = document.getElementById('modal-manage-questions');
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  // Clear builder form
  resetQuestionForm();
  await loadQuestionsForCurrentQuiz();
}

function closeManageQuestionsModal() {
  SFX.click();
  const modal = document.getElementById('modal-manage-questions');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  currentEditingQuizId = null;
  refreshFacultyQuizzes();
}

async function loadQuestionsForCurrentQuiz() {
  if (!currentEditingQuizId) return;

  try {
    const data = await apiCall(`/api/faculty/quizzes/${currentEditingQuizId}/questions`);
    AppState.facultyQuestions = data.questions || [];
    renderQuestionsList();
  } catch (err) {}
}

function renderQuestionsList() {
  const container = document.getElementById('questions-list-container');
  const countBadge = document.getElementById('questions-count-badge');
  if (!container) return;

  if (countBadge) countBadge.innerText = `${AppState.facultyQuestions.length} Questions`;

  if (AppState.facultyQuestions.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-500">
        <i data-lucide="help-circle" class="w-10 h-10 mx-auto mb-2 text-slate-600"></i>
        <p class="text-sm">No questions added to this quiz yet.</p>
        <p class="text-xs text-slate-600 mt-1">Use the builder on the left to add your first question.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = AppState.facultyQuestions.map((q, idx) => {
    return `
      <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition">
        <div class="flex items-start justify-between gap-3 mb-2">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-lg bg-violet-600/30 text-violet-300 font-bold text-xs flex items-center justify-center font-mono">
              ${idx + 1}
            </span>
            <span class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              ${q.points} pt${q.points > 1 ? 's' : ''}
            </span>
          </div>
          <button onclick="deleteQuestion(${q.id})" class="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition" title="Delete Question">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>

        <p class="text-sm font-semibold text-slate-200 mb-3">${escapeHtml(q.question_text)}</p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-2">
          <div class="p-2 rounded-lg ${q.correct_option === 'A' ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 font-bold' : 'bg-slate-800/60 text-slate-400'}">
            <span class="font-mono ${q.correct_option === 'A' ? 'text-emerald-400' : 'text-slate-500'} font-bold">A:</span> ${escapeHtml(q.option_a)}
          </div>
          <div class="p-2 rounded-lg ${q.correct_option === 'B' ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 font-bold' : 'bg-slate-800/60 text-slate-400'}">
            <span class="font-mono ${q.correct_option === 'B' ? 'text-emerald-400' : 'text-slate-500'} font-bold">B:</span> ${escapeHtml(q.option_b)}
          </div>
          <div class="p-2 rounded-lg ${q.correct_option === 'C' ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 font-bold' : 'bg-slate-800/60 text-slate-400'}">
            <span class="font-mono ${q.correct_option === 'C' ? 'text-emerald-400' : 'text-slate-500'} font-bold">C:</span> ${escapeHtml(q.option_c || '-')}
          </div>
          <div class="p-2 rounded-lg ${q.correct_option === 'D' ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 font-bold' : 'bg-slate-800/60 text-slate-400'}">
            <span class="font-mono ${q.correct_option === 'D' ? 'text-emerald-400' : 'text-slate-500'} font-bold">D:</span> ${escapeHtml(q.option_d || '-')}
          </div>
        </div>

        ${q.explanation ? `
          <div class="text-xs text-slate-500 bg-slate-950/60 p-2 rounded-lg border border-slate-800/50">
            <span class="text-violet-400 font-semibold">Explanation:</span> ${escapeHtml(q.explanation)}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

function resetQuestionForm() {
  document.getElementById('q-text').value = '';
  document.getElementById('q-opt-a').value = '';
  document.getElementById('q-opt-b').value = '';
  document.getElementById('q-opt-c').value = '';
  document.getElementById('q-opt-d').value = '';
  document.getElementById('q-explanation').value = '';
  document.getElementById('q-points').value = '1';
  document.querySelector('input[name="correct_option"][value="A"]').checked = true;
}

async function handleAddQuestionSubmit(e) {
  e.preventDefault();
  if (!currentEditingQuizId) return;
  SFX.click();

  const q_text = document.getElementById('q-text').value.trim();
  const opt_a = document.getElementById('q-opt-a').value.trim();
  const opt_b = document.getElementById('q-opt-b').value.trim();
  const opt_c = document.getElementById('q-opt-c').value.trim();
  const opt_d = document.getElementById('q-opt-d').value.trim();
  const correct = document.querySelector('input[name="correct_option"]:checked')?.value || 'A';
  const points = parseInt(document.getElementById('q-points').value) || 1;
  const explanation = document.getElementById('q-explanation').value.trim();

  if (!q_text || !opt_a || !opt_b) {
    showToast("Please provide the question text and at least options A and B", "warning");
    return;
  }

  try {
    await apiCall(`/api/faculty/quizzes/${currentEditingQuizId}/questions`, 'POST', {
      question_text: q_text,
      option_a: opt_a,
      option_b: opt_b,
      option_c: opt_c || '-',
      option_d: opt_d || '-',
      correct_option: correct,
      points: points,
      explanation: explanation
    });

    showToast("Question added successfully!", "success");
    SFX.success();
    resetQuestionForm();
    await loadQuestionsForCurrentQuiz();
  } catch (err) {}
}

async function deleteQuestion(questionId) {
  if (!confirm("Delete this question?")) return;
  SFX.click();
  try {
    await apiCall(`/api/faculty/questions/${questionId}`, 'DELETE');
    showToast("Question deleted", "info");
    await loadQuestionsForCurrentQuiz();
  } catch (err) {}
}

// --------------------------------------------------------------------------
// 9. FACULTY RESULTS & GRADEBOOK
// --------------------------------------------------------------------------
async function refreshFacultyResults() {
  const filterSelect = document.getElementById('results-quiz-filter');
  const selectedQuizId = filterSelect ? filterSelect.value : '';

  try {
    const url = selectedQuizId ? `/api/faculty/results?quiz_id=${selectedQuizId}` : '/api/faculty/results';
    const data = await apiCall(url);
    AppState.facultySubmissions = data.submissions || [];
    AppState.facultyAnalytics = data.analytics;

    populateQuizFilterDropdown();
    renderFacultyResultsTable();
    renderFacultyKPIs();
  } catch (err) {}
}

function populateQuizFilterDropdown() {
  const select = document.getElementById('results-quiz-filter');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = `<option value="">All Quizzes (${AppState.facultyQuizzes.length})</option>` + 
    AppState.facultyQuizzes.map(q => `
      <option value="${q.id}" ${currentVal == q.id ? 'selected' : ''}>${escapeHtml(q.title)}</option>
    `).join('');
}

function viewQuizResults(quizId) {
  facultyActiveTab = 'results';
  switchFacultyTab('results');
  const select = document.getElementById('results-quiz-filter');
  if (select) {
    select.value = quizId;
    refreshFacultyResults();
  }
}

function renderFacultyResultsTable() {
  const container = document.getElementById('results-table-body');
  const searchInput = document.getElementById('results-student-search');
  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

  if (!container) return;

  let filtered = AppState.facultySubmissions;
  if (searchTerm) {
    filtered = filtered.filter(s => 
      s.student_name.toLowerCase().includes(searchTerm) || 
      s.student_login_id.toLowerCase().includes(searchTerm) ||
      s.quiz_title.toLowerCase().includes(searchTerm)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="7" class="py-12 text-center text-slate-500 text-sm">
          No student submissions found.
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = filtered.map(sub => {
    const isPassed = sub.passed === 1;
    const formattedDate = new Date(sub.submitted_at).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const mins = Math.floor(sub.time_taken_seconds / 60);
    const secs = sub.time_taken_seconds % 60;
    const timeFormatted = `${mins}m ${secs}s`;

    const gradeBadge = sub.percentage >= 80 
      ? `<span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Distinction</span>`
      : isPassed 
      ? `<span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">Passed</span>`
      : `<span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40">Failed</span>`;

    return `
      <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 transition">
        <td class="py-3.5 px-4">
          <div class="font-bold text-slate-200 text-sm">${escapeHtml(sub.student_name)}</div>
          <div class="text-xs text-slate-400 font-mono">ID: ${escapeHtml(sub.student_login_id)}</div>
        </td>
        <td class="py-3.5 px-4 text-sm text-slate-300 font-medium">${escapeHtml(sub.quiz_title)}</td>
        <td class="py-3.5 px-4 font-mono text-sm font-bold text-slate-200">
          ${sub.score} / ${sub.total_points}
        </td>
        <td class="py-3.5 px-4 font-mono font-bold text-sm ${isPassed ? 'text-emerald-400' : 'text-rose-400'}">
          ${sub.percentage}%
        </td>
        <td class="py-3.5 px-4">${gradeBadge}</td>
        <td class="py-3.5 px-4 text-xs text-slate-400 font-mono">
          <div>${timeFormatted}</div>
          <div class="text-slate-500">${formattedDate}</div>
        </td>
        <td class="py-3.5 px-4 text-right">
          <button onclick="inspectSubmission(${sub.id})" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-violet-600/30 text-slate-300 hover:text-white border border-slate-700 hover:border-violet-500/40 text-xs font-semibold transition inline-flex items-center gap-1.5">
            <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            <span>Inspect</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

async function inspectSubmission(submissionId) {
  SFX.click();
  try {
    const data = await apiCall(`/api/faculty/submissions/${submissionId}`);
    const sub = data.submission;

    const modal = document.getElementById('modal-inspect-submission');
    const headerTitle = document.getElementById('inspect-modal-title');
    const studentInfo = document.getElementById('inspect-modal-student');
    const breakdownContainer = document.getElementById('inspect-modal-breakdown');

    headerTitle.innerText = `Detailed Breakdown: ${sub.quiz_title}`;
    studentInfo.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <span class="text-slate-400 text-xs">Student:</span>
          <span class="text-slate-100 font-bold ml-1">${sub.student_name}</span>
          <span class="text-slate-400 text-xs font-mono ml-1">(${sub.student_login_id})</span>
        </div>
        <div class="flex items-center gap-4 text-sm font-mono">
          <div>Score: <b class="text-white">${sub.score}/${sub.total_points}</b></div>
          <div>Percentage: <b class="${sub.passed ? 'text-emerald-400' : 'text-rose-400'}">${sub.percentage}%</b></div>
          <div>Status: <b class="${sub.passed ? 'text-emerald-400' : 'text-rose-400'}">${sub.passed ? 'PASSED' : 'FAILED'}</b></div>
        </div>
      </div>
    `;

    breakdownContainer.innerHTML = sub.breakdown.map((item, idx) => {
      const isCorrect = item.is_correct;
      return `
        <div class="p-4 rounded-xl border ${isCorrect ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-rose-950/20 border-rose-500/30'}">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold px-2 py-0.5 rounded ${isCorrect ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'} font-mono">
              Q${idx + 1} • ${isCorrect ? 'CORRECT (+' + item.points + ')' : 'INCORRECT (0)'}
            </span>
          </div>
          <p class="text-sm font-bold text-slate-200 mb-3">${escapeHtml(item.question_text)}</p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
            <div class="p-2 rounded ${item.student_choice === 'A' ? (item.correct_option === 'A' ? 'bg-emerald-900/40 border border-emerald-500' : 'bg-rose-900/40 border border-rose-500') : (item.correct_option === 'A' ? 'bg-emerald-950/30 border border-emerald-500/40' : 'bg-slate-800/40')}">
              <b>A:</b> ${escapeHtml(item.option_a)} ${item.student_choice === 'A' ? '(Picked)' : ''} ${item.correct_option === 'A' ? '✓' : ''}
            </div>
            <div class="p-2 rounded ${item.student_choice === 'B' ? (item.correct_option === 'B' ? 'bg-emerald-900/40 border border-emerald-500' : 'bg-rose-900/40 border border-rose-500') : (item.correct_option === 'B' ? 'bg-emerald-950/30 border border-emerald-500/40' : 'bg-slate-800/40')}">
              <b>B:</b> ${escapeHtml(item.option_b)} ${item.student_choice === 'B' ? '(Picked)' : ''} ${item.correct_option === 'B' ? '✓' : ''}
            </div>
            <div class="p-2 rounded ${item.student_choice === 'C' ? (item.correct_option === 'C' ? 'bg-emerald-900/40 border border-emerald-500' : 'bg-rose-900/40 border border-rose-500') : (item.correct_option === 'C' ? 'bg-emerald-950/30 border border-emerald-500/40' : 'bg-slate-800/40')}">
              <b>C:</b> ${escapeHtml(item.option_c)} ${item.student_choice === 'C' ? '(Picked)' : ''} ${item.correct_option === 'C' ? '✓' : ''}
            </div>
            <div class="p-2 rounded ${item.student_choice === 'D' ? (item.correct_option === 'D' ? 'bg-emerald-900/40 border border-emerald-500' : 'bg-rose-900/40 border border-rose-500') : (item.correct_option === 'D' ? 'bg-emerald-950/30 border border-emerald-500/40' : 'bg-slate-800/40')}">
              <b>D:</b> ${escapeHtml(item.option_d)} ${item.student_choice === 'D' ? '(Picked)' : ''} ${item.correct_option === 'D' ? '✓' : ''}
            </div>
          </div>

          ${item.explanation ? `
            <div class="text-xs text-slate-400 bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
              <span class="text-indigo-400 font-bold">Faculty Explanation:</span> ${escapeHtml(item.explanation)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lucide.createIcons();
  } catch (err) {}
}

function closeInspectSubmissionModal() {
  SFX.click();
  const modal = document.getElementById('modal-inspect-submission');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// --------------------------------------------------------------------------
// 10. STUDENT DASHBOARD IMPLEMENTATION
// --------------------------------------------------------------------------
async function loadStudentDashboard() {
  switchView('student');
  await refreshStudentQuizzes();
  await refreshStudentHistory();
}

async function refreshStudentQuizzes() {
  try {
    const data = await apiCall('/api/student/quizzes');
    AppState.studentQuizzes = data.quizzes || [];
    renderStudentQuizzesGrid();
  } catch (err) {}
}

async function refreshStudentHistory() {
  try {
    const data = await apiCall('/api/student/my-results');
    AppState.studentHistory = data.submissions || [];
    renderStudentHistoryTable();
  } catch (err) {}
}

function renderStudentQuizzesGrid() {
  const container = document.getElementById('student-quizzes-grid');
  if (!container) return;

  if (AppState.studentQuizzes.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center glass-card rounded-2xl border border-slate-800">
        <i data-lucide="inbox" class="w-12 h-12 text-slate-600 mx-auto mb-3"></i>
        <h4 class="text-lg font-bold text-slate-300">No quizzes available right now</h4>
        <p class="text-sm text-slate-500 max-w-md mx-auto">Your faculty hasn't published an active quiz yet. Please check back later.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = AppState.studentQuizzes.map(quiz => {
    const hasAttempted = quiz.my_attempt_count > 0;
    const lastScoreBadge = hasAttempted ? `
      <span class="px-2.5 py-1 text-xs font-bold rounded-lg ${quiz.my_last_passed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}">
        Previous Score: ${quiz.my_last_score}% (${quiz.my_last_passed ? 'Passed' : 'Failed'})
      </span>
    ` : `
      <span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
        Ready to Take
      </span>
    `;

    return `
      <div class="glass-card-interactive rounded-2xl p-6 border border-slate-800 flex flex-col justify-between group">
        <div>
          <div class="flex items-center justify-between gap-2 mb-3">
            ${lastScoreBadge}
            <span class="text-xs text-slate-400 font-medium flex items-center gap-1">
              <i data-lucide="user" class="w-3 h-3 text-slate-500"></i>
              ${escapeHtml(quiz.faculty_name)}
            </span>
          </div>

          <h3 class="text-lg font-bold text-white group-hover:text-indigo-300 transition mb-2">${escapeHtml(quiz.title)}</h3>
          <p class="text-sm text-slate-400 line-clamp-2 mb-5">${escapeHtml(quiz.description || 'No description.')}</p>
        </div>

        <div>
          <div class="grid grid-cols-3 gap-2 py-3 px-3 rounded-xl bg-slate-900/60 border border-slate-800 mb-5 text-center font-mono">
            <div>
              <div class="text-xs text-slate-500 font-sans">Questions</div>
              <div class="text-sm font-bold text-slate-200">${quiz.question_count}</div>
            </div>
            <div>
              <div class="text-xs text-slate-500 font-sans">Duration</div>
              <div class="text-sm font-bold text-slate-200">${quiz.time_limit_minutes}m</div>
            </div>
            <div>
              <div class="text-xs text-slate-500 font-sans">Pass Mark</div>
              <div class="text-sm font-bold text-emerald-400">${quiz.passing_percentage}%</div>
            </div>
          </div>

          <button onclick="startStudentQuiz(${quiz.id})" class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 group-hover:scale-[1.02]">
            <i data-lucide="play" class="w-4 h-4 fill-current"></i>
            <span>${hasAttempted ? 'Retake Quiz' : 'Attend Quiz'}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

function renderStudentHistoryTable() {
  const container = document.getElementById('student-history-body');
  if (!container) return;

  if (AppState.studentHistory.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="6" class="py-10 text-center text-slate-500 text-sm">
          You haven't attended any quizzes yet. Pick an available quiz above to get started!
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = AppState.studentHistory.map(sub => {
    const isPassed = sub.passed === 1;
    const formattedDate = new Date(sub.submitted_at).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const mins = Math.floor(sub.time_taken_seconds / 60);
    const secs = sub.time_taken_seconds % 60;

    return `
      <tr class="border-b border-slate-800/60 hover:bg-slate-800/20 transition">
        <td class="py-3 px-4 font-medium text-slate-200 text-sm">${escapeHtml(sub.quiz_title)}</td>
        <td class="py-3 px-4 font-mono font-bold text-sm text-slate-300">${sub.score} / ${sub.total_points}</td>
        <td class="py-3 px-4 font-mono font-bold text-sm ${isPassed ? 'text-emerald-400' : 'text-rose-400'}">${sub.percentage}%</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 text-xs font-bold rounded-lg ${isPassed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}">
            ${isPassed ? 'Passed' : 'Failed'}
          </span>
        </td>
        <td class="py-3 px-4 text-xs font-mono text-slate-400">${mins}m ${secs}s</td>
        <td class="py-3 px-4 text-xs font-mono text-slate-500">${formattedDate}</td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

// --------------------------------------------------------------------------
// 11. QUIZ ATTENDANCE (THE INTERACTIVE QUIZ ARENA)
// --------------------------------------------------------------------------
async function startStudentQuiz(quizId) {
  SFX.click();
  try {
    const data = await apiCall(`/api/student/quizzes/${quizId}/start`);
    AppState.currentQuiz = data.quiz;
    AppState.currentQuestions = data.questions;
    AppState.currentQuestionIndex = 0;
    AppState.studentAnswers = {};
    AppState.quizStartTime = Date.now();

    const limitMinutes = data.quiz.time_limit_minutes || 10;
    AppState.timeTotalSeconds = limitMinutes * 60;
    AppState.timeRemainingSeconds = AppState.timeTotalSeconds;

    // Switch view to arena
    switchView('quiz-arena');
    renderQuizArenaHeader();
    renderQuestionStepper();
    renderCurrentQuestion();
    startQuizTimer();

    showToast(`Quiz started! You have ${limitMinutes} minutes. Good luck!`, "info");
  } catch (err) {}
}

function startQuizTimer() {
  if (AppState.quizTimerInterval) {
    clearInterval(AppState.quizTimerInterval);
  }

  updateTimerDisplay();

  AppState.quizTimerInterval = setInterval(() => {
    AppState.timeRemainingSeconds--;

    if (AppState.timeRemainingSeconds <= 30 && AppState.timeRemainingSeconds > 0) {
      SFX.tick();
    }

    updateTimerDisplay();

    if (AppState.timeRemainingSeconds <= 0) {
      clearInterval(AppState.quizTimerInterval);
      SFX.warning();
      showToast("Time is up! Submitting your answers automatically...", "warning");
      submitQuizAnswers(true);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const timerText = document.getElementById('quiz-timer-text');
  const timerContainer = document.getElementById('quiz-timer-container');
  if (!timerText) return;

  const mins = Math.floor(AppState.timeRemainingSeconds / 60);
  const secs = AppState.timeRemainingSeconds % 60;
  timerText.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  if (AppState.timeRemainingSeconds <= 30) {
    timerContainer.classList.add('timer-critical');
  } else if (AppState.timeRemainingSeconds <= 120) {
    timerContainer.className = "flex items-center gap-2 px-3 py-1.5 rounded-xl border border-amber-500/50 bg-amber-950/30 text-amber-300 font-mono font-bold text-sm";
  } else {
    timerContainer.className = "flex items-center gap-2 px-3 py-1.5 rounded-xl border border-indigo-500/40 bg-indigo-950/40 text-indigo-200 font-mono font-bold text-sm";
  }
}

function renderQuizArenaHeader() {
  const titleEl = document.getElementById('quiz-arena-title');
  const progressText = document.getElementById('quiz-progress-text');
  if (titleEl && AppState.currentQuiz) {
    titleEl.innerText = AppState.currentQuiz.title;
  }
  if (progressText && AppState.currentQuestions) {
    progressText.innerText = `Question ${AppState.currentQuestionIndex + 1} of ${AppState.currentQuestions.length}`;
  }
}

function renderQuestionStepper() {
  const container = document.getElementById('quiz-stepper-container');
  if (!container || !AppState.currentQuestions) return;

  container.innerHTML = AppState.currentQuestions.map((q, idx) => {
    const isAnswered = AppState.studentAnswers[q.id] !== undefined;
    const isCurrent = idx === AppState.currentQuestionIndex;

    let classes = "w-8 h-8 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition-all cursor-pointer ";
    if (isCurrent) {
      classes += "bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900 shadow-md scale-105";
    } else if (isAnswered) {
      classes += "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30";
    } else {
      classes += "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white";
    }

    return `
      <button onclick="jumpToQuestion(${idx})" class="${classes}">
        ${idx + 1}
      </button>
    `;
  }).join('');
}

function jumpToQuestion(index) {
  if (index >= 0 && index < AppState.currentQuestions.length) {
    SFX.click();
    AppState.currentQuestionIndex = index;
    renderQuizArenaHeader();
    renderQuestionStepper();
    renderCurrentQuestion();
  }
}

function renderCurrentQuestion() {
  const q = AppState.currentQuestions[AppState.currentQuestionIndex];
  if (!q) return;

  const qText = document.getElementById('quiz-question-text');
  const pointsBadge = document.getElementById('quiz-points-badge');
  const optionsContainer = document.getElementById('quiz-options-container');

  if (qText) qText.innerText = q.question_text;
  if (pointsBadge) pointsBadge.innerText = `${q.points} Point${q.points > 1 ? 's' : ''}`;

  const selectedAnswer = AppState.studentAnswers[q.id];

  const options = [
    { key: 'A', text: q.option_a },
    { key: 'B', text: q.option_b },
    { key: 'C', text: q.option_c },
    { key: 'D', text: q.option_d },
  ].filter(opt => opt.text && opt.text.trim() !== '-');

  if (optionsContainer) {
    optionsContainer.innerHTML = options.map(opt => {
      const isSelected = selectedAnswer === opt.key;
      return `
        <button onclick="selectOption('${opt.key}')" class="quiz-option-btn w-full p-4 rounded-xl text-left flex items-center gap-4 ${isSelected ? 'selected' : ''}">
          <span class="w-8 h-8 rounded-lg ${isSelected ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-300 font-semibold'} flex items-center justify-center font-mono text-sm border border-slate-700/60">
            ${opt.key}
          </span>
          <span class="text-sm font-medium ${isSelected ? 'text-indigo-100 font-semibold' : 'text-slate-200'}">
            ${escapeHtml(opt.text)}
          </span>
        </button>
      `;
    }).join('');
  }

  // Update navigation buttons
  const prevBtn = document.getElementById('quiz-prev-btn');
  const nextBtn = document.getElementById('quiz-next-btn');

  if (prevBtn) {
    prevBtn.disabled = AppState.currentQuestionIndex === 0;
    prevBtn.classList.toggle('opacity-50', AppState.currentQuestionIndex === 0);
  }

  if (nextBtn) {
    if (AppState.currentQuestionIndex === AppState.currentQuestions.length - 1) {
      nextBtn.innerHTML = `<span>Review & Finish</span> <i data-lucide="check" class="w-4 h-4"></i>`;
    } else {
      nextBtn.innerHTML = `<span>Next Question</span> <i data-lucide="arrow-right" class="w-4 h-4"></i>`;
    }
  }

  lucide.createIcons();
}

function selectOption(optionKey) {
  SFX.select();
  const q = AppState.currentQuestions[AppState.currentQuestionIndex];
  if (!q) return;

  AppState.studentAnswers[q.id] = optionKey;
  renderQuestionStepper();
  renderCurrentQuestion();
}

function quizPrevQuestion() {
  if (AppState.currentQuestionIndex > 0) {
    jumpToQuestion(AppState.currentQuestionIndex - 1);
  }
}

function quizNextQuestion() {
  if (AppState.currentQuestionIndex < AppState.currentQuestions.length - 1) {
    jumpToQuestion(AppState.currentQuestionIndex + 1);
  } else {
    // Reached the end, prompt submit
    openSubmitConfirmModal();
  }
}

// Close Quiz Confirmation Modal
function openCloseQuizModal() {
  SFX.warning();
  const modal = document.getElementById('modal-close-quiz-confirm');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function dismissCloseQuizModal() {
  SFX.click();
  const modal = document.getElementById('modal-close-quiz-confirm');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function exitQuizWithoutSubmitting() {
  SFX.click();
  if (AppState.quizTimerInterval) {
    clearInterval(AppState.quizTimerInterval);
  }
  dismissCloseQuizModal();
  showToast("Quiz closed. Unsubmitted answers were discarded.", "info");
  loadStudentDashboard();
}

// Submit Quiz Confirmation Modal
function openSubmitConfirmModal() {
  SFX.click();
  const modal = document.getElementById('modal-submit-quiz-confirm');
  const total = AppState.currentQuestions.length;
  const answered = Object.keys(AppState.studentAnswers).length;
  const unanswered = total - answered;

  document.getElementById('submit-answered-count').innerText = `${answered} of ${total}`;
  const unEl = document.getElementById('submit-unanswered-warning');
  if (unanswered > 0) {
    unEl.innerHTML = `<span class="text-amber-400 font-semibold">Note: You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}.</span>`;
  } else {
    unEl.innerHTML = `<span class="text-emerald-400 font-semibold">Awesome! You answered all questions.</span>`;
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function dismissSubmitConfirmModal() {
  SFX.click();
  const modal = document.getElementById('modal-submit-quiz-confirm');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function submitQuizAnswers(isAutoSubmit = false) {
  dismissSubmitConfirmModal();

  if (AppState.quizTimerInterval) {
    clearInterval(AppState.quizTimerInterval);
  }

  const elapsedSeconds = Math.max(1, Math.floor((Date.now() - AppState.quizStartTime) / 1000));

  try {
    const res = await apiCall(`/api/student/quizzes/${AppState.currentQuiz.id}/submit`, 'POST', {
      answers: AppState.studentAnswers,
      time_taken_seconds: elapsedSeconds
    });

    // Render interactive scorecard
    renderScorecardView(res.result);
  } catch (err) {}
}

// --------------------------------------------------------------------------
// 12. POST-QUIZ INTERACTIVE SCORECARD & REVIEW
// --------------------------------------------------------------------------
function renderScorecardView(result) {
  switchView('quiz-scorecard');

  const titleEl = document.getElementById('scorecard-title');
  const scoreBadgeEl = document.getElementById('scorecard-score-badge');
  const percentEl = document.getElementById('scorecard-percentage');
  const statusEl = document.getElementById('scorecard-status-message');
  const timeEl = document.getElementById('scorecard-time-taken');
  const breakdownContainer = document.getElementById('scorecard-breakdown-container');

  if (titleEl) titleEl.innerText = result.quiz_title;
  if (scoreBadgeEl) scoreBadgeEl.innerText = `${result.score} / ${result.total_points}`;
  if (percentEl) percentEl.innerText = `${result.percentage}%`;

  const mins = Math.floor(result.time_taken_seconds / 60);
  const secs = result.time_taken_seconds % 60;
  if (timeEl) timeEl.innerText = `${mins}m ${secs}s`;

  if (result.passed) {
    SFX.fanfare();
    triggerConfetti();
    statusEl.innerHTML = `
      <div class="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-2 font-bold text-sm">
        <i data-lucide="award" class="w-5 h-5 text-emerald-400"></i>
        <span>Congratulations! You Passed (Passing mark: ${result.passing_percentage}%)</span>
      </div>
    `;
  } else {
    SFX.warning();
    statusEl.innerHTML = `
      <div class="px-4 py-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-2 font-bold text-sm">
        <i data-lucide="alert-triangle" class="w-5 h-5 text-rose-400"></i>
        <span>Needs Retake (Passing mark: ${result.passing_percentage}%)</span>
      </div>
    `;
  }

  // Render question-by-question review
  if (breakdownContainer && result.breakdown) {
    breakdownContainer.innerHTML = result.breakdown.map((item, idx) => {
      const isCorrect = item.is_correct;
      return `
        <div class="p-5 rounded-2xl border ${isCorrect ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-rose-950/20 border-rose-500/30'}">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold px-2.5 py-1 rounded-lg ${isCorrect ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'} font-mono">
              Question ${idx + 1} • ${isCorrect ? 'CORRECT (+' + item.points + ')' : 'INCORRECT'}
            </span>
          </div>

          <h4 class="text-base font-bold text-slate-100 mb-4">${escapeHtml(item.question_text)}</h4>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
            <div class="p-3 rounded-xl ${getOptionReviewClasses('A', item)}">
              <b>A:</b> ${escapeHtml(item.option_a)} ${getOptionBadge('A', item)}
            </div>
            <div class="p-3 rounded-xl ${getOptionReviewClasses('B', item)}">
              <b>B:</b> ${escapeHtml(item.option_b)} ${getOptionBadge('B', item)}
            </div>
            <div class="p-3 rounded-xl ${getOptionReviewClasses('C', item)}">
              <b>C:</b> ${escapeHtml(item.option_c)} ${getOptionBadge('C', item)}
            </div>
            <div class="p-3 rounded-xl ${getOptionReviewClasses('D', item)}">
              <b>D:</b> ${escapeHtml(item.option_d)} ${getOptionBadge('D', item)}
            </div>
          </div>

          ${item.explanation ? `
            <div class="text-xs text-slate-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span class="text-indigo-400 font-bold">Faculty Explanation:</span> ${escapeHtml(item.explanation)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  lucide.createIcons();
}

function getOptionReviewClasses(optKey, item) {
  const isSelected = item.student_choice === optKey;
  const isCorrect = item.correct_option === optKey;

  if (isSelected && isCorrect) {
    return 'bg-emerald-900/40 border-2 border-emerald-500 text-emerald-200 font-bold';
  } else if (isSelected && !isCorrect) {
    return 'bg-rose-900/40 border-2 border-rose-500 text-rose-200 font-bold';
  } else if (isCorrect) {
    return 'bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 font-semibold';
  } else {
    return 'bg-slate-800/40 border border-slate-700/50 text-slate-400';
  }
}

function getOptionBadge(optKey, item) {
  const isSelected = item.student_choice === optKey;
  const isCorrect = item.correct_option === optKey;

  if (isSelected && isCorrect) return `<span class="ml-2 text-xs text-emerald-400 font-bold">(Your Answer ✓)</span>`;
  if (isSelected && !isCorrect) return `<span class="ml-2 text-xs text-rose-400 font-bold">(Your Answer ✗)</span>`;
  if (isCorrect) return `<span class="ml-2 text-xs text-emerald-400 font-bold">(Correct)</span>`;
  return '';
}

function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 250);
  }
}

// --------------------------------------------------------------------------
// 13. Event Listeners & Helpers
// --------------------------------------------------------------------------
function setupEventListeners() {
  // Live preview for faculty question builder
  const qInputs = ['q-text', 'q-opt-a', 'q-opt-b', 'q-opt-c', 'q-opt-d'];
  qInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateQuestionLivePreview);
  });

  const correctRadios = document.querySelectorAll('input[name="correct_option"]');
  correctRadios.forEach(radio => {
    radio.addEventListener('change', updateQuestionLivePreview);
  });
}

function updateQuestionLivePreview() {
  const previewBox = document.getElementById('question-live-preview');
  if (!previewBox) return;

  const text = document.getElementById('q-text').value.trim() || 'Type your question above to see live preview...';
  const a = document.getElementById('q-opt-a').value.trim() || 'Option A';
  const b = document.getElementById('q-opt-b').value.trim() || 'Option B';
  const c = document.getElementById('q-opt-c').value.trim() || 'Option C';
  const d = document.getElementById('q-opt-d').value.trim() || 'Option D';
  const correct = document.querySelector('input[name="correct_option"]:checked')?.value || 'A';

  previewBox.innerHTML = `
    <div class="text-xs font-bold text-violet-400 mb-1">LIVE PREVIEW</div>
    <div class="text-sm font-bold text-slate-100 mb-3">${escapeHtml(text)}</div>
    <div class="grid grid-cols-2 gap-2 text-xs">
      <div class="p-2 rounded-lg ${correct === 'A' ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 font-bold' : 'bg-slate-800/60 text-slate-400'}">
        <b>A:</b> ${escapeHtml(a)} ${correct === 'A' ? '✓' : ''}
      </div>
      <div class="p-2 rounded-lg ${correct === 'B' ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 font-bold' : 'bg-slate-800/60 text-slate-400'}">
        <b>B:</b> ${escapeHtml(b)} ${correct === 'B' ? '✓' : ''}
      </div>
      <div class="p-2 rounded-lg ${correct === 'C' ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 font-bold' : 'bg-slate-800/60 text-slate-400'}">
        <b>C:</b> ${escapeHtml(c)} ${correct === 'C' ? '✓' : ''}
      </div>
      <div class="p-2 rounded-lg ${correct === 'D' ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 font-bold' : 'bg-slate-800/60 text-slate-400'}">
        <b>D:</b> ${escapeHtml(d)} ${correct === 'D' ? '✓' : ''}
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.innerText = str;
  return div.innerHTML;
}

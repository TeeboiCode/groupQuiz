const STORAGE_KEY = "groupQuizGame";
const DEFAULT_COLORS = ["#0a69ed", "#f97316", "#8b5cf6", "#e11d48", "#0891b2"];

const grid = document.getElementById("question-grid");
const quizArea = document.getElementById("quiz-area");
const setupPanel = document.getElementById("game-setup");
const setupForm = document.getElementById("setup-form");
const groupFields = document.getElementById("group-fields");
const addGroupBtn = document.getElementById("add-group");
const setupError = document.getElementById("setup-error");
const headerScoreboard = document.getElementById("header-scoreboard");
const resetGameBtn = document.getElementById("reset-game");
const questionBox = document.getElementById("question-box");
const questionText = document.getElementById("question-text");
const countdown = document.getElementById("countdown");
const questionNumberEl = document.getElementById("current-question-number");
const revealBtn = document.getElementById("show-answer");
const answerPanel = document.getElementById("answer-panel");
const roundStatus = document.getElementById("round-status");
const gradingControls = document.getElementById("grading-controls");
const gradingGroup = document.getElementById("grading-group");
const correctBtn = document.getElementById("mark-correct");
const incorrectBtn = document.getElementById("mark-incorrect");
const backBtn = document.getElementById("back-to-grid");
const loadStatus = document.getElementById("load-status");
const loadTitle = document.getElementById("load-title");
const loadMessage = document.getElementById("load-message");
const retryLoad = document.getElementById("retry-load");
const loadHome = document.getElementById("load-home");

let savedGame = readSavedGame();
let config = isValidConfig(savedGame?.config) ? savedGame.config : null;
let scores = {};
let activeGroupIndex = 0;
let usedQuestionIds = new Set();
let answeredByGroup = {};
let questionOrder = [];
let questionData = [];
let activeQuestion = null;
let activeQuestionButton = null;
let preparing = false;
let roundGraded = false;
let timer;
let notificationTimer;
let setupGroupCounter = 0;

restoreProgress();
initializeScreen();
loadQuestions();

function readSavedGame() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch (error) {
    console.warn("Saved game data could not be read and was reset.", error);
    return null;
  }
}

function isValidConfig(value) {
  return Boolean(
    value &&
      Array.isArray(value.groups) &&
      value.groups.length >= 2 &&
      value.groups.length <= 5 &&
      value.groups.every(
        (group) =>
          typeof group.id === "string" &&
          typeof group.name === "string" &&
          group.name.trim() &&
          /^#[0-9a-f]{6}$/i.test(group.color)
      ) &&
      Number.isInteger(value.questionTime) &&
      value.questionTime >= 10 &&
      value.questionTime <= 600 &&
      Number.isInteger(value.winningScore) &&
      value.winningScore >= 1 &&
      value.winningScore <= 100 &&
      Number.isInteger(value.pointValue) &&
      value.pointValue >= 1 &&
      value.pointValue <= 20
  );
}

function restoreProgress() {
  if (!config) return;
  const savedScores = savedGame?.scores || {};
  scores = Object.fromEntries(
    config.groups.map((group) => [
      group.id,
      Number.isInteger(savedScores[group.id]) && savedScores[group.id] >= 0
        ? savedScores[group.id]
        : 0,
    ])
  );
  activeGroupIndex = Number.isInteger(savedGame?.activeGroupIndex) && savedGame.activeGroupIndex >= 0
    ? savedGame.activeGroupIndex % config.groups.length
    : 0;
  usedQuestionIds = new Set(
    Array.isArray(savedGame?.usedQuestionIds)
      ? savedGame.usedQuestionIds.map(String)
      : []
  );
  const validGroupIds = new Set(config.groups.map((group) => group.id));
  answeredByGroup = Object.fromEntries(
    Object.entries(savedGame?.answeredByGroup || {}).filter(([, groupId]) =>
      validGroupIds.has(groupId)
    )
  );
  questionOrder = Array.isArray(savedGame?.questionOrder)
    ? savedGame.questionOrder.map(String)
    : [];
}

function initializeScreen() {
  if (config) {
    showQuiz();
    return;
  }
  setupPanel.hidden = false;
  quizArea.hidden = true;
  headerScoreboard.hidden = true;
  resetGameBtn.hidden = true;
  addGroupRow({ name: "Group A", color: DEFAULT_COLORS[0] });
  addGroupRow({ name: "Group B", color: DEFAULT_COLORS[1] });
}

function addGroupRow(group = {}) {
  if (groupFields.children.length >= 5) return;
  const index = setupGroupCounter++;
  const row = document.createElement("div");
  row.className = "group-setup-row";
  row.dataset.groupId = group.id || `group-${index + 1}`;

  const badge = document.createElement("span");
  badge.className = "group-number";

  const nameLabel = document.createElement("label");
  nameLabel.innerHTML = `<span>Group name</span>`;
  const nameInput = document.createElement("input");
  nameInput.className = "group-name-input";
  nameInput.type = "text";
  nameInput.maxLength = 24;
  nameInput.required = true;
  nameInput.placeholder = "Enter group name";
  nameInput.value = group.name || `Group ${String.fromCharCode(65 + index)}`;
  nameLabel.appendChild(nameInput);

  const colorLabel = document.createElement("label");
  colorLabel.className = "color-field";
  colorLabel.innerHTML = `<span>Group color</span>`;
  const colorInput = document.createElement("input");
  colorInput.className = "group-color-input";
  colorInput.type = "color";
  colorInput.value = group.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  colorLabel.appendChild(colorInput);

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-group-btn";
  removeBtn.type = "button";
  removeBtn.textContent = "Remove";
  removeBtn.onclick = () => {
    if (groupFields.children.length <= 2) return;
    row.remove();
    updateSetupRows();
  };

  row.append(badge, nameLabel, colorLabel, removeBtn);
  groupFields.appendChild(row);
  updateSetupRows();
}

function updateSetupRows() {
  [...groupFields.children].forEach((row, index) => {
    row.querySelector(".group-number").textContent = index + 1;
    row.querySelector(".remove-group-btn").disabled = groupFields.children.length <= 2;
  });
  addGroupBtn.disabled = groupFields.children.length >= 5;
  addGroupBtn.textContent = groupFields.children.length >= 5 ? "5 groups maximum" : "+ Add group";
}

addGroupBtn.onclick = () => addGroupRow();

setupForm.onsubmit = (event) => {
  event.preventDefault();
  const rows = [...groupFields.querySelectorAll(".group-setup-row")];
  const groups = rows.map((row, index) => ({
    id: `group-${index + 1}`,
    name: row.querySelector(".group-name-input").value.trim(),
    color: row.querySelector(".group-color-input").value,
  }));
  const names = groups.map((group) => group.name.toLowerCase());
  if (groups.some((group) => !group.name)) {
    return showSetupError("Every group needs a name.");
  }
  if (new Set(names).size !== names.length) {
    return showSetupError("Each group needs a different name.");
  }

  const questionTime = Number(document.getElementById("setup-time").value);
  const winningScore = Number(document.getElementById("setup-winning-score").value);
  const pointValue = Number(document.getElementById("setup-point-value").value);
  const nextConfig = { groups, questionTime, winningScore, pointValue };
  if (!isValidConfig(nextConfig)) {
    return showSetupError("Check the game rules and use values within the allowed ranges.");
  }

  config = nextConfig;
  scores = Object.fromEntries(groups.map((group) => [group.id, 0]));
  activeGroupIndex = 0;
  usedQuestionIds.clear();
  questionOrder = questionData.map((question) => String(question.id));
  setupError.hidden = true;
  saveGame();
  showQuiz();
};

function showSetupError(message) {
  setupError.textContent = message;
  setupError.hidden = false;
  setupError.focus();
}

function showQuiz() {
  setupPanel.hidden = true;
  quizArea.hidden = false;
  headerScoreboard.hidden = false;
  resetGameBtn.hidden = false;
  countdown.textContent = config.questionTime;
  renderScoreboard();
}

function activeGroup() {
  return config.groups[activeGroupIndex];
}

function renderScoreboard() {
  headerScoreboard.replaceChildren();
  config.groups.forEach((group, index) => {
    const card = document.createElement("div");
    card.className = "score-card";
    card.classList.toggle("active", index === activeGroupIndex);
    card.style.setProperty("--group-color", group.color);
    card.setAttribute("aria-label", `${group.name} score ${scores[group.id]}`);

    const colorDot = document.createElement("span");
    colorDot.className = "group-color-dot";
    const name = document.createElement("span");
    name.className = "score-card-name";
    name.textContent = group.name;
    const score = document.createElement("strong");
    score.textContent = scores[group.id];
    const turn = document.createElement("small");
    turn.textContent = "Playing";

    card.append(colorDot, name, score, turn);
    headerScoreboard.appendChild(card);
  });
  gradingGroup.textContent = activeGroup().name;
}

function saveGame() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 2,
      config,
      scores,
      activeGroupIndex,
      usedQuestionIds: [...usedQuestionIds],
      answeredByGroup,
      questionOrder,
    })
  );
}

function clearGame() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

function showScoreNotification(wasCorrect, gradedGroup) {
  const notice = document.getElementById("score-notification");
  const backdrop = document.getElementById("score-toast-backdrop");
  clearTimeout(notificationTimer);
  notice.classList.remove("show", "correct", "incorrect");
  backdrop.classList.remove("show");
  void notice.offsetWidth;
  notice.classList.add(wasCorrect ? "correct" : "incorrect", "show");
  backdrop.classList.add("show");
  document.getElementById("score-result-icon").textContent = wasCorrect ? "✓" : "✕";
  document.getElementById("score-result-title").textContent = wasCorrect
    ? `${gradedGroup.name} is correct!`
    : `${gradedGroup.name} is incorrect`;
  document.getElementById("score-result-message").textContent = wasCorrect
    ? `${config.pointValue} ${config.pointValue === 1 ? "point" : "points"} added.`
    : "No points added this round.";

  const scoreList = document.getElementById("notification-scores");
  scoreList.replaceChildren();
  config.groups.forEach((group) => {
    const item = document.createElement("span");
    item.textContent = `${group.name}: `;
    const value = document.createElement("b");
    value.textContent = scores[group.id];
    item.appendChild(value);
    scoreList.appendChild(item);
  });
  notificationTimer = setTimeout(() => {
    notice.classList.remove("show");
    backdrop.classList.remove("show");
  }, 5000);
}

function gradeAnswer(wasCorrect) {
  if (!activeQuestion || answerPanel.hidden || roundGraded) return;
  roundGraded = true;
  const gradedGroup = activeGroup();
  const previousScore = scores[gradedGroup.id];
  answeredByGroup[String(activeQuestion.id)] = gradedGroup.id;
  applyAnsweredStyle(activeQuestionButton, gradedGroup);
  if (wasCorrect) scores[gradedGroup.id] += config.pointValue;
  activeGroupIndex = (activeGroupIndex + 1) % config.groups.length;
  saveGame();
  renderScoreboard();
  gradingControls.hidden = true;
  roundStatus.textContent = `${gradedGroup.name} marked ${wasCorrect ? "correct" : "incorrect"}. ${activeGroup().name} plays next.`;
  if (
    wasCorrect &&
    previousScore < config.winningScore &&
    scores[gradedGroup.id] >= config.winningScore
  ) {
    showWinnerModal(gradedGroup);
  } else {
    showScoreNotification(wasCorrect, gradedGroup);
  }
  backBtn.disabled = false;
  backBtn.textContent = "Next challenge →";
}

function showWinnerModal(winner) {
  clearTimeout(notificationTimer);
  document.getElementById("score-notification").classList.remove("show");
  document.getElementById("score-toast-backdrop").classList.remove("show");
  document.getElementById("winner-title").textContent = `${winner.name} wins!`;
  document.getElementById("winner-message").textContent = `${winner.name} reached ${config.winningScore} points. What a brilliant game!`;

  const scoreList = document.getElementById("winner-final-score");
  scoreList.replaceChildren();
  config.groups.forEach((group) => {
    const item = document.createElement("div");
    item.style.setProperty("--group-color", group.color);
    const name = document.createElement("span");
    name.textContent = group.name;
    const score = document.createElement("strong");
    score.textContent = scores[group.id];
    item.append(name, score);
    scoreList.appendChild(item);
  });

  const modal = document.getElementById("winner-modal");
  modal.hidden = false;
  document.body.classList.add("modal-open");
  document.getElementById("continue-game").focus();
}

function closeWinnerModal() {
  document.getElementById("winner-modal").hidden = true;
  document.body.classList.remove("modal-open");
}

function showLoadError(message, canRetry) {
  loadTitle.textContent = "Challenges are unavailable";
  loadMessage.textContent = message;
  retryLoad.hidden = !canRetry;
  loadHome.hidden = false;
}

async function loadQuestions() {
  loadStatus.hidden = false;
  loadTitle.textContent = "Loading challenges...";
  loadMessage.textContent = "Your next challenge is on its way.";
  retryLoad.hidden = true;
  loadHome.hidden = true;
  if (window.location.protocol === "file:") {
    showLoadError("Please use the quiz website link shared by your host to play.", false);
    return;
  }

  try {
    const response = await fetch("./db.json");
    if (!response.ok) throw new Error(`Unable to load db.json (HTTP ${response.status}).`);
    const data = await response.json();
    if (
      !Array.isArray(data.questions) ||
      !data.questions.length ||
      !data.questions.every(
        (item) =>
          item &&
          item.id != null &&
          ["question", "answer", "explanation"].every(
            (key) => typeof item[key] === "string" && item[key].trim()
          )
      ) ||
      new Set(data.questions.map((item) => String(item.id))).size !== data.questions.length
    ) {
      throw new Error("db.json must contain unique question IDs plus question, answer, and explanation text.");
    }

    const questionsById = new Map(
      data.questions.map((question) => [String(question.id), question])
    );
    const savedQuestions = questionOrder
      .filter((id) => questionsById.has(id))
      .map((id) => questionsById.get(id));
    const savedIds = new Set(savedQuestions.map((question) => String(question.id)));
    const newQuestions = shuffleArray(
      data.questions.filter((question) => !savedIds.has(String(question.id)))
    );
    questionData = [...savedQuestions, ...newQuestions];
    questionOrder = questionData.map((question) => String(question.id));
    usedQuestionIds = new Set(
      [...usedQuestionIds].filter((id) => questionsById.has(id))
    );
    const validGroupIds = new Set(config?.groups.map((group) => group.id) || []);
    answeredByGroup = Object.fromEntries(
      Object.entries(answeredByGroup).filter(
        ([questionId, groupId]) =>
          questionsById.has(questionId) && validGroupIds.has(groupId)
      )
    );
    if (config) saveGame();
    renderGrid(questionData);
    loadStatus.hidden = true;
  } catch (error) {
    console.error("Failed to load challenges:", error);
    showLoadError("We couldn’t load the challenges. Please try again in a moment.", true);
  }
}

function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}

function renderGrid(questions) {
  grid.replaceChildren();
  questions.forEach((question, index) => {
    const button = document.createElement("button");
    button.className = "question-btn";
    button.textContent = index + 1;
    button.dataset.index = index;
    button.disabled = usedQuestionIds.has(String(question.id));
    const assignedGroup = config?.groups.find(
      (group) => group.id === answeredByGroup[String(question.id)]
    );
    if (assignedGroup) applyAnsweredStyle(button, assignedGroup);
    button.onclick = () => handleQuestionClick(button);
    grid.appendChild(button);
  });
}

function applyAnsweredStyle(button, group) {
  if (!button || !group) return;
  button.classList.add("answered");
  button.style.setProperty("--answered-color", group.color);
  button.title = `Answered by ${group.name}`;
  button.setAttribute("aria-label", `Challenge ${button.textContent}, answered by ${group.name}`);
}

function handleQuestionClick(button) {
  const index = button.dataset.index;
  const question = questionData[index];
  const questionId = String(question.id);
  if (preparing || activeQuestion || usedQuestionIds.has(questionId)) return;
  preparing = true;
  usedQuestionIds.add(questionId);
  saveGame();
  button.disabled = true;
  activeQuestion = question;
  activeQuestionButton = button;
  roundGraded = false;
  answerPanel.hidden = true;
  gradingControls.hidden = true;
  document.getElementById("answer-text").textContent = "";
  document.getElementById("answer-explanation").textContent = "";
  revealBtn.hidden = false;
  revealBtn.setAttribute("aria-expanded", "false");
  backBtn.disabled = false;
  backBtn.textContent = "🔙 Back to Challenges";
  roundStatus.textContent = `${activeGroup().name}, discuss your answer before revealing it.`;
  questionNumberEl.textContent = Number(index) + 1;
  questionText.textContent = question.question;

  showPreloader(() => {
    preparing = false;
    grid.style.display = "none";
    questionBox.style.display = "block";
    startCountdown(config.questionTime, () => {
      roundStatus.textContent = "Time’s up! Click Show answer when you’re ready.";
    });
  });
}

function startCountdown(duration, callback) {
  clearInterval(timer);
  const endTime = Date.now() + duration * 1000;
  countdown.textContent = duration;
  timer = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    countdown.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(timer);
      callback?.();
    }
  }, 250);
}

function showPreloader(callback) {
  const preloader = document.getElementById("preloader");
  const preloaderCount = document.getElementById("preloader-count");
  let count = 3;
  preloader.style.display = "flex";
  preloaderCount.textContent = count;
  const interval = setInterval(() => {
    count -= 1;
    if (count === 0) {
      clearInterval(interval);
      preloader.style.display = "none";
      callback();
    } else {
      preloaderCount.textContent = count;
    }
  }, 1000);
}

revealBtn.onclick = () => {
  if (!activeQuestion || !answerPanel.hidden) return;
  clearInterval(timer);
  document.getElementById("answer-text").textContent = activeQuestion.answer;
  document.getElementById("answer-explanation").textContent = activeQuestion.explanation;
  answerPanel.hidden = false;
  gradingControls.hidden = false;
  gradingGroup.textContent = activeGroup().name;
  backBtn.disabled = true;
  backBtn.textContent = "Choose Correct or Incorrect";
  revealBtn.setAttribute("aria-expanded", "true");
  revealBtn.hidden = true;
  roundStatus.textContent = "Answer revealed. Grade the group’s answer.";
  answerPanel.focus();
};

correctBtn.onclick = () => gradeAnswer(true);
incorrectBtn.onclick = () => gradeAnswer(false);
retryLoad.onclick = loadQuestions;

resetGameBtn.onclick = () => {
  if (!window.confirm("Clear this game and create a new group setup?")) return;
  clearGame();
};

document.getElementById("continue-game").onclick = closeWinnerModal;
document.getElementById("new-game").onclick = clearGame;

backBtn.onclick = () => {
  if (backBtn.disabled) return;
  if (!roundGraded && activeQuestionButton) {
    usedQuestionIds.delete(String(activeQuestion.id));
    saveGame();
    activeQuestionButton.disabled = false;
  }
  questionBox.style.display = "none";
  grid.style.display = "grid";
  clearInterval(timer);
  activeQuestion = null;
  activeQuestionButton = null;
  answerPanel.hidden = true;
  gradingControls.hidden = true;
  backBtn.textContent = "🔙 Back to Challenges";
};

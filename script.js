/* ==========================================================
   Habit Tracker - 로직
   ------------------------------------------------------------
   [동작 순서]
   1. 페이지가 열리면 localStorage에서 데이터를 읽어옵니다.
   2. 화면(진행률 / 목록)을 그립니다.
   3. 사용자의 조작(추가, 체크, 삭제, 필터)을 처리하고 다시 저장합니다.
   ========================================================== */

/* localStorage에 데이터를 저장할 때 쓰는 키 이름 */
const STORAGE_KEY = 'habitTracker.habits.v1';

/* 화면에 그릴 DOM 요소를 미리 찾아서 변수에 담아둡니다. */
const habitForm = document.getElementById('habitForm');
const habitInput = document.getElementById('habitInput');
const habitList = document.getElementById('habitList');
const emptyState = document.getElementById('emptyState');
const emptyText = document.getElementById('emptyText');
const listCount = document.getElementById('listCount');
const doneCount = document.getElementById('doneCount');
const totalCount = document.getElementById('totalCount');
const percentEl = document.getElementById('percent');
const progressFill = document.getElementById('progressFill');
const progress = document.getElementById('progress');
const filters = document.getElementById('filters');
const clearAllBtn = document.getElementById('clearAllBtn');
const todayDateEl = document.getElementById('todayDate');

/* 앱 전체 상태(데이터)를 담는 배열 */
let habits = [];
/* 현재 선택된 필터: 'all' | 'done' | 'todo' */
let currentFilter = 'all';

/* ==========================================================
   1. 날짜 관련 함수
   ========================================================== */

/**
 * Date 객체를 'YYYY-MM-DD' 형태의 문자열로 바꿔줍니다.
 * (예: 2026-10-22)
 * toISOString()은 UTC 기준이라 시차 때문에 날짜가 밀릴 수 있어서
 * 브라우저의 현지 시간을 직접 조합해 줍니다.
 */
function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // 10 -> '10'
  const day = String(date.getDate()).padStart(2, '0');        //  2 -> '02'
  return `${year}-${month}-${day}`;
}

/* 오늘 날짜 키 (예: '2026-10-22') */
function getTodayKey() {
  return getDateKey(new Date());
}

/* 화면 상단에 "2026년 10월 22일 목요일" 형태로 표시 */
function showTodayDate() {
  const text = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }).format(new Date());

  todayDateEl.textContent = text;
}

/* ==========================================================
   2. localStorage 저장 / 불러오기
   ========================================================== */

/** 저장된 습관 목록을 읽어옵니다. 문제가 있으면 빈 배열로 시작합니다. */
function loadHabits() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];            // 아직 저장된 게 없는 경우
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    // 혹시 이전에 저장된 데이터 형태가 달라져도 앱이 멈추지 않도록
    // 꼭 필요한 값들을 기본값으로 채워 넣습니다.
    return parsed.map((habit, index) => ({
      id: habit.id || 'habit-' + index,
      name: habit.name || '이름 없는 습관',
      createdAt: habit.createdAt || getTodayKey(),
      completions: habit.completions || {}
    }));
  } catch (error) {
    // 브라우저 설정을 꺼놨거나 JSON이 깨진 경우에도 앱이 죽지 않게 합니다.
    console.warn('저장된 습관 데이터를 읽지 못했습니다.', error);
    return [];
  }
}

/** 현재 habits 배열을 localStorage에 JSON 문자열로 저장합니다. */
function saveHabits() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  } catch (error) {
    console.warn('습관 데이터를 저장하지 못했습니다.', error);
    alert('데이터를 저장하지 못했습니다. 브라우저의 저장 공간 제한을 확인해 주세요.');
  }
}

/* ==========================================================
   3. 데이터 계산
   ========================================================== */

/** 오늘 완료한 습관 개수를 셉니다. */
function getDoneCount() {
  const today = getTodayKey();
  return habits.filter((habit) => habit.completions[today]).length;
}

/**
 * 연속으로 완료한 일수를 계산합니다.
 * 오늘 완료했다면 오늘부터, 아직 하지 않았다면 어제부터 세어
 * 하루가 다 지나기 전까지 연속 기록이 끊기지 않게 합니다.
 */
function getStreak(habit) {
  const today = new Date();
  let streak = 0;
  let cursor = new Date(today);

  // 오늘을 완료하지 않았다면 어제 날짜부터 세기 시작합니다.
  if (!habit.completions[getDateKey(cursor)]) {
    cursor.setDate(cursor.getDate() - 1);
  }

  // 연속으로 체크된 날짜가 있는 동안 하루씩 거슬러 올라갑니다.
  while (habit.completions[getDateKey(cursor)]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/* ==========================================================
   4. 화면 그리기
   ========================================================== */

/** 진행률 카드(완료 개수 / 전체 개수 / 달성률 / 진행 바)를 갱신합니다. */
function renderStats() {
  const done = getDoneCount();
  const total = habits.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  doneCount.textContent = done;
  totalCount.textContent = total;
  percentEl.textContent = percent + '%';
  progressFill.style.width = percent + '%';
  progress.setAttribute('aria-valuenow', percent);
}

/** 현재 필터에 맞는 습관만 골라서 목록을 그립니다. */
function renderList() {
  const today = getTodayKey();

  // 필터에 맞는 습관만 걸러냅니다.
  const visible = habits.filter((habit) => {
    const isDone = Boolean(habit.completions[today]);
    if (currentFilter === 'done') return isDone;
    if (currentFilter === 'todo') return !isDone;
    return true;
  });

  // 목록을 그리기 전에 기존 내용을 모두 지웁니다.
  habitList.textContent = '';

  visible.forEach((habit) => {
    const isDone = Boolean(habit.completions[today]);

    // --- li: 습관 한 개를 담는 카드 ---
    const item = document.createElement('li');
    item.className = 'habit-item' + (isDone ? ' is-done' : '');
    item.dataset.id = habit.id;

    // --- 체크박스 (label + input + 모양용 span) ---
    const label = document.createElement('label');
    label.className = 'check';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isDone;
    checkbox.setAttribute('aria-label', habit.name + ' 완료');
    // change 이벤트는 아래에서 한 번에 처리하기 위해 값을 직접 넣습니다.
    checkbox.dataset.id = habit.id;

    const box = document.createElement('span');
    box.className = 'check-box';

    label.appendChild(checkbox);
    label.appendChild(box);

    // --- 습관 이름 / 부가 정보 ---
    const body = document.createElement('div');
    body.className = 'habit-body';

    const name = document.createElement('p');
    name.className = 'habit-name';
    // textContent를 사용하면 이름에 HTML이 들어가도 그대로 글자로만 보입니다.
    name.textContent = habit.name;

    const meta = document.createElement('p');
    meta.className = 'habit-meta';

    const streak = getStreak(habit);
    const totalDone = Object.keys(habit.completions).length;
    meta.textContent = streak > 0
      ? `연속 ${streak}일 · 총 ${totalDone}회 완료`
      : `총 ${totalDone}회 완료`;

    body.appendChild(name);
    body.appendChild(meta);

    // --- 삭제 버튼 ---
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.dataset.id = habit.id;
    deleteBtn.setAttribute('aria-label', habit.name + ' 삭제');
    // SVG 아이콘은 정해진 문자열이므로 innerHTML로 넣어도 안전합니다.
    deleteBtn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12l-.9 12.1a2 2 0 0 1-2 1.9H8.9a2 2 0 0 1-2-1.9L6 7Zm3-3h6l1 1.5H8L9 4Zm-3.5 3h15v1.8h-15V7Z"/></svg>';

    item.appendChild(label);
    item.appendChild(body);
    item.appendChild(deleteBtn);

    habitList.appendChild(item);
  });

  // 목록 개수 배지 갱신
  listCount.textContent = habits.length;

  // 목록이 비어 있으면 빈 상태 메시지를 보여줍니다.
  if (visible.length === 0) {
    emptyState.hidden = false;
    emptyText.textContent = habits.length === 0
      ? '아직 습관이 없어요. 위에서 첫 번째 습관을 추가해 보세요!'
      : (currentFilter === 'done' ? '완료한 습관이 아직 없어요.' : '모든 습관을 완료했어요! 🎉');
  } else {
    emptyState.hidden = true;
  }
}

/** 진행률과 목록을 한 번에 갱신합니다. */
function renderAll() {
  renderStats();
  renderList();
}

/* ==========================================================
   5. 사용자의 동작 처리
   ========================================================== */

/** 습관 추가 (form submit 이벤트) */
function addHabit(event) {
  event.preventDefault();          // 엔터를 눌러도 페이지가 새로고침되지 않게
  const name = habitInput.value.trim();   // 앞뒤 공백 제거

  if (name === '') {
    habitInput.focus();
    return;
  }

  // 새 습관 객체. completions는 '날짜': true 형태로 체크 기록을 저장합니다.
  habits.push({
    id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
    name: name,
    createdAt: getTodayKey(),
    completions: {}
  });

  saveHabits();
  renderAll();

  habitInput.value = '';
  habitInput.focus();              // 바로 다음 습관을 입력할 수 있게
}

/** 오늘 완료 여부 토글 (체크박스 change 이벤트) */
function toggleHabit(id) {
  const habit = habits.find((item) => item.id === id);
  if (!habit) return;

  const today = getTodayKey();

  if (habit.completions[today]) {
    delete habit.completions[today];   // 체크 해제
  } else {
    habit.completions[today] = true;   // 체크 완료
  }

  saveHabits();
  renderAll();
}

/** 습관 삭제 */
function deleteHabit(id) {
  const index = habits.findIndex((item) => item.id === id);
  if (index === -1) return;

  const habit = habits[index];
  const ok = confirm(`'${habit.name}' 습관을 삭제할까요?`);
  if (!ok) return;

  habits.splice(index, 1);   // 해당 항목을 배열에서 제거
  saveHabits();
  renderAll();
}

/** 필터 버튼 (전체 / 완료 / 미완료) */
function setFilter(filter) {
  currentFilter = filter;

  // 선택된 버튼만 활성화 상태로 바꿉니다.
  filters.querySelectorAll('.filter-btn').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.filter === filter);
  });

  renderList();
}

/* ==========================================================
   6. 이벤트 연결
   ========================================================== */

// 습관 추가
habitForm.addEventListener('submit', addHabit);

// 목록 안에서 일어난 체크/삭제를 한 곳에서 처리합니다(이벤트 위임).
habitList.addEventListener('change', (event) => {
  if (event.target.matches('input[type="checkbox"]')) {
    toggleHabit(event.target.dataset.id);
  }
});

habitList.addEventListener('click', (event) => {
  const button = event.target.closest('.delete-btn');
  if (button) {
    deleteHabit(button.dataset.id);
  }
});

// 필터 버튼
filters.addEventListener('click', (event) => {
  const button = event.target.closest('.filter-btn');
  if (button) {
    setFilter(button.dataset.filter);
  }
});

// 입력창에서 Esc를 누르면 내용을 지웁니다.
habitInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    habitInput.value = '';
    habitInput.focus();
  }
});

// 전체 삭제
clearAllBtn.addEventListener('click', () => {
  if (habits.length === 0) return;
  if (!confirm('모든 습관을 삭제할까요? 되돌릴 수 없습니다.')) return;

  habits = [];
  saveHabits();
  renderAll();
});

/* ==========================================================
   7. 앱 시작
   ========================================================== */

showTodayDate();       // 오늘 날짜 표시
habits = loadHabits();  // 저장된 데이터 불러오기
renderAll();           // 화면 그리기

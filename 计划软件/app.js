const storeKey = "pipicat-life-planner-v1";
const cloudConfigKey = "pipicat-supabase-config-v1";

const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
const defaultState = {
  settings: {
    targetWorkouts: 4,
    targetWater: 6,
    reviewTime: "21:30"
  },
  tasks: [
    { id: "t1", title: "完成今日训练", type: "workout", meta: "40 分钟力量或有氧", done: false },
    { id: "t2", title: "记录三餐", type: "meal", meta: "计划和实际都写一下", done: false },
    { id: "t3", title: "晚间复盘", type: "review", meta: "1 分钟总结今天", done: false }
  ],
  workouts: [
    { day: 1, title: "上肢力量", detail: "推、拉、核心，各 3 组", done: false },
    { day: 3, title: "有氧 + 核心", detail: "慢跑 30 分钟，平板支撑", done: false },
    { day: 5, title: "下肢力量", detail: "深蹲、硬拉、臀桥", done: false },
    { day: 0, title: "拉伸恢复", detail: "全身拉伸 20 分钟", done: false }
  ],
  meals: [
    { name: "早餐", plan: "鸡蛋、牛奶、燕麦", actual: "", tags: [] },
    { name: "午餐", plan: "米饭、鸡胸肉、青菜", actual: "", tags: [] },
    { name: "晚餐", plan: "鱼肉、蔬菜、少量主食", actual: "", tags: [] },
    { name: "饮水", plan: "6 杯水", actual: "", tags: [] }
  ],
  logs: [
    {
      id: "l1",
      type: "心情",
      mood: "🙂",
      text: "第一天开始，先不用完美，能记录下来就算赢。",
      createdAt: new Date().toISOString()
    }
  ],
  reviews: []
};

let state = loadState();
let activeModalType = "life";
let cloud = {
  client: null,
  user: null,
  syncTimer: null
};

function loadState() {
  const raw = localStorage.getItem(storeKey);
  if (!raw) return structuredClone(defaultState);
  try {
    return { ...structuredClone(defaultState), ...JSON.parse(raw) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storeKey, JSON.stringify(state));
  queueCloudSave();
}

function loadCloudConfig() {
  try {
    return JSON.parse(localStorage.getItem(cloudConfigKey)) || { url: "", anonKey: "" };
  } catch {
    return { url: "", anonKey: "" };
  }
}

function saveCloudConfig(config) {
  localStorage.setItem(cloudConfigKey, JSON.stringify(config));
}

async function initCloud() {
  const config = loadCloudConfig();
  if (!config.url || !config.anonKey || !window.supabase) {
    renderCloudStatus("未配置 Supabase，当前使用本地保存。");
    return;
  }
  cloud.client = window.supabase.createClient(config.url, config.anonKey);
  const { data } = await cloud.client.auth.getUser();
  cloud.user = data.user || null;
  renderCloudStatus(cloud.user ? `已登录：${cloud.user.email}` : "Supabase 已配置，请登录或注册。");
  if (cloud.user) await loadCloudState();
}

async function loadCloudState() {
  if (!cloud.client || !cloud.user) return;
  const { data, error } = await cloud.client
    .from("pipicat_profiles")
    .select("app_state")
    .eq("user_id", cloud.user.id)
    .maybeSingle();
  if (error) {
    renderCloudStatus(`云端读取失败：${error.message}`);
    return;
  }
  if (data?.app_state) {
    state = { ...structuredClone(defaultState), ...data.app_state };
    localStorage.setItem(storeKey, JSON.stringify(state));
    render();
  } else {
    await saveCloudState();
  }
}

function queueCloudSave() {
  if (!cloud.client || !cloud.user) return;
  clearTimeout(cloud.syncTimer);
  cloud.syncTimer = setTimeout(saveCloudState, 450);
}

async function saveCloudState() {
  if (!cloud.client || !cloud.user) return;
  const { error } = await cloud.client.from("pipicat_profiles").upsert({
    user_id: cloud.user.id,
    app_state: state,
    updated_at: new Date().toISOString()
  });
  renderCloudStatus(error ? `云端同步失败：${error.message}` : `已云同步：${cloud.user.email}`);
}

function renderCloudStatus(text) {
  const el = document.querySelector("#cloudStatus");
  if (el) el.textContent = text;
}

function todayLabel() {
  const now = new Date();
  return `${now.getMonth() + 1}月${now.getDate()}日 周${weekdays[now.getDay()]}`;
}

function weekRangeLabel() {
  const now = new Date();
  const start = new Date(now);
  const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
  start.setDate(now.getDate() + diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
}

function render() {
  document.querySelector("#todayDate").textContent = todayLabel();
  document.querySelector("#weekRange").textContent = weekRangeLabel();
  renderToday();
  renderMeals();
  renderTimeline();
  renderPlan();
  renderStats();
  renderSettings();
}

function renderToday() {
  const done = state.tasks.filter((task) => task.done).length;
  const total = state.tasks.length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  document.querySelector("#todayPercent").textContent = `${percent}%`;
  document.querySelector("#progressFill").style.width = `${percent}%`;
  document.querySelector("#taskCount").textContent = `${done}/${total} 项`;
  document.querySelector("#catLine").textContent = catMessage(percent);

  const list = document.querySelector("#taskList");
  list.innerHTML = "";
  state.tasks.forEach((task) => {
    const item = document.createElement("article");
    item.className = `task-item${task.done ? " done" : ""}`;
    item.innerHTML = `
      <button class="check" type="button" aria-label="切换完成状态"></button>
      <div>
        <span class="task-title">${escapeHtml(task.title)}</span>
        <p class="task-meta">${escapeHtml(task.meta)}</p>
      </div>
      <span class="tag ${task.type}">${taskTypeName(task.type)}</span>
    `;
    item.querySelector(".check").addEventListener("click", () => {
      task.done = !task.done;
      saveState();
      render();
    });
    list.append(item);
  });
}

function catMessage(percent) {
  if (percent === 100) return "今天很稳，皮皮猫批准你骄傲 30 秒。";
  if (percent >= 67) return "差一点就收工了，别把尾巴留到明天。";
  if (percent >= 34) return "已经动起来了，再完成一个小任务。";
  return "今天先完成一个小动作，皮皮猫盯着呢。";
}

function taskTypeName(type) {
  return { workout: "训练", meal: "饮食", review: "复盘" }[type] || "事项";
}

function renderMeals() {
  const grid = document.querySelector("#mealGrid");
  grid.innerHTML = "";
  const recorded = state.meals.filter((meal) => meal.actual.trim()).length;
  document.querySelector("#mealScore").textContent = recorded ? `${recorded}/4 已记录` : "未记录";

  state.meals.forEach((meal) => {
    const card = document.createElement("article");
    card.className = "meal-card";
    card.innerHTML = `
      <span>${escapeHtml(meal.name)}</span>
      <strong>${escapeHtml(meal.actual || meal.plan)}</strong>
      <span>${meal.actual ? "实际记录" : "计划"}</span>
    `;
    grid.append(card);
  });
}

function renderTimeline() {
  const timeline = document.querySelector("#timeline");
  timeline.innerHTML = "";
  if (!state.logs.length) {
    timeline.innerHTML = `<p class="empty">还没有生活记录。</p>`;
    return;
  }
  [...state.logs]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((log) => {
      const item = document.createElement("article");
      item.className = "timeline-item";
      item.innerHTML = `
        <header>
          <strong>${escapeHtml(log.mood || "📝")} ${escapeHtml(log.type)}</strong>
          <time>${formatTime(log.createdAt)}</time>
        </header>
        <p>${escapeHtml(log.text)}</p>
      `;
      timeline.append(item);
    });
}

function renderPlan() {
  const list = document.querySelector("#weekList");
  list.innerHTML = "";
  const done = state.workouts.filter((workout) => workout.done).length;
  document.querySelector("#workoutWeekStatus").textContent = `${done}/${state.settings.targetWorkouts}`;

  state.workouts.forEach((workout) => {
    const item = document.createElement("article");
    item.className = "week-item";
    item.innerHTML = `
      <span class="day">周${weekdays[workout.day]}</span>
      <div>
        <strong>${escapeHtml(workout.title)}</strong>
        <p class="task-meta">${escapeHtml(workout.detail)}</p>
      </div>
      <button class="check" type="button" aria-label="切换训练完成状态"></button>
    `;
    if (workout.done) item.classList.add("task-item", "done");
    item.querySelector(".check").addEventListener("click", () => {
      workout.done = !workout.done;
      saveState();
      render();
    });
    list.append(item);
  });

  const mealsWithProtein = state.meals.filter((meal) => meal.tags.includes("protein")).length;
  const mealsWithVeggie = state.meals.filter((meal) => meal.tags.includes("veggie")).length;
  const waterDone = state.meals.some((meal) => meal.name === "饮水" && meal.actual.trim()) ? 1 : 0;
  document.querySelector("#proteinDays").textContent = `${mealsWithProtein} 餐`;
  document.querySelector("#veggieDays").textContent = `${mealsWithVeggie} 餐`;
  document.querySelector("#waterDays").textContent = `${waterDone} 天`;
}

function renderStats() {
  const workoutsDone = state.workouts.filter((workout) => workout.done).length;
  const mealDone = state.meals.filter((meal) => meal.actual.trim()).length;
  document.querySelector("#statLogs").textContent = state.logs.length;
  document.querySelector("#statWorkouts").textContent = workoutsDone;
  document.querySelector("#statMeals").textContent = mealDone;
  document.querySelector("#statReviews").textContent = state.reviews.length;
  document.querySelector("#weeklySummary").textContent = summaryText(workoutsDone, mealDone);

  const strip = document.querySelector("#moodStrip");
  strip.innerHTML = "";
  const moods = state.logs.slice(-7).map((log) => log.mood || "·");
  while (moods.length < 7) moods.unshift("·");
  moods.forEach((mood) => {
    const dot = document.createElement("span");
    dot.className = "mood-dot";
    dot.textContent = mood;
    strip.append(dot);
  });
}

function summaryText(workoutsDone, mealDone) {
  if (!state.logs.length && !workoutsDone && !mealDone) return "开始记录后，这里会自动生成你的本周趋势。";
  const training = workoutsDone >= state.settings.targetWorkouts ? "训练目标已经达成" : `训练完成 ${workoutsDone} 次`;
  const food = mealDone >= 3 ? "饮食记录比较完整" : "饮食记录还可以更连续";
  const review = state.reviews.length ? "已经有复盘内容，可以继续积累规律。" : "今晚可以做一次 1 分钟复盘。";
  return `${training}，${food}。${review}`;
}

function renderSettings() {
  document.querySelector("#targetWorkouts").value = state.settings.targetWorkouts;
  document.querySelector("#targetWater").value = state.settings.targetWater;
  document.querySelector("#reviewTime").value = state.settings.reviewTime;
}

function openModal(type) {
  activeModalType = type;
  const modal = document.querySelector("#entryModal");
  const title = document.querySelector("#modalTitle");
  const fields = document.querySelector("#modalFields");
  const configs = {
    life: {
      title: "新增生活记录",
      html: `
        <label class="field">类型
          <select name="type">
            <option>心情</option><option>工作学习</option><option>运动</option><option>灵感</option><option>反思</option>
          </select>
        </label>
        <label class="field">心情
          <select name="mood">
            <option>🙂</option><option>😌</option><option>🔥</option><option>😮‍💨</option><option>😴</option>
          </select>
        </label>
        <label class="field">内容
          <textarea name="text" placeholder="记录此刻发生了什么"></textarea>
        </label>
      `
    },
    meal: {
      title: "记录饮食",
      html: `
        <label class="field">餐次
          <select name="meal">${state.meals.map((meal) => `<option>${meal.name}</option>`).join("")}</select>
        </label>
        <label class="field">实际吃了什么
          <textarea name="actual" placeholder="例如：鸡蛋、米饭、青菜"></textarea>
        </label>
        <label class="field">营养标签
          <select name="tag">
            <option value="">无</option><option value="protein">高蛋白</option><option value="veggie">有蔬菜</option><option value="sweet">甜食</option><option value="fried">油炸</option>
          </select>
        </label>
      `
    },
    workout: {
      title: "记录训练",
      html: `
        <label class="field">训练内容
          <input name="title" placeholder="例如：上肢力量 40 分钟" />
        </label>
        <label class="field">感受
          <select name="mood">
            <option>🔥</option><option>🙂</option><option>😮‍💨</option><option>😌</option>
          </select>
        </label>
        <label class="field">备注
          <textarea name="text" placeholder="动作、重量、组数或身体感觉"></textarea>
        </label>
      `
    },
    review: {
      title: "晚间复盘",
      html: `
        <label class="field">今天做得最好的一件事
          <textarea name="best"></textarea>
        </label>
        <label class="field">明天最重要的一件事
          <textarea name="next"></textarea>
        </label>
      `
    },
    plan: {
      title: "新增训练计划",
      html: `
        <label class="field">星期
          <select name="day">
            <option value="1">周一</option><option value="2">周二</option><option value="3">周三</option><option value="4">周四</option><option value="5">周五</option><option value="6">周六</option><option value="0">周日</option>
          </select>
        </label>
        <label class="field">计划名称
          <input name="title" placeholder="例如：肩背力量" />
        </label>
        <label class="field">细节
          <textarea name="detail" placeholder="动作、时长、强度"></textarea>
        </label>
      `
    },
    cloud: {
      title: "设置 Supabase",
      html: `
        <label class="field">Project URL
          <input name="url" value="${escapeHtml(loadCloudConfig().url)}" placeholder="https://xxxx.supabase.co" />
        </label>
        <label class="field">anon public key
          <textarea name="anonKey" placeholder="Supabase 项目的 anon public key">${escapeHtml(loadCloudConfig().anonKey)}</textarea>
        </label>
      `
    }
  };
  title.textContent = configs[type].title;
  fields.innerHTML = configs[type].html;
  modal.showModal();
}

async function handleModalSubmit(event) {
  event.preventDefault();
  const submitter = event.submitter;
  if (submitter?.value === "cancel") {
    document.querySelector("#entryModal").close();
    return;
  }
  const form = new FormData(event.currentTarget);
  const now = new Date().toISOString();
  if (activeModalType === "life") {
    state.logs.push({ id: crypto.randomUUID(), type: form.get("type"), mood: form.get("mood"), text: form.get("text") || "没有写内容", createdAt: now });
  }
  if (activeModalType === "meal") {
    const meal = state.meals.find((item) => item.name === form.get("meal"));
    if (meal) {
      meal.actual = form.get("actual") || "";
      meal.tags = form.get("tag") ? [form.get("tag")] : [];
      state.logs.push({ id: crypto.randomUUID(), type: "饮食", mood: "🍽️", text: `${meal.name}：${meal.actual || "已查看计划"}`, createdAt: now });
      const mealTask = state.tasks.find((task) => task.type === "meal");
      if (state.meals.filter((item) => item.actual.trim()).length >= 3 && mealTask) mealTask.done = true;
    }
  }
  if (activeModalType === "workout") {
    const title = form.get("title") || "完成训练";
    state.logs.push({ id: crypto.randomUUID(), type: "训练", mood: form.get("mood"), text: `${title}。${form.get("text") || ""}`.trim(), createdAt: now });
    const task = state.tasks.find((item) => item.type === "workout");
    if (task) task.done = true;
  }
  if (activeModalType === "review") {
    const text = `最好：${form.get("best") || "未填写"}。明天：${form.get("next") || "未填写"}。`;
    state.reviews.push({ id: crypto.randomUUID(), text, createdAt: now });
    state.logs.push({ id: crypto.randomUUID(), type: "复盘", mood: "🌙", text, createdAt: now });
    const task = state.tasks.find((item) => item.type === "review");
    if (task) task.done = true;
  }
  if (activeModalType === "plan") {
    state.workouts.push({ day: Number(form.get("day")), title: form.get("title") || "新训练", detail: form.get("detail") || "待补充", done: false });
  }
  if (activeModalType === "cloud") {
    saveCloudConfig({ url: String(form.get("url") || "").trim(), anonKey: String(form.get("anonKey") || "").trim() });
    document.querySelector("#entryModal").close();
    await initCloud();
    return;
  }
  saveState();
  document.querySelector("#entryModal").close();
  event.currentTarget.reset();
  render();
}

function formatTime(value) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#screen-${button.dataset.tab}`).classList.add("active");
  });
});

document.querySelectorAll("[data-open]").forEach((button) => {
  button.addEventListener("click", () => openModal(button.dataset.open));
});

document.querySelector("#entryForm").addEventListener("submit", handleModalSubmit);

document.querySelector("#settingsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.settings.targetWorkouts = Number(document.querySelector("#targetWorkouts").value) || 4;
  state.settings.targetWater = Number(document.querySelector("#targetWater").value) || 6;
  state.settings.reviewTime = document.querySelector("#reviewTime").value || "21:30";
  saveState();
  render();
});

document.querySelector("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const action = event.submitter?.dataset.authAction || "signin";
  if (!cloud.client) {
    renderCloudStatus("请先设置 Supabase Project URL 和 anon public key。");
    return;
  }
  const email = document.querySelector("#authEmail").value.trim();
  const password = document.querySelector("#authPassword").value;
  const request = action === "signup"
    ? cloud.client.auth.signUp({ email, password })
    : cloud.client.auth.signInWithPassword({ email, password });
  const { data, error } = await request;
  if (error) {
    renderCloudStatus(error.message);
    return;
  }
  cloud.user = data.user;
  renderCloudStatus(cloud.user ? `已登录：${cloud.user.email}` : "请检查邮箱完成注册确认。");
  if (cloud.user) await loadCloudState();
});

document.querySelector("#resetDemo").addEventListener("click", () => {
  state = structuredClone(defaultState);
  saveState();
  render();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

render();
initCloud();

"use strict";

const STORAGE_KEY = "math-recall-data-v1";
const THEME_KEY = "math-recall-theme";
const SUBJECTS = ["数学I", "数学A", "数学II", "数学B", "数学C"];
const LEVELS = [
  { value: 0, short: "未理解", label: "まったく分からない", color: "#d95750" },
  { value: 1, short: "かなり怪しい", label: "解説を見れば少し分かる", color: "#e78145" },
  { value: 2, short: "あと少し", label: "少し分かりそう", color: "#d0a02f" },
  { value: 3, short: "ヒントで解ける", label: "ヒントがあれば解ける", color: "#609a70" },
  { value: 4, short: "自力で解ける", label: "完全に自力で解けた", color: "#286b58" },
];

const isoDate = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
};
const daysBetween = (from, to) => Math.max(0, Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000));
const formatDate = (value, withYear = false) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("ja-JP", { ...(withYear && { year: "numeric" }), month: "numeric", day: "numeric" }).format(date);
};

/**
 * 理解度だけでなく、経過日数・連続成功・失敗傾向を加味する軽量な間隔反復。
 * UIや保存処理から独立しているため、将来FSRS等へ差し替えられます。
 */
function calculateReviewSchedule(problem, newLevel, reviewDate = isoDate()) {
  const history = problem.history || [];
  const previousLevel = history.length ? history[history.length - 1].level : problem.currentLevel;
  const lastDate = problem.lastReviewed || problem.createdAt || reviewDate;
  const elapsedDays = Math.max(1, daysBetween(lastDate, reviewDate));
  const lowRecent = [...history.slice(-4).map((entry) => entry.level), newLevel].filter((level) => level <= 2).length;
  const everMastered = history.some((entry) => entry.level === 4) || previousLevel === 4;
  const forgot = everMastered && newLevel <= 1;
  const dropped = Number.isFinite(previousLevel) && previousLevel - newLevel >= 2;
  const successStreak = newLevel >= 3 ? (problem.successStreak || 0) + 1 : 0;
  const previousInterval = Math.max(1, problem.intervalDays || elapsedDays);
  let interval;

  if (newLevel === 0) interval = 1;
  if (newLevel === 1) interval = lowRecent >= 3 ? 1 : 2;
  if (newLevel === 2) interval = Math.min(4, 2 + Math.floor(successStreak / 2) + (elapsedDays >= previousInterval ? 1 : 0));
  if (newLevel === 3) interval = Math.min(10, Math.max(5, Math.round(previousInterval * 1.45) + successStreak));
  if (newLevel === 4) {
    const masterySteps = [7, 14, 30, 60, 90, 120];
    interval = masterySteps[Math.min(successStreak - 1, masterySteps.length - 1)];
    if (elapsedDays > previousInterval * 1.5 && previousLevel >= 3) interval = Math.round(interval * 1.15);
  }
  if (forgot) interval = 1;
  else if (dropped) interval = Math.max(1, Math.ceil(interval * 0.45));
  if (lowRecent >= 4) interval = Math.min(interval, 2);

  return { intervalDays: Math.max(1, interval), nextReview: addDays(reviewDate, Math.max(1, interval)), successStreak, forgot };
}

function assessDifficulty(problem) {
  const levels = (problem.history || []).map((item) => item.level);
  const recent = levels.slice(-5);
  const repeatedLow = recent.filter((level) => level <= 2).length >= 3;
  const severeDrop = levels.some((level, index) => level <= 1 && levels.slice(0, index).includes(4));
  const unstable = (problem.reviewCount || levels.length) >= 6 && new Set(recent).size >= 3 && recent.some((level) => level <= 2);
  const rootGap = levels.slice(-4).filter((level) => level <= 1).length >= 3 || ((problem.reviewCount || 0) >= 5 && recent.filter((level) => level <= 2).length >= 4);
  return { weak: repeatedLow || severeDrop || unstable, rootGap };
}

function normalizeProblem(raw) {
  const history = Array.isArray(raw.history) ? raw.history.filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date) && Number.isInteger(item.level) && item.level >= 0 && item.level <= 4) : [];
  const currentLevel = Number.isInteger(raw.currentLevel) ? Math.min(4, Math.max(0, raw.currentLevel)) : (history.at(-1)?.level ?? 0);
  return { id: String(raw.id || `p-${Date.now()}-${Math.random().toString(16).slice(2)}`), material: String(raw.material || "名称未設定"), number: String(raw.number || "—"), title: String(raw.title || "タイトル未設定"), subject: SUBJECTS.includes(raw.subject) ? raw.subject : "数学I", unit: String(raw.unit || "未分類"), notes: String(raw.notes || ""), createdAt: raw.createdAt || isoDate(), lastReviewed: raw.lastReviewed || history.at(-1)?.date || null, nextReview: raw.nextReview || isoDate(), reviewCount: Number.isInteger(raw.reviewCount) ? raw.reviewCount : history.length, successStreak: Number.isInteger(raw.successStreak) ? raw.successStreak : 0, currentLevel, intervalDays: Math.max(1, Number(raw.intervalDays) || 1), history };
}

const SAMPLE_PROBLEMS = [
  { material:"青チャート",number:"例題 42",title:"二次関数の最大・最小",subject:"数学I",unit:"二次関数",notes:"平方完成の後、定義域の端点を忘れずに確認する。",createdAt:addDays(isoDate(),-12),lastReviewed:addDays(isoDate(),-2),nextReview:isoDate(),reviewCount:3,successStreak:2,currentLevel:3,intervalDays:2,history:[{date:addDays(isoDate(),-12),level:1},{date:addDays(isoDate(),-7),level:2},{date:addDays(isoDate(),-2),level:3}] },
  { material:"Focus Gold",number:"123",title:"場合の数と円順列",subject:"数学A",unit:"場合の数",notes:"回転を同一視する理由を説明できるようにする。",createdAt:addDays(isoDate(),-18),lastReviewed:addDays(isoDate(),-5),nextReview:addDays(isoDate(),-1),reviewCount:5,successStreak:0,currentLevel:1,intervalDays:3,history:[{date:addDays(isoDate(),-18),level:0},{date:addDays(isoDate(),-14),level:1},{date:addDays(isoDate(),-10),level:2},{date:addDays(isoDate(),-7),level:1},{date:addDays(isoDate(),-5),level:1}] },
  { material:"4STEP",number:"問 78",title:"ベクトルの内積",subject:"数学C",unit:"平面ベクトル",notes:"成分表示と図形的意味を結びつける。",createdAt:addDays(isoDate(),-30),lastReviewed:addDays(isoDate(),-8),nextReview:addDays(isoDate(),6),reviewCount:4,successStreak:3,currentLevel:4,intervalDays:14,history:[{date:addDays(isoDate(),-30),level:2},{date:addDays(isoDate(),-22),level:3},{date:addDays(isoDate(),-15),level:4},{date:addDays(isoDate(),-8),level:4}] },
  { material:"基礎問題精講",number:"例題 65",title:"三角関数の合成",subject:"数学II",unit:"三角関数",notes:"係数から補助角を求める箇所を再確認。",createdAt:addDays(isoDate(),-8),lastReviewed:addDays(isoDate(),-3),nextReview:addDays(isoDate(),2),reviewCount:2,successStreak:1,currentLevel:3,intervalDays:5,history:[{date:addDays(isoDate(),-8),level:2},{date:addDays(isoDate(),-3),level:3}] },
];

let state = { problems: [] };
let activeReviewId = null;
const $ = (selector) => document.querySelector(selector);

function loadState() { try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)); state.problems = Array.isArray(parsed?.problems) ? parsed.problems.map(normalizeProblem) : []; } catch { state.problems = []; } }
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), problems: state.problems })); }
function levelInfo(level) { return LEVELS[level] || LEVELS[0]; }
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}
function isOverdue(problem) { return problem.nextReview < isoDate(); }
function isToday(problem) { return problem.nextReview === isoDate(); }
function dueProblems() { return state.problems.filter((problem) => problem.nextReview <= isoDate()).sort((a,b) => a.nextReview.localeCompare(b.nextReview) || Number(assessDifficulty(b).weak) - Number(assessDifficulty(a).weak)); }

function render() {
  const due = dueProblems(); const overdue = state.problems.filter(isOverdue); const weak = state.problems.filter((p) => assessDifficulty(p).weak); const weekEnd = addDays(isoDate(), 7);
  $("#today-label").textContent = new Intl.DateTimeFormat("ja-JP", { year:"numeric",month:"long",day:"numeric",weekday:"long" }).format(new Date());
  $("#today-message").textContent = due.length ? `${due.length}問が待っています。短い時間でも、理解を一歩ずつ積み上げましょう。` : "今日の予定は完了です。先の問題を復習することもできます。";
  $("#metric-total").textContent=state.problems.length; $("#metric-today").textContent=state.problems.filter(isToday).length; $("#metric-overdue").textContent=overdue.length; $("#metric-weak").textContent=weak.length; $("#metric-week").textContent=state.problems.filter((p)=>p.nextReview>=isoDate()&&p.nextReview<=weekEnd).length;
  $("#due-count").textContent=`${due.length}問`; $("#start-review").disabled=!due.length;
  $("#due-list").innerHTML = due.length ? due.slice(0,5).map((p)=>dueCard(p)).join("") : `<div class="empty-state">今日の復習はありません。<br>新しい問題を登録して学習を始めましょう。</div>`;
  renderChart(); updateFilterOptions(); renderProblemList(); bindDynamicActions();
}
function dueCard(p) { const diff=assessDifficulty(p); return `<article class="due-card ${isOverdue(p)?"overdue":""}"><span class="status-bar"></span><div><div class="problem-title-line"><h3>${escapeHtml(p.title)}</h3>${diff.weak?'<span class="tag weak-tag">苦手</span>':""}${diff.rootGap?'<span class="tag root-tag">根本理解を確認</span>':""}</div><p>${escapeHtml(p.material)} · ${escapeHtml(p.number)} · ${escapeHtml(p.subject)} / ${escapeHtml(p.unit)}</p></div><div class="due-action"><span class="${isOverdue(p)?"overdue-text":""}">${isOverdue(p)?`${daysBetween(p.nextReview,isoDate())}日超過`:"今日"}</span><button class="small-button review" data-review="${p.id}">復習</button></div></article>`; }
function renderChart(){const counts=LEVELS.map((level)=>state.problems.filter((p)=>p.currentLevel===level.value).length);const max=Math.max(1,...counts);$("#mastery-chart").innerHTML=LEVELS.map((level,i)=>`<div class="chart-row"><span>Lv.${level.value} ${level.short}</span><div class="chart-track"><div class="chart-fill" style="width:${counts[i]/max*100}%;background:${level.color}"></div></div><strong>${counts[i]}</strong></div>`).join("");}
function updateFilterOptions(){const definitions=[["#filter-subject",SUBJECTS,"すべての科目"],["#filter-unit",[...new Set(state.problems.map(p=>p.unit))].sort(),"すべての単元"],["#filter-material",[...new Set(state.problems.map(p=>p.material))].sort(),"すべての教材"]];definitions.forEach(([selector,values,label])=>{const select=$(selector),current=select.value;select.innerHTML=`<option value="">${label}</option>`+values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");select.value=current;});if(!$("#filter-level").dataset.ready){$("#filter-level").innerHTML='<option value="">すべての理解度</option>'+LEVELS.map(l=>`<option value="${l.value}">Lv.${l.value} ${l.short}</option>`).join("");$("#filter-level").dataset.ready="1";}}
function filteredProblems(){const query=$("#search").value.trim().toLowerCase(),subject=$("#filter-subject").value,unit=$("#filter-unit").value,material=$("#filter-material").value,level=$("#filter-level").value,status=$("#filter-status").value;return state.problems.filter(p=>{const haystack=[p.material,p.number,p.title,p.unit,p.notes].join(" ").toLowerCase();return(!query||haystack.includes(query))&&(!subject||p.subject===subject)&&(!unit||p.unit===unit)&&(!material||p.material===material)&&(level===""||p.currentLevel===Number(level))&&(!status||(status==="weak"&&assessDifficulty(p).weak)||(status==="today"&&isToday(p))||(status==="overdue"&&isOverdue(p)));}).sort((a,b)=>Number(assessDifficulty(b).weak)-Number(assessDifficulty(a).weak)||a.nextReview.localeCompare(b.nextReview));}
function renderProblemList(){const list=filteredProblems();$("#problem-list").innerHTML=list.length?list.map(p=>{const info=levelInfo(p.currentLevel),diff=assessDifficulty(p);return `<article class="problem-row"><div><div class="problem-title-line"><h3>${escapeHtml(p.title)}</h3>${diff.weak?'<span class="tag weak-tag">苦手</span>':""}${diff.rootGap?'<span class="tag root-tag">根本理解不足の可能性</span>':""}</div><p>${escapeHtml(p.material)} · ${escapeHtml(p.number)}</p></div><p class="mobile-hide">${escapeHtml(p.subject)}<br>${escapeHtml(p.unit)}</p><span class="level-badge mobile-hide" style="color:${info.color}">Lv.${p.currentLevel}<br>${info.short}</span><p class="mobile-hide ${isOverdue(p)?"overdue-text":""}">次回<br>${formatDate(p.nextReview)}</p><div class="row-actions"><button class="small-button review" data-review="${p.id}">復習</button><button class="small-button" data-edit="${p.id}" aria-label="編集">編集</button><button class="small-button" data-delete="${p.id}" aria-label="削除">削除</button></div></article>`;}).join(""):'<div class="empty-state">条件に合う問題はありません。</div>';bindDynamicActions();}
function bindDynamicActions(){document.querySelectorAll("[data-review]").forEach(b=>b.onclick=()=>openReview(b.dataset.review));document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openProblemForm(b.dataset.edit));document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteProblem(b.dataset.delete));}

function openProblemForm(id=null){const p=id?state.problems.find(item=>item.id===id):null;$("#problem-form").reset();$("#form-title").textContent=p?"問題を編集":"問題を登録";$("#problem-id").value=p?.id||"";$("#material").value=p?.material||"";$("#number").value=p?.number||"";$("#title").value=p?.title||"";$("#subject").value=p?.subject||SUBJECTS[0];$("#unit").value=p?.unit||"";$("#notes").value=p?.notes||"";$("#created-date").value=p?.createdAt||isoDate();$("#initial-level").value=p?.currentLevel??0;$("#initial-level").disabled=Boolean(p);$("#problem-dialog").showModal();}
function submitProblem(event){event.preventDefault();const id=$("#problem-id").value,existing=state.problems.find(p=>p.id===id),level=Number($("#initial-level").value),created=$("#created-date").value;const base={material:$("#material").value.trim(),number:$("#number").value.trim(),title:$("#title").value.trim(),subject:$("#subject").value,unit:$("#unit").value.trim(),notes:$("#notes").value.trim(),createdAt:created};if(existing)Object.assign(existing,base);else{const schedule=calculateReviewSchedule({history:[],currentLevel:level,createdAt:created,successStreak:0,intervalDays:1},level,created);state.problems.push(normalizeProblem({...base,id:crypto.randomUUID?.()||`p-${Date.now()}`,lastReviewed:created,nextReview:schedule.nextReview,reviewCount:1,successStreak:schedule.successStreak,currentLevel:level,intervalDays:schedule.intervalDays,history:[{date:created,level}]}));}saveState();$("#problem-dialog").close();render();showToast(existing?"問題を更新しました":"問題を登録しました");}
function deleteProblem(id){const p=state.problems.find(item=>item.id===id);if(p&&confirm(`「${p.title}」を削除しますか？\nこの操作は取り消せません。`)){state.problems=state.problems.filter(item=>item.id!==id);saveState();render();showToast("問題を削除しました");}}
function openReview(id){const p=state.problems.find(item=>item.id===id);if(!p)return;activeReviewId=id;$("#review-title").textContent=`${p.number}　${p.title}`;const elapsed=p.lastReviewed?daysBetween(p.lastReviewed,isoDate()):0;$("#review-meta").innerHTML=[["教材",p.material],["科目 / 単元",`${p.subject} / ${p.unit}`],["前回の理解度",`Lv.${p.currentLevel} ${levelInfo(p.currentLevel).short}`],["前回復習日",formatDate(p.lastReviewed,true)],["今回までの間隔",`${elapsed}日`],["復習回数",`${p.reviewCount}回`]].map(([k,v])=>`<div class="meta-item"><span>${k}</span><strong>${escapeHtml(v)}</strong></div>`).join("");$("#review-note").textContent=p.notes;$("#history-list").innerHTML=p.history.length?p.history.slice().reverse().map(h=>`<div class="history-item"><span>${formatDate(h.date)}</span><strong style="color:${levelInfo(h.level).color}">Lv.${h.level} ${levelInfo(h.level).short}</strong></div>`).join(""):'<span class="muted">履歴はまだありません</span>';$("#review-dialog").showModal();}
function recordReview(level){const p=state.problems.find(item=>item.id===activeReviewId);if(!p)return;const today=isoDate(),schedule=calculateReviewSchedule(p,level,today);p.history.push({date:today,level});p.lastReviewed=today;p.nextReview=schedule.nextReview;p.reviewCount+=1;p.successStreak=schedule.successStreak;p.currentLevel=level;p.intervalDays=schedule.intervalDays;saveState();$("#review-dialog").close();render();showToast(`記録しました。次回は${formatDate(p.nextReview)}（${schedule.intervalDays}日後）です`);}
function showToast(message){const toast=$("#toast");toast.textContent=message;toast.classList.add("visible");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove("visible"),3200);}
function exportData(){const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),problems:state.problems},null,2)],{type:"application/json"});const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`math-recall-backup-${isoDate()}.json`;link.click();URL.revokeObjectURL(link.href);$("#data-message").textContent="バックアップを書き出しました。";}
async function importData(event){const file=event.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.problems))throw new Error("形式が正しくありません");const imported=data.problems.map(normalizeProblem);if(!confirm(`${imported.length}問を読み込み、現在のデータを置き換えますか？`))return;state.problems=imported;saveState();render();$("#data-message").textContent=`${imported.length}問を読み込みました。`;}catch(error){$("#data-message").textContent=`読み込みに失敗しました：${error.message}`;}finally{event.target.value="";}}
function loadSamples(){const existing=new Set(state.problems.map(p=>`${p.material}:${p.number}`));const additions=SAMPLE_PROBLEMS.filter(p=>!existing.has(`${p.material}:${p.number}`)).map(p=>normalizeProblem({...p,id:crypto.randomUUID?.()||`p-${Date.now()}-${Math.random()}`}));state.problems.push(...additions);saveState();render();$("#data-message").textContent=`サンプルを${additions.length}問追加しました。`;}
function applyTheme(theme){document.documentElement.dataset.theme=theme;$("#theme-button").textContent=theme==="dark"?"☀":"☾";$("#theme-button").setAttribute("aria-label",theme==="dark"?"ライトモードに切り替え":"ダークモードに切り替え");localStorage.setItem(THEME_KEY,theme);}
function initialize(){loadState();$("#subject").innerHTML=SUBJECTS.map(s=>`<option>${s}</option>`).join("");$("#initial-level").innerHTML=LEVELS.map(l=>`<option value="${l.value}">Lv.${l.value} ${l.short} — ${l.label}</option>`).join("");$("#rating-buttons").innerHTML=LEVELS.map(l=>`<button class="rating-button" type="button" data-rate="${l.value}"><strong style="color:${l.color}">${l.value}</strong><span>${l.label}</span></button>`).join("");document.querySelectorAll(".js-add").forEach(b=>b.onclick=()=>openProblemForm());$("#problem-form").addEventListener("submit",submitProblem);$("[data-close]").onclick=()=>$("#problem-dialog").close();$("[data-review-close]").onclick=()=>$("#review-dialog").close();$("[data-data-close]").onclick=()=>$("#data-dialog").close();$("#data-button").onclick=()=>$("#data-dialog").showModal();$("#export-data").onclick=exportData;$("#import-data").onchange=importData;$("#load-samples").onclick=loadSamples;$("#start-review").onclick=()=>{const first=dueProblems()[0];if(first)openReview(first.id);};document.querySelectorAll("[data-rate]").forEach(b=>b.onclick=()=>recordReview(Number(b.dataset.rate)));["#search","#filter-subject","#filter-unit","#filter-material","#filter-level","#filter-status"].forEach(selector=>$(selector).addEventListener(selector==="#search"?"input":"change",renderProblemList));const preferred=localStorage.getItem(THEME_KEY)||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");applyTheme(preferred);$("#theme-button").onclick=()=>applyTheme(document.documentElement.dataset.theme==="dark"?"light":"dark");render();}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", initialize);
if (typeof module !== "undefined") module.exports = { calculateReviewSchedule, assessDifficulty, normalizeProblem, addDays, daysBetween };

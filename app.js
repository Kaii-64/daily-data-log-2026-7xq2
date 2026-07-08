const STORAGE_KEY = "data-record-tracker-records-v1";
const SOURCE_META_KEY = "data-record-tracker-source-meta-v1";
const fallbackData = {
  updatedAt: "2026-07-07T17:23:27+08:00",
  targetSteps: [50000, 100000, 150000, 200000, 250000],
  records: [
    { date: "2026-07-06", value: 1029103.13 },
    { date: "2026-07-07", value: 1027486.73 },
  ],
};
let targets = [...fallbackData.targetSteps];
let appRecords = [];

const els = {
  targetPill: document.getElementById("targetPill"),
  latestDate: document.getElementById("latestDate"),
  statusChip: document.getElementById("statusChip"),
  currentValue: document.getElementById("currentValue"),
  dailyAmount: document.getElementById("dailyAmount"),
  dailyPct: document.getElementById("dailyPct"),
  targetLabel: document.getElementById("targetLabel"),
  distanceLabel: document.getElementById("distanceLabel"),
  progressFill: document.getElementById("progressFill"),
  cumulativeChange: document.getElementById("cumulativeChange"),
  currentTarget: document.getElementById("currentTarget"),
  stageProgress: document.getElementById("stageProgress"),
  remainingAmount: document.getElementById("remainingAmount"),
  dashboardRecords: document.getElementById("dashboardRecords"),
  valueChart: document.getElementById("valueChart"),
  chartTitle: document.getElementById("chartTitle"),
  legendPrimary: document.getElementById("legendPrimary"),
  legendSecondary: document.getElementById("legendSecondary"),
  chartDetail: document.getElementById("chartDetail"),
  entryForm: document.getElementById("entryForm"),
  dateInput: document.getElementById("dateInput"),
  entryDateText: document.getElementById("entryDateText"),
  valueInput: document.getElementById("valueInput"),
  saveState: document.getElementById("saveState"),
  recordsList: document.getElementById("recordsList"),
  exportButton: document.getElementById("exportButton"),
  targetLadder: document.getElementById("targetLadder"),
  baseLabel: document.getElementById("baseLabel"),
  daysLabel: document.getElementById("daysLabel"),
  avgDailyChange: document.getElementById("avgDailyChange"),
  paceDistance: document.getElementById("paceDistance"),
  nextStep: document.getElementById("nextStep"),
};
let chartMode = "stage";
let periodMode = "day";
let selectedChartIndex = null;
let currentChartData = [];
let currentChartPoints = [];

function normalizeRecords(records) {
  return sortedRecords((records || [])
    .filter((record) => record && record.date && Number.isFinite(Number(record.value)))
    .map((record) => ({ date: record.date, value: Math.round(Number(record.value) * 100) / 100 })));
}

function loadLocalRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeRecords(parsed);
  } catch {
    return [];
  }
}

function loadRecords() {
  return appRecords.length ? [...appRecords] : normalizeRecords(fallbackData.records);
}

function saveRecords(records) {
  appRecords = sortedRecords(records);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appRecords));
  els.saveState.textContent = "本机暂存";
}

function sortedRecords(records) {
  return [...records].sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchSourceData() {
  if (location.protocol === "file:") return fallbackData;
  try {
    const response = await fetch(`./data.json?updated=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("data file unavailable");
    const data = await response.json();
    return {
      updatedAt: data.updatedAt || fallbackData.updatedAt,
      targetSteps: Array.isArray(data.targetSteps) && data.targetSteps.length ? data.targetSteps : fallbackData.targetSteps,
      records: normalizeRecords(data.records).length ? normalizeRecords(data.records) : normalizeRecords(fallbackData.records),
    };
  } catch {
    return fallbackData;
  }
}

function mergeSourceAndLocal(sourceData) {
  const sourceRecords = normalizeRecords(sourceData.records);
  const localRecords = loadLocalRecords();
  const previousMeta = localStorage.getItem(SOURCE_META_KEY);
  const sourceChanged = previousMeta !== sourceData.updatedAt;
  const mergedByDate = new Map();

  for (const record of sourceRecords) mergedByDate.set(record.date, record);
  for (const record of localRecords) {
    if (!sourceChanged || !mergedByDate.has(record.date)) {
      mergedByDate.set(record.date, record);
    }
  }

  localStorage.setItem(SOURCE_META_KEY, sourceData.updatedAt);
  return sortedRecords([...mergedByDate.values()]);
}

function formatValue(value, options = {}) {
  const abs = Math.abs(value);
  const text = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  const prefix = value < 0 ? "-" : options.forceSign && value > 0 ? "+" : "";
  return `${prefix}${text}`;
}

function formatPercent(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

function formatWan(value) {
  return `${Math.round(value / 10000)}万`;
}

function todayIso() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function formatEntryDate(dateText) {
  if (!dateText || !dateText.includes("-")) return "今天";
  return `今天 ${dateText.slice(5).replace("-", "/")}`;
}

function enrich(records) {
  const ordered = sortedRecords(records);
  const baseValue = ordered[0]?.value ?? 0;
  return ordered.map((record, index) => {
    const previous = ordered[index - 1];
    const changeAmount = previous ? record.value - previous.value : 0;
    const changePct = previous ? changeAmount / previous.value : 0;
    const cumulative = record.value - baseValue;
    const currentTarget = targets.find((target) => cumulative < target) ?? targets[targets.length - 1];
    const targetIndex = targets.indexOf(currentTarget);
    const distance = Math.max(0, currentTarget - cumulative);
    const rawProgress = currentTarget === 0 ? 0 : cumulative / currentTarget;
    const visibleProgress = Math.max(0, Math.min(1, rawProgress));
    const stageStatus = distance === 0 && currentTarget === targets[targets.length - 1]
      ? "全部达成"
      : cumulative < 0
        ? "下降中"
        : distance === 0
          ? "已达成"
          : "进行中";

    return {
      ...record,
      index,
      changeAmount,
      changePct,
      cumulative,
      currentTarget,
      targetIndex,
      targetValue: baseValue + currentTarget,
      distance,
      rawProgress,
      visibleProgress,
      stageStatus,
    };
  });
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function isoWeekInfo(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekDay = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekDay);
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return { weekYear, week };
}

function periodMeta(dateText, mode) {
  const [year, month] = dateText.split("-").map(Number);
  if (mode === "week") {
    const { weekYear, week } = isoWeekInfo(dateText);
    return {
      key: `${weekYear}-W${pad2(week)}`,
      label: `W${pad2(week)}`,
      detail: `${weekYear} 第${week}周`,
      type: "周",
    };
  }
  if (mode === "month") {
    return {
      key: dateText.slice(0, 7),
      label: `${pad2(month)}月`,
      detail: dateText.slice(0, 7),
      type: "月",
    };
  }
  if (mode === "year") {
    return {
      key: String(year),
      label: String(year),
      detail: String(year),
      type: "年",
    };
  }
  return {
    key: dateText,
    label: dateText.slice(5),
    detail: dateText,
    type: "日",
  };
}

function buildPeriodData(data, mode) {
  if (mode === "day") {
    return data.map((point) => ({
      ...point,
      chartLabel: point.date.slice(5),
      detailLabel: point.date,
      rangeLabel: point.date,
      periodType: "日",
      periodFirstValue: point.value,
    }));
  }

  const groups = [];
  data.forEach((point) => {
    const meta = periodMeta(point.date, mode);
    const last = groups[groups.length - 1];
    if (!last || last.periodKey !== meta.key) {
      groups.push({
        ...point,
        periodKey: meta.key,
        chartLabel: meta.label,
        detailLabel: meta.detail,
        rangeLabel: point.date,
        periodType: meta.type,
        periodStart: point.date,
        periodEnd: point.date,
        periodFirstValue: point.value,
      });
      return;
    }

    groups[groups.length - 1] = {
      ...last,
      ...point,
      periodKey: last.periodKey,
      chartLabel: last.chartLabel,
      detailLabel: last.detailLabel,
      periodType: last.periodType,
      periodStart: last.periodStart,
      periodEnd: point.date,
      periodFirstValue: last.periodFirstValue,
    };
  });

  return groups.map((point, index) => {
    const previous = groups[index - 1];
    const compareValue = previous ? previous.value : point.periodFirstValue;
    const changeAmount = compareValue ? point.value - compareValue : 0;
    const changePct = compareValue ? changeAmount / compareValue : 0;
    const rangeLabel = point.periodStart === point.periodEnd
      ? point.periodEnd
      : `${point.periodStart.slice(5)} 至 ${point.periodEnd.slice(5)}`;
    return {
      ...point,
      index,
      changeAmount,
      changePct,
      rangeLabel,
    };
  });
}

function setSignedClass(element, value) {
  element.classList.toggle("positive", value > 0);
  element.classList.toggle("negative", value < 0);
}

function renderDashboard(data) {
  const latest = data[data.length - 1];
  const base = data[0];
  const targetName = formatWan(latest.currentTarget);

  els.targetPill.textContent = `阶段 ${targetName}`;
  els.latestDate.textContent = latest.date;
  els.statusChip.textContent = latest.stageStatus;
  els.statusChip.classList.toggle("good", latest.stageStatus.includes("达成"));
  els.statusChip.classList.toggle("down", latest.stageStatus === "下降中");
  els.currentValue.textContent = formatValue(latest.value);
  els.dailyAmount.textContent = formatValue(latest.changeAmount, { forceSign: true });
  els.dailyPct.textContent = formatPercent(latest.changePct);
  els.targetLabel.textContent = `${targetName}阶段`;
  els.distanceLabel.textContent = latest.distance > 0 ? `还差 ${formatValue(latest.distance)}` : "已达成";
  els.progressFill.style.width = `${Math.round(latest.visibleProgress * 100)}%`;
  els.cumulativeChange.textContent = formatValue(latest.cumulative, { forceSign: true });
  els.currentTarget.textContent = formatValue(latest.currentTarget);
  els.stageProgress.textContent = formatPercent(latest.rawProgress);
  els.remainingAmount.textContent = latest.distance > 0 ? formatValue(latest.distance) : "已达成";
  els.baseLabel.textContent = `基准 ${base.date}`;
  els.daysLabel.textContent = `${data.length}天`;
  els.paceDistance.textContent = formatValue(latest.distance);
  els.nextStep.textContent = targetName;

  const avg = data.length > 1 ? (latest.value - base.value) / (data.length - 1) : 0;
  els.avgDailyChange.textContent = formatValue(avg, { forceSign: true });

  document.querySelector(".change-row").classList.toggle("positive", latest.changeAmount > 0);
  document.querySelector(".change-row").classList.toggle("negative", latest.changeAmount < 0);
  [els.cumulativeChange, els.stageProgress, els.avgDailyChange].forEach((element) => {
    const value = element === els.stageProgress ? latest.rawProgress : element === els.avgDailyChange ? avg : latest.cumulative;
    setSignedClass(element, value);
  });

  drawChart(buildPeriodData(data, periodMode));
}

function formatAxisValue(value, span = Infinity) {
  const abs = Math.abs(value);
  if (abs >= 100000 && span < 10000) return `${(value / 10000).toFixed(1)}万`;
  if (abs >= 100000) return `${(value / 10000).toFixed(0)}万`;
  if (abs >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value);
}

function svgPath(points, xFor, yFor) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(2)} ${yFor(point).toFixed(2)}`)
    .join(" ");
}

function selectionLayer(color, height) {
  const selected = currentChartPoints[selectedChartIndex];
  if (!selected) return "";
  return `
    <g pointer-events="none">
      <line x1="${selected.x.toFixed(2)}" y1="18" x2="${selected.x.toFixed(2)}" y2="${height - 28}" stroke="#cbd7e2" stroke-width="2" stroke-dasharray="7 9" />
      <circle cx="${selected.x.toFixed(2)}" cy="${selected.y.toFixed(2)}" r="16" fill="${color}" opacity="0.13" />
      <circle cx="${selected.x.toFixed(2)}" cy="${selected.y.toFixed(2)}" r="8" fill="#ffffff" stroke="${color}" stroke-width="5" />
    </g>
  `;
}

function axisLabelLayer(data, width, height, pad, xFor) {
  if (data.length === 1) {
    return `<text x="${xFor(0).toFixed(2)}" y="${height - 8}" text-anchor="middle" fill="#6a7588" font-size="22">${data[0].chartLabel}</text>`;
  }
  return `
    <text x="${pad.left}" y="${height - 8}" fill="#6a7588" font-size="22">${data[0].chartLabel}</text>
    <text x="${width - pad.right}" y="${height - 8}" text-anchor="end" fill="#6a7588" font-size="22">${data[data.length - 1].chartLabel}</text>
  `;
}

function renderChartDetail(data) {
  const point = data[selectedChartIndex] || data[data.length - 1];
  if (!point) {
    els.chartDetail.innerHTML = "";
    return;
  }
  const changeClass = point.changeAmount > 0 ? "positive" : point.changeAmount < 0 ? "negative" : "";
  const cumulativeClass = point.cumulative > 0 ? "positive" : point.cumulative < 0 ? "negative" : "";
  const periodTitle = point.periodType === "日" ? "日期" : "周期";
  const changeTitle = point.periodType === "日" ? "当日变化" : `${point.periodType}变化`;
  els.chartDetail.innerHTML = `
    <div class="chart-detail-item">
      <span>${periodTitle}</span>
      <strong>${point.detailLabel}</strong>
    </div>
    <div class="chart-detail-item">
      <span>数值</span>
      <strong>${formatValue(point.value)}</strong>
    </div>
    <div class="chart-detail-item">
      <span>${changeTitle}</span>
      <strong class="${changeClass}">${formatValue(point.changeAmount, { forceSign: true })}<small>${formatPercent(point.changePct)}</small></strong>
    </div>
    <div class="chart-detail-item">
      <span>累计变化</span>
      <strong class="${cumulativeClass}">${formatValue(point.cumulative, { forceSign: true })}</strong>
    </div>
    <div class="chart-detail-item">
      <span>离阶段</span>
      <strong>${point.distance > 0 ? formatValue(point.distance) : "已达成"}</strong>
    </div>
    <div class="chart-detail-item">
      <span>区间</span>
      <strong>${point.rangeLabel}</strong>
    </div>
  `;
}

function drawChart(data) {
  if (!data.length) {
    currentChartData = [];
    currentChartPoints = [];
    els.valueChart.innerHTML = "";
    renderChartDetail(data);
    return;
  }
  currentChartData = data;
  if (selectedChartIndex === null || selectedChartIndex >= data.length) selectedChartIndex = data.length - 1;
  selectedChartIndex = Math.max(0, selectedChartIndex);
  if (chartMode === "change") drawChangeChart(data);
  else drawStageChart(data);
  renderChartDetail(data);
}

function drawStageChart(data) {
  const svg = els.valueChart;
  const width = 720;
  const height = 320;
  const pad = { top: 18, right: 18, bottom: 34, left: 70 };
  const plotW = width - pad.left - pad.right;
  const x = (index) => pad.left + (data.length === 1 ? plotW / 2 : (index / (data.length - 1)) * plotW);
  const values = data.map((point) => point.value);
  const targetsForLine = data.map((point) => point.targetValue);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueSpread = Math.max(600, maxValue - minValue);
  const min = minValue - valueSpread * 0.42;
  const max = maxValue + valueSpread * 0.42;
  const valueTop = 138;
  const valueBottom = 270;
  const valueH = valueBottom - valueTop;
  const yValue = (value) => valueTop + ((max - value) / (max - min)) * valueH;
  const targetY = 62;
  const targetTick = targetsForLine[targetsForLine.length - 1];
  const valueTicks = [max, (max + min) / 2, min];

  const grid = valueTicks.map((tick) => {
    const yy = yValue(tick);
    return `
      <line x1="${pad.left}" y1="${yy}" x2="${width - pad.right}" y2="${yy}" stroke="#e6edf2" stroke-width="1" />
      <text x="${pad.left - 12}" y="${yy + 7}" text-anchor="end" fill="#6a7588" font-size="20">${formatAxisValue(tick, max - min)}</text>
    `;
  });

  const targetPath = svgPath(targetsForLine, x, () => targetY);
  const valuePath = svgPath(values, x, yValue);
  currentChartPoints = data.map((point, index) => ({
    x: x(index),
    y: yValue(point.value),
    point,
  }));
  const dots = data.map((point, index) => (
    `<circle cx="${x(index).toFixed(2)}" cy="${yValue(point.value).toFixed(2)}" r="7" fill="#2f6df6" />`
  ));

  els.chartTitle.textContent = "阶段走势";
  els.legendPrimary.innerHTML = '<i class="legend-value"></i>数值';
  els.legendSecondary.innerHTML = '<i class="legend-target"></i>阶段';

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
    <line x1="${pad.left}" y1="${targetY}" x2="${width - pad.right}" y2="${targetY}" stroke="#f3dfbc" stroke-width="10" stroke-linecap="round" opacity="0.55" />
    <path d="${targetPath}" fill="none" stroke="#d18412" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="16 13" />
    <text x="${pad.left - 12}" y="${targetY + 7}" text-anchor="end" fill="#9b6a17" font-size="20">${formatAxisValue(targetTick, targetTick - minValue)}</text>
    <text x="${width - pad.right}" y="${targetY - 16}" text-anchor="end" fill="#9b6a17" font-size="18">阶段线</text>
    <line x1="${pad.left}" y1="104" x2="${width - pad.right}" y2="104" stroke="#dfe8ee" stroke-width="1" stroke-dasharray="9 10" />
    <path d="M ${pad.left - 8} 95 l 18 18 M ${pad.left + 16} 95 l 18 18" stroke="#9aa7b8" stroke-width="4" stroke-linecap="round" />
    ${grid.join("")}
    <path d="${valuePath}" fill="none" stroke="#2f6df6" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
    ${dots.join("")}
    ${selectionLayer("#2f6df6", height)}
    ${axisLabelLayer(data, width, height, pad, x)}
  `;
}

function drawChangeChart(data) {
  const svg = els.valueChart;
  const width = 720;
  const height = 300;
  const pad = { top: 22, right: 18, bottom: 34, left: 70 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const values = data.map((point) => point.cumulative);
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  const spread = Math.max(1000, max - min);
  min -= spread * 0.25;
  max += spread * 0.25;

  const x = (index) => pad.left + (data.length === 1 ? plotW / 2 : (index / (data.length - 1)) * plotW);
  const y = (value) => pad.top + ((max - value) / (max - min)) * plotH;
  const ticks = [max, (max + min) / 2, min];
  const grid = ticks.map((tick) => {
    const yy = y(tick);
    return `
      <line x1="${pad.left}" y1="${yy}" x2="${width - pad.right}" y2="${yy}" stroke="#e6edf2" stroke-width="1" />
      <text x="${pad.left - 12}" y="${yy + 7}" text-anchor="end" fill="#6a7588" font-size="20">${formatAxisValue(tick)}</text>
    `;
  });
  const dots = data.map((point, index) => (
    `<circle cx="${x(index).toFixed(2)}" cy="${y(point.cumulative).toFixed(2)}" r="7" fill="#0f9f8f" />`
  ));
  currentChartPoints = data.map((point, index) => ({
    x: x(index),
    y: y(point.cumulative),
    point,
  }));

  els.chartTitle.textContent = "变化波动";
  els.legendPrimary.innerHTML = '<i class="legend-value" style="background:#0f9f8f"></i>累计变化';
  els.legendSecondary.innerHTML = '<i class="legend-target"></i>零线';

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
    ${grid.join("")}
    <line x1="${pad.left}" y1="${y(0)}" x2="${width - pad.right}" y2="${y(0)}" stroke="#d18412" stroke-width="5" stroke-linecap="round" stroke-dasharray="14 12" />
    <path d="${svgPath(values, x, y)}" fill="none" stroke="#0f9f8f" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
    ${dots.join("")}
    ${selectionLayer("#0f9f8f", height)}
    ${axisLabelLayer(data, width, height, pad, x)}
  `;
}

function renderDashboardRecords(data) {
  els.dashboardRecords.innerHTML = "";
  [...data].reverse().slice(0, 5).forEach((record) => {
    const row = document.createElement("article");
    const changeClass = record.changeAmount > 0 ? "positive" : record.changeAmount < 0 ? "negative" : "";
    row.className = "daily-value-row";
    row.innerHTML = `
      <div class="daily-date">
        <span>${record.date.slice(5)}</span>
        <small>${record.index === 0 ? "基准" : "第 " + (record.index + 1) + " 天"}</small>
      </div>
      <div class="daily-value-value">${formatValue(record.value)}</div>
      <div class="daily-change ${changeClass}">
        <span>${formatValue(record.changeAmount, { forceSign: true })}</span>
        <small>${formatPercent(record.changePct)}</small>
      </div>
    `;
    els.dashboardRecords.appendChild(row);
  });
}

function renderRecords(data) {
  els.recordsList.innerHTML = "";
  [...data].reverse().forEach((record) => {
    const row = document.createElement("article");
    row.className = "record-row";
    const changeClass = record.changeAmount > 0 ? "positive" : record.changeAmount < 0 ? "negative" : "";
    row.innerHTML = `
      <div>
        <div class="record-title">${record.date}</div>
        <div class="record-meta">${formatValue(record.value)}</div>
      </div>
      <div class="record-change ${changeClass}">
        <div>${formatValue(record.changeAmount, { forceSign: true })}</div>
        <div class="record-meta">${formatPercent(record.changePct)}</div>
      </div>
    `;
    els.recordsList.appendChild(row);
  });
}

function renderPlan(data) {
  const latest = data[data.length - 1];
  els.targetLadder.innerHTML = "";
  targets.forEach((target, index) => {
    const row = document.createElement("article");
    const done = latest.cumulative >= target;
    const current = latest.currentTarget === target && !done;
    row.className = `target-row ${done ? "done" : current ? "current" : "next"}`;
    row.innerHTML = `
      <div class="target-mark">${index + 1}</div>
      <div>
        <div class="target-title">${formatWan(target)} 累计变化</div>
        <div class="record-meta">阶段门槛 ${formatValue(data[0].value + target)}</div>
      </div>
      <div class="target-state">${done ? "完成" : current ? "当前" : "待达"}</div>
    `;
    els.targetLadder.appendChild(row);
  });
}

function render() {
  const records = sortedRecords(loadRecords());
  const data = enrich(records);
  if (!data.length) return;
  renderDashboard(data);
  renderDashboardRecords(data);
  renderRecords(data);
  renderPlan(data);
}

function upsertRecord(date, value) {
  const records = sortedRecords(loadRecords());
  const existing = records.find((record) => record.date === date);
  if (existing) existing.value = value;
  else records.push({ date, value });
  saveRecords(sortedRecords(records));
  render();
}

function exportCsv() {
  const data = enrich(loadRecords());
  const header = ["日期", "数值", "日变化额", "日变化率", "累计变化", "当前阶段", "离阶段", "阶段达成率", "状态"];
  const rows = data.map((record) => [
    record.date,
    record.value.toFixed(2),
    record.changeAmount.toFixed(2),
    record.changePct.toFixed(6),
    record.cumulative.toFixed(2),
    record.currentTarget.toFixed(2),
    record.distance.toFixed(2),
    record.rawProgress.toFixed(6),
    record.stageStatus,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "数据记录.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function chartDataFromRecords() {
  return buildPeriodData(enrich(loadRecords()), periodMode);
}

function selectNearestChartPoint(clientX) {
  if (!currentChartPoints.length || !currentChartData.length) return;
  const rect = els.valueChart.getBoundingClientRect();
  const viewBox = els.valueChart.viewBox.baseVal;
  if (!rect.width || !viewBox.width) return;
  const svgX = viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width;
  let nearestIndex = 0;
  let nearestDistance = Infinity;
  currentChartPoints.forEach((point, index) => {
    const distance = Math.abs(point.x - svgX);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  if (nearestIndex !== selectedChartIndex) {
    selectedChartIndex = nearestIndex;
    drawChart(currentChartData);
  }
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const view = tab.dataset.view;
    document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === tab));
    document.querySelectorAll(".view").forEach((section) => section.classList.toggle("active", section.id === `view-${view}`));
    if (view === "dashboard") requestAnimationFrame(() => drawChart(chartDataFromRecords()));
  });
});

document.querySelectorAll(".chart-mode").forEach((button) => {
  button.addEventListener("click", () => {
    chartMode = button.dataset.chartMode;
    document.querySelectorAll(".chart-mode").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", active ? "true" : "false");
    });
    drawChart(chartDataFromRecords());
  });
});

document.querySelectorAll(".period-mode").forEach((button) => {
  button.addEventListener("click", () => {
    periodMode = button.dataset.periodMode;
    selectedChartIndex = null;
    document.querySelectorAll(".period-mode").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", active ? "true" : "false");
    });
    drawChart(chartDataFromRecords());
  });
});

els.valueChart.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary) return;
  els.valueChart.setPointerCapture?.(event.pointerId);
  selectNearestChartPoint(event.clientX);
});

els.valueChart.addEventListener("pointermove", (event) => {
  if (!event.isPrimary) return;
  selectNearestChartPoint(event.clientX);
});

els.entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const date = els.dateInput.value;
  const value = Number(els.valueInput.value);
  if (!date || !Number.isFinite(value) || value <= 0) return;
  upsertRecord(date, Math.round(value * 100) / 100);
  els.valueInput.value = "";
});

els.exportButton.addEventListener("click", exportCsv);
window.addEventListener("resize", () => drawChart(chartDataFromRecords()));

async function init() {
  const sourceData = await fetchSourceData();
  targets = [...sourceData.targetSteps].sort((a, b) => a - b);
  appRecords = mergeSourceAndLocal(sourceData);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appRecords));
  els.saveState.textContent = "项目数据";
  els.dateInput.value = todayIso();
  els.entryDateText.textContent = formatEntryDate(els.dateInput.value);
  render();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

init();

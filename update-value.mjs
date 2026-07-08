import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(here, "data.json");

function shanghaiParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    timestamp: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+08:00`,
  };
}

function parseArgs(argv) {
  const args = [...argv];
  let dryRun = false;
  const filtered = args.filter((arg) => {
    if (arg === "--dry-run") {
      dryRun = true;
      return false;
    }
    return true;
  });

  if (filtered.length === 1) {
    return { date: shanghaiParts().date, value: Number(filtered[0]), dryRun };
  }
  if (filtered.length === 2) {
    return { date: filtered[0], value: Number(filtered[1]), dryRun };
  }

  throw new Error("用法：node update-value.mjs [YYYY-MM-DD] 数值 [--dry-run]");
}

function assertValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("日期格式应为 YYYY-MM-DD");
  }
}

function assertValidValue(value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("数值必须是大于 0 的数字");
  }
}

function sortRecords(records) {
  return [...records].sort((a, b) => a.date.localeCompare(b.date));
}

function currentStage(records, targets) {
  const base = records[0];
  const latest = records[records.length - 1];
  const previous = records[records.length - 2] || latest;
  const cumulative = latest.value - base.value;
  const target = targets.find((step) => cumulative < step) || targets[targets.length - 1];
  const distance = Math.max(0, target - cumulative);
  const dailyAmount = latest.value - previous.value;
  const dailyPct = previous.value ? dailyAmount / previous.value : 0;

  return {
    latestDate: latest.date,
    value: latest.value,
    dailyAmount,
    dailyPct,
    cumulative,
    target,
    distance,
    progress: target ? cumulative / target : 0,
  };
}

const { date, value, dryRun } = parseArgs(process.argv.slice(2));
assertValidDate(date);
assertValidValue(value);

const raw = await fs.readFile(dataPath, "utf8");
const data = JSON.parse(raw);
const records = sortRecords(data.records || []);
const roundedValue = Math.round(value * 100) / 100;
const existing = records.find((record) => record.date === date);

if (existing) {
  existing.value = roundedValue;
} else {
  records.push({ date, value: roundedValue });
}

data.records = sortRecords(records);
data.updatedAt = shanghaiParts().timestamp;

if (!dryRun) {
  await fs.writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`);
}

const summary = currentStage(data.records, data.targetSteps || []);
console.log(JSON.stringify({ dryRun, ...summary }, null, 2));

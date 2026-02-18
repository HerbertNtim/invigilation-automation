import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { fileURLToPath } from "node:url";

// ------------------------
// File setup
// ------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputsDir = path.join(__dirname, "outputs");

if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });

const schedulePath = path.join(outputsDir, "ta_schedule.json");
const summaryPath = path.join(outputsDir, "ta_summary.json");
const excelPath = path.join(outputsDir, "ta_schedule-final.xlsx");

// ------------------------
// Load JSON outputs
// ------------------------
const taSchedule = JSON.parse(fs.readFileSync(schedulePath, "utf-8"));
const taSummary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));

// ------------------------
// Room order
// ------------------------
const roomOrder = [
  "LT", "RMA", "RMB", "VSLA", "206", "303", "304", "N1", "N2",
  "PB001", "PB008", "PB014", "PB020", "PB201", "PB208", "PB212",
  "PB214", "VCR", "ECR", "A110", "EA", "NAF1", "NEB-GF", "NEB-FF1",
  "NEB-FF2", "NEB-SF", "NEB-TF"
];
const roomIndex = Object.fromEntries(roomOrder.map((room, i) => [room, i]));

// ------------------------
// Prepare data for Excel
// ------------------------
const scheduleRows = [];

for (const day of Object.keys(taSchedule)) {
  for (const session of Object.keys(taSchedule[day])) {
    const sessionRows = [];

    for (const room of Object.keys(taSchedule[day][session])) {
      sessionRows.push({
        date: day,
        session,
        room,
        teachingAssistant: taSchedule[day][session][room].join(" / "),
      });
    }

    // Sort rooms according to roomOrder
    sessionRows.sort((a, b) => (roomIndex[a.room] ?? 999) - (roomIndex[b.room] ?? 999));

    // Add sorted session rows to main list
    scheduleRows.push(...sessionRows);

    // Add empty row between sessions
    scheduleRows.push({});
  }
}

// Sessions summary
const summaryRows = taSummary.map(item => ({
  name: item.ta,
  totalSessions: item.totalSessions,
}));

// ------------------------
// Create Excel workbook
// ------------------------
const wb = new ExcelJS.Workbook();

// Sheet 1: TA Schedule
const sheet1 = wb.addWorksheet("TA Schedule");
sheet1.columns = [
  { header: "Date", key: "date", width: 20 },
  { header: "Session", key: "session", width: 20 },
  { header: "Room", key: "room", width: 15 },
  { header: "Teaching Assistant(s)", key: "teachingAssistant", width: 40 },
];
sheet1.addRows(scheduleRows);

// Sheet 2: Sessions Count
const sheet2 = wb.addWorksheet("Sessions Count");
sheet2.columns = [
  { header: "Teaching Assistant", key: "name", width: 40 },
  { header: "Total Sessions", key: "totalSessions", width: 15 },
];
sheet2.addRows(summaryRows);

// ------------------------
// Write Excel file
// ------------------------
wb.xlsx
  .writeFile(excelPath)
  .then(() => console.log(`[+] Excel saved at ${excelPath}`))
  .catch(err => console.error("[-] Error writing Excel file:\n", err));

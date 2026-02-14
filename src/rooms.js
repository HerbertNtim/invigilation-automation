import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

// Resolve __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build full path to the Excel file
const timetable = path.join(
  __dirname,
  "./timetables/Examtt2k24_25_SS_EXAMS.xlsx",
);

// const workbook = XLSX.readFile(timetable);
// console.log(workbook.SheetNames);

function workOnExcel(filename) {
  const workbook = XLSX.readFile(filename);
  const workSheet = workbook.Sheets["Sheet1"];
  const jsonData = XLSX.utils.sheet_to_json(workSheet, { header: 1 });
  // console.log(jsonData)

  let extractedRooms = jsonData.map((row) => {
    if (!row[0] || typeof row !== "string") return null;

    const splitRow = row[0].split("%");

    if (splitRow.length < 8) return null;

    return {
      Rooms: splitRow[5],
      Dates: splitRow[6],
      Sessions: splitRow[7],
    };
  }).filter((item) => item && item.Rooms && item.Dates && item.Sessions);

  console.log(extractedRooms)
}

workOnExcel(timetable);

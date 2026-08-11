import XLSX from "xlsx";
import path from "path";
import fs from "node:fs";
import { fileURLToPath } from "url";

/*
  Recreate __dirname in Node ES modules
*/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/*
  Excel file path
*/
const timetable = path.join(__dirname, "./outputs/TTFINAL-cleaned.xlsx");

/*
  Read Excel and extract relevant fields
*/
function workOnExcel(filename) {
  console.log("\n📘 Starting Excel processing...");
  console.log("📂 Reading file:", filename);

  const workbook = XLSX.readFile(filename);

  const sheetName = workbook.SheetNames[0];
  console.log("📄 Using sheet:", sheetName);

  const workSheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(workSheet, { header: 1 });

  console.log("📊 Total rows found:", jsonData.length);

  let processed = 0;
  let skipped = 0;

  const extractedRooms = jsonData
    .map((row, index) => {
      processed++;

      const cell = row[0];

      if (typeof cell !== "string") {
        skipped++;
        console.log(`⚠️ Skipping row ${index + 1}: not a valid string`);
        return null;
      }

      const splitRow = cell.split("%");

      if (splitRow.length < 9) {
        skipped++;
        console.log(
          `⚠️ Skipping row ${index + 1}: invalid format (${splitRow.length} parts)`,
        );
        return null;
      }

      return {
        Rooms: splitRow[5].trim(),
        Dates: splitRow[6].trim(),
        Sessions: splitRow[7].trim(),
      };
    })
    .filter(Boolean);

  console.log("\n✅ Extraction complete");
  console.log("✔ Processed rows:", processed);
  console.log("✔ Valid rows:", extractedRooms.length);
  console.log("❌ Skipped rows:", skipped);

  return groupRoomsForAllocation(extractedRooms);
}

/*
  Group rooms by date and session
*/
function groupRoomsForAllocation(data) {
  console.log("\n🏫 Grouping rooms by date and session...");

  const result = {};
  let roomCount = 0;

  data.forEach(({ Dates, Sessions, Rooms }) => {
    if (!result[Dates]) result[Dates] = {};
    if (!result[Dates][Sessions]) result[Dates][Sessions] = {};

    Rooms.split("/").forEach((room) => {
      const cleanRoom = room.trim();

      if (result[Dates][Sessions][cleanRoom] || cleanRoom === "Computer Based")
        return;

      result[Dates][Sessions][cleanRoom] = [];
      roomCount++;
    });
  });

  console.log("🏢 Total unique rooms allocated:", roomCount);

  return result;
}

/*
  Write output JSON
*/
const output = "./src/outputs/ss-end-sem-rooms.json";

console.log("\n💾 Writing output to:", output);

const result = workOnExcel(timetable);

fs.writeFileSync(output, JSON.stringify(result, null, 2));

console.log("\n🎉 Done! JSON file created successfully.\n");

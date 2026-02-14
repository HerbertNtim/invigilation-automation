import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);
const timetable = path.join(_dirname,   'timetables/Midsem_Timetable_2024-25_Midsem-2-final.xlsx')

const workbook = new ExcelJS.Workbook();
console.log(await workbook.xlsx.readFile(timetable));

import XLSX from 'xlsx';

const timetable = './timetables/Examtt2k24_25_SS_EXAMS.xlsx';

const workbook = XLSX.readFile(timetable);

console.log(workbook.SheetNames);

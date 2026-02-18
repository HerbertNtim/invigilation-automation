import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const examsPath = path.join(__dirname, "./outputs/rooms.json");
const examsSchedule = JSON.parse(fs.readFileSync(examsPath, "utf-8"));
const tasPath = path.join(__dirname, "./outputs/tas_list.json");
const TAs = JSON.parse(fs.readFileSync(tasPath, "utf-8"));

class ScheduleTAs {
  constructor() {
    this.roomsWith2TAs = ["NAF1", "VSLA", "NEB-TF", "NEB-SF"];
    this.assignmentCounts = {};
  }

  getTotalSessions(examsSchedule) {
    let totalSession = 0;
    const days = Object.keys(examsSchedule);
    days.forEach((day) => {
      const sessions = Object.keys(examsSchedule[day]);
      sessions.forEach((session) => {
        const rooms = Object.keys(examsSchedule[day][session]);

        rooms.forEach((room) => {
          if (this.roomsWith2TAs.includes(room)) {
            totalSession += 2;
          } else {
            totalSession += 1;
          }
        });
      });
    });

    console.log(`Total Sessions for TAs: ${totalSession}`);
    return totalSession;
  }

  getAverageSession(examsSchedule, tasList) {
    const totalSession = this.getTotalSessions(examsSchedule);
    const totalTAs = tasList.length;

    console.log(`Total TAs: ${totalTAs}`);
    console.log(`Average Schedule: ${totalSession / totalTAs}`);

    return Math.floor(totalSession / totalTAs);
  }
}

const exams = new ScheduleTAs();
console.log(exams.getAverageSession(examsSchedule, TAs));

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// File setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const examsTimetable = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./outputs/rooms.json"), "utf-8"),
);

const ATTENDANTS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./outputs/attendants.json"), "utf-8"),
);

// SCHEDULER CLASS
class ScheduleAttendants {
  constructor(attds) {
    this.attendants = attds;

    this.roomCapacity = {
      "NEB-TF": 3,
      "NEB-SF": 3,
      NAF1: 2,
      VSLA: 2,
      PB001: 2,
      PB020: 2,
      PB014: 2,
      PB201: 2,
      PB214: 2,
    };

    this.preferredRoomAssignments = {
      "Rener Oppong": ["NEB-FF1"],
      "Collins Asare": ["NEB-FF1"],
      "Kwadwo Afful": ["NEB-TF"],
      "John Ofosu": ["PB001"],
      "David Mingle": ["NEB-SF"],
      "Kingsley Kyei Baffour": ["NEB-TF"],
      "Michael Obbo": ["NEB-FF2"],
      "Ebenezer Adom": ["NEB-SF"],
      "Worlanyo Abigail Akos": ["NEB-SF"],
      "Mercy Nimako": ["303"],
      "Sandra Essel": ["A110"],
      "Rebecca Yamoah": ["PB001"],
      "Helen Okai": ["PB014"],
      "Delida Acheampong": ["PB020"],
    };

    this.sessionConstraints = {
      "Helen Okai": ["4", "5"],
      "Rener Oppong": ["1", "2", "3", "4", "5"],
      "Sandra Essel": ["1", "2", "3", "4", "5"],
      "Rebecca Yamoah": ["2", "3", "4", "5"],
      "Mercy Nimako": ["2", "3", "4", "5"],
      "Delida Acheampong": ["2", "3", "4", "5"],
      "Worlanyo Abigail Akos": ["1", "2", "3", "4", "5"],
      "Afia Kesewa Akosah Agyenim Boateng": ["1", "2", "3", "4"],
    };

    this.dayConstraints = {
      "Afia Kesewa Akosah Agyenim Boateng": ["Friday"],
    };

    this.preferredSessionCounts = {
      10: ["Rebecca Yamoah"],
      15: [
        "Samuel Osei-Asibey Bonsu",
        "Dery Paul",
        "Kofi Bentum",
        "Loretta Owusu-Ansah",
        "Akrugu Erasmus Ayika",
        "Collins Asare",
        "Godfred Appiah",
        "Amoateng Derrick",
      ],
      20: [
        "Clement Appiah",
        "Reuben Asare Bediako",
        "Adijatu Busali",
        "Fatawu Yakubu",
        "Owusu Akuoko",
        "Kwame Kwarteng Sarpong",
        "Worlanyo Abigail Akos",
        "Sandra Essel",
        "Rener Oppong",
        "Kwadwo Afful",
      ],
      25: [
        "John Ofosu",
        "David Mingle",
        "Kingsley Kyei Baffour",
        "Michael Obbo",
        "Ebenezer Adom",
        "Robert Kofi Kyere",
      ],
    };

    this.assignmentCounts = {}
    for(let i = 0; i < attds.length; i++) {
      this.assignmentCounts[i] = 0
    }

    
  }


  getTotalSessions(schedule) {
    let total = 0;

    const days = Object.keys(schedule);
    days.forEach((day) => {
      const sessions = Object.keys(schedule[day]);
      sessions.forEach((session) => {
        const rooms = Object.keys(schedule[day][session]);

        rooms.forEach((room) => {
          total += this.roomCapacity[room] || 1;
        });
      });
    });

    console.log("Total Attendants slot: ", total);
    return total;
  }

  getAverageSession(schedule, attds) {
    const totalSessions = this.getTotalSessions(schedule);
    const attendants = attds.length;

    console.log(totalSessions / attendants);

    return Math.floor(totalSessions / attendants);
  }
}

const attendants = new ScheduleAttendants(ATTENDANTS);
console.log(attendants.getAverageSession(examsTimetable, ATTENDANTS));

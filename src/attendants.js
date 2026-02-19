import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// File setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const examsTimetable = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./outputs/rooms.json"), "utf-8")
);

const ATTENDANTS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./outputs/attendants.json"), "utf-8")
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
      "Rener Oppong": ["2", "3", "4", "5"],
      "Sandra Essel": ["2", "3", "4", "5"],
      "Rebecca Yamoah": ["2", "3", "4", "5"],
      "Mercy Nimako": ["2", "3", "4", "5"],
      "Delida Acheampong": ["2", "3", "4", "5"],
      "Worlanyo Abigail Akos": ["1", "2", "3", "4", "5"],
      "Afia Kesewa Akosah Agyenim Boateng": ["2", "3", "4"],
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

    // Track assignments
    this.assignmentCounts = {};
    for (let i = 0; i < attds.length; i++) {
      this.assignmentCounts[i] = 0;
    }
  }

  // ---------- HELPERS ----------

  isAvailable(name, day, session, assigned) {
    // Check day constraints
    if (this.dayConstraints[name]?.includes(day)) return false;

    const sessionNum = session.match(/Session,\s*(\d)/)?.[1];

    // Check session constraints
    if (this.sessionConstraints[name] && !this.sessionConstraints[name].includes(sessionNum)) {
      return false;
    }

    // Max 3 consecutive sessions rule
    const sessionsOfDay = Object.keys(assigned[day] || {});
    const sessionIndex = sessionsOfDay.indexOf(session);
    if (sessionIndex >= 3) {
      const lastThreeSessions = sessionsOfDay
        .slice(sessionIndex - 3, sessionIndex)
        .map((s) => Object.values(assigned[day][s]).flat())
        .flat();
      if (lastThreeSessions.includes(name)) return false;
    }

    return true;
  }

  getTargetSessions(name) {
    for (const [count, people] of Object.entries(this.preferredSessionCounts)) {
      if (people.includes(name)) return Number(count);
    }
    return 10; // default total sessions
  }

  scoreAttendant(name, index, room) {
    let score = this.assignmentCounts[index];

    if (this.preferredRoomAssignments[name]?.includes(room)) {
      score -= 5; // prefer assigned room
    }

    const target = this.getTargetSessions(name);
    if (this.assignmentCounts[index] >= target) {
      score += 10; // penalize over target
    }

    return score;
  }

  // ---------- SCHEDULER ----------

  generateSchedule(schedule) {
    const assigned = JSON.parse(JSON.stringify(schedule));

    Object.entries(assigned).forEach(([day, sessions]) => {
      Object.entries(sessions).forEach(([session, rooms]) => {
        const busyThisSession = new Set();

        Object.entries(rooms).forEach(([room]) => {
          const needed = this.roomCapacity[room] || 1;

          for (let i = 0; i < needed; i++) {
            const eligible = this.attendants
              .map((name, index) => ({ name, index }))
              .filter(
                ({ name, index }) =>
                  this.isAvailable(name, day, session, assigned) &&
                  !busyThisSession.has(index)
              );

            // Prioritize attendants under their target
            let candidates = eligible.filter(
              ({ name, index }) => this.assignmentCounts[index] < this.getTargetSessions(name)
            );

            // fallback if everyone hit target
            if (!candidates.length) candidates = eligible;

            candidates.sort(
              (a, b) =>
                this.scoreAttendant(a.name, a.index, room) -
                this.scoreAttendant(b.name, b.index, room)
            );

            if (!candidates.length) continue;

            const chosen = candidates[0];
            assigned[day][session][room].push(chosen.name);
            this.assignmentCounts[chosen.index]++;
            busyThisSession.add(chosen.index);
          }
        });
      });
    });

    return assigned;
  }

  // ---------- SUMMARY ----------

  getAssignmentSummary() {
    const summary = {};
    this.attendants.forEach((name, index) => {
      const target = this.getTargetSessions(name);
      summary[name] = {
        totalSessions: this.assignmentCounts[index],
        target,
        difference: this.assignmentCounts[index] - target,
      };
    });
    return summary;
  }
}

// ---------- RUN SCHEDULER ----------

const scheduler = new ScheduleAttendants(ATTENDANTS);

const result = scheduler.generateSchedule(examsTimetable);

fs.writeFileSync(
  path.join(__dirname, "./outputs/assigned_rooms.json"),
  JSON.stringify(result, null, 2)
);

const summary = scheduler.getAssignmentSummary();

fs.writeFileSync(
  path.join(__dirname, "./outputs/attendant_summary.json"),
  JSON.stringify(summary, null, 2)
);

console.log("Scheduling complete!");
console.table(summary);

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ------------------------
// File setup
// ------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const examsSchedule = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./outputs/end-rooms.json"), "utf-8"),
);

const TAs = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./outputs/end_sem_TAs.json"), "utf-8"),
);

// ------------------------
// Scheduler Class
// ------------------------

class ScheduleTAs {
  constructor(tas) {
    // Room capacity map (default = 1 TA)
    this.roomCapacity = {
      NAF1: 2,
      VSLA: 2,
      "NEB-TF": 2,
      "NEB-SF": 2,
      NEB: 1, // fixed
    };

    // Track sessions per TA
    this.sessionCounts = {};
    this.taHistory = {};
    this.schedule = {};

    tas.forEach((ta) => {
      this.sessionCounts[ta] = 0;
      this.taHistory[ta] = {};
    });
  }

  // ------------------------
  // Stats
  // ------------------------

  getTotalSessions(schedule) {
    let total = 0;

    for (const day of Object.keys(schedule)) {
      for (const session of Object.keys(schedule[day])) {
        for (const room of Object.keys(schedule[day][session])) {
          total += this.roomCapacity[room] || 1;
        }
      }
    }

    console.log("Total TA slots:", total);
    return total;
  }

  // ------------------------
  // Slot builder
  // ------------------------

  buildSlots(rooms) {
    const slots = [];

    rooms.forEach((room) => {
      const needed = this.roomCapacity[room] || 1;

      for (let i = 0; i < needed; i++) {
        slots.push({ room, index: i });
      }
    });

    return slots;
  }

  // ------------------------
  // Constraint: no 3 consecutive
  // ------------------------

  canWork(ta, day) {
    const history = this.taHistory[ta][day] || [];

    if (history.length < 2) return true;

    return !(history.at(-1) && history.at(-2));
  }

  // Sort TAs by fairness
  getEligibleTAs(day) {
    return Object.keys(this.sessionCounts)
      .filter((ta) => this.canWork(ta, day))
      .sort((a, b) => this.sessionCounts[a] - this.sessionCounts[b]);
  }

  // ------------------------
  // Main scheduler
  // ------------------------

  scheduleAll(scheduleData) {
    for (const day of Object.keys(scheduleData)) {
      this.schedule[day] = {};

      for (const session of Object.keys(scheduleData[day])) {
        const rooms = Object.keys(scheduleData[day][session]);
        const slots = this.buildSlots(rooms);

        let eligible = this.getEligibleTAs(day);

        // fallback if constraints too strict
        if (eligible.length < slots.length) {
          console.warn("Relaxing rule:", day, session);

          eligible = Object.keys(this.sessionCounts).sort(
            (a, b) => this.sessionCounts[a] - this.sessionCounts[b],
          );
        }

        const assigned = new Set();
        this.schedule[day][session] = {};

        // assign slots greedily
        slots.forEach((slot, i) => {
          const ta = eligible[i % eligible.length];

          if (!this.schedule[day][session][slot.room]) {
            this.schedule[day][session][slot.room] = [];
          }

          this.schedule[day][session][slot.room].push(ta);

          this.sessionCounts[ta]++;
          assigned.add(ta);
        });

        // update TA daily history
        Object.keys(this.taHistory).forEach((ta) => {
          if (!this.taHistory[ta][day]) {
            this.taHistory[ta][day] = [];
          }

          this.taHistory[ta][day].push(assigned.has(ta));
        });
      }
    }

    return this.schedule;
  }

  // ------------------------
  // Summary
  // ------------------------

  getSessionSummary() {
    return Object.entries(this.sessionCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([ta, total]) => ({
        ta,
        totalSessions: total,
      }));
  }
}

// ------------------------
// Run scheduler
// ------------------------

const scheduler = new ScheduleTAs(TAs);

scheduler.getTotalSessions(examsSchedule);

const result = scheduler.scheduleAll(examsSchedule);

// Save schedule
fs.writeFileSync(
  path.join(__dirname, "./outputs/fs-ta_schedule.json"),
  JSON.stringify(result, null, 2),
);

// Save summary
fs.writeFileSync(
  path.join(__dirname, "./outputs/fs-ta_summary.json"),
  JSON.stringify(scheduler.getSessionSummary(), null, 2),
);

console.log("✅ TA scheduling complete!");

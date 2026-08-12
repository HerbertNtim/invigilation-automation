import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ------------------------
// File setup
// ------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const examsSchedule = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "./outputs/ss-end-sem-rooms.json"),
    "utf-8",
  ),
);

const TAs = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "./outputs/ss-end-sem-tas.json"),
    "utf-8",
  ),
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

    // BYOD rooms
    this.skipRooms = new Set(['BYOD1', 'BYOD2'])

    // Track sessions per TA
    this.sessionCounts = {};
    this.taHistory = {};
    this.schedule = {};

    // TA-specific rules
    this.taRules = {
      "Sandra Osei": {
        exclude: ["Session, 1 (8:30 AM - 10:30 AM)"],
      },

      "Beatrice Forson": {
        exclude: ["Session, 1 (8:30 AM - 10:30 AM)"],
      },

      "Erica Winnie Gado": {
        exclude: [
          "Session, 2 (12:00 AM - 2:00 AM)",
        ],
      },
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
          // Ignore BYOD rooms
          if(this.skipRooms.has(room)) {
            continue;
          }

          total += this.roomCapacity[room] || 1;
        }
      }
    }

    console.log("Total TA slots:", total);
    console.log("Total TAs: ", TAs.length);
    console.log("Average sessions per TA: ", (total / TAs.length).toFixed(2));
    return total;
  }

  // ------------------------
  // Slot builder
  // ------------------------

  buildSlots(rooms) {
    const slots = [];

    rooms.forEach((room) => {
      // Ignore BYOD rooms
      if(this.skipRooms.has(room)) { 
        return;
      }
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

  canTakeSession(ta, session) {
    const rule = this.taRules[ta];

    // No special rules
    if (!rule) return true;

    // Restrict to only these sessions
    if (rule.only) {
      return rule.only.includes(session);
    }

    // Exclude these sessions
    if (rule.exclude) {
      return !rule.exclude.includes(session);
    }

    return true;
  }

  // Sort TAs by fairness
  getEligibleTAs(day, session, assigned) {
    return Object.keys(this.sessionCounts)
      .filter(
        (ta) =>
          !assigned.has(ta) &&
          this.canWork(ta, day) &&
          this.canTakeSession(ta, session),
      )
      .sort((a, b) => this.sessionCounts[a] - this.sessionCounts[b]);
  }

  // ------------------------
  // Main scheduler
  // ------------------------

  scheduleAll(scheduleData) {
    for (const day of Object.keys(scheduleData)) {
      this.schedule[day] = {};

      for (const session of Object.keys(scheduleData[day])) {
        // Remove BYOD rooms
        const rooms = Object.keys(scheduleData[day][session]).filter((room) => !this.skipRooms.has(room));

        // If the session only contains BYOD rooms,
        // there is nothing for this scheduler to assign.
        if(rooms.length === 0) {
          continue;
        }

        const slots = this.buildSlots(rooms);

        const assigned = new Set();

        this.schedule[day][session] = {};

        for (const slot of slots) {
          let eligible = this.getEligibleTAs(day, session, assigned);

          // Relax only consecutive rule if needed
          if (eligible.length === 0) {
            console.warn(`Relaxing consecutive rule: ${day} ${session}`);

            eligible = Object.keys(this.sessionCounts)
              .filter(
                (ta) => !assigned.has(ta) && this.canTakeSession(ta, session),
              )
              .sort((a, b) => this.sessionCounts[a] - this.sessionCounts[b]);
          }

          // No TA available
          if(eligible.length === 0) {
            console.error(`No TA available for ${day} - ${session} - ${slot.room}`)
            continue;
          }

          // Last fallback
          // if (eligible.length === 0) {
          //   eligible = Object.keys(this.sessionCounts)
          //     .filter((ta) => !assigned.has(ta))
          //     .sort((a, b) => this.sessionCounts[a] - this.sessionCounts[b]);
          // }

          const ta = eligible[0];

          if (!this.schedule[day][session][slot.room]) {
            this.schedule[day][session][slot.room] = [];
          }

          this.schedule[day][session][slot.room].push(ta);

          this.sessionCounts[ta]++;
          assigned.add(ta);
        }

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
  path.join(__dirname, "./outputs/ss-end-sem-ta_schedule.json"),
  JSON.stringify(result, null, 2),
);

// Save summary
fs.writeFileSync(
  path.join(__dirname, "./outputs/ss-end-sem-ta_summary.json"),
  JSON.stringify(scheduler.getSessionSummary(), null, 2),
);

console.log("✅ TA scheduling complete!");

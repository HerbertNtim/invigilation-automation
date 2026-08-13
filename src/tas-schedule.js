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
    // ------------------------
    // Room capacity map
    // Default = 1 TA
    // ------------------------

    this.roomCapacity = {
      NAF1: 2,
      VSLA: 2,
      "NEB-TF": 2,
      "NEB-SF": 2,
      NEB: 1, // fixed
    };

    // ------------------------
    // Rooms handled separately
    // ------------------------

    this.skipRooms = new Set([
      "BYOD1",
      "BYOD2",
      "GIS Lab",
      "DE",
    ]);

    // ------------------------
    // Track sessions per TA
    // ------------------------

    this.sessionCounts = {};
    this.taHistory = {};
    this.schedule = {};

    // ------------------------
    // TA-specific rules
    // ------------------------

    this.taRules = {
      "Sandra Osei": {
        exclude: [
          "Session, 1 (8:30 AM - 10:30 AM)",
        ],
      },

      "Beatrice Forson": {
        exclude: [
          "Session, 1 (8:30 AM - 10:30 AM)",
        ],
      },

      "Erica Winnie Gado": {
        exclude: [
          "Session, 2 (12:00 AM - 2:00 AM)",
        ],
      },

      // Maurice is unavailable only from
      // September 1st to September 4th.
      "Maurice Elikem Sunuh": {
        excludeDates: [
          "Tuesday, 1 September 2026",
          "Wednesday, 2 September 2026",
          "Thursday, 3 September 2026",
          "Friday, 4 September 2026",
        ],
      },
    };

    // ------------------------
    // Initialize TA tracking
    // ------------------------

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
          // Ignore rooms handled separately
          if (this.skipRooms.has(room)) {
            continue;
          }

          total += this.roomCapacity[room] || 1;
        }
      }
    }

    console.log("Total TA slots:", total);
    console.log("Total TAs:", TAs.length);
    console.log(
      "Average sessions per TA:",
      (total / TAs.length).toFixed(2),
    );

    return total;
  }

  // ------------------------
  // Slot builder
  // ------------------------

  buildSlots(rooms) {
    const slots = [];

    rooms.forEach((room) => {
      // Ignore rooms handled separately
      if (this.skipRooms.has(room)) {
        return;
      }

      const needed = this.roomCapacity[room] || 1;

      for (let i = 0; i < needed; i++) {
        slots.push({
          room,
          index: i,
        });
      }
    });

    return slots;
  }

  // ------------------------
  // Constraint:
  // No 3 consecutive sessions
  // ------------------------

  canWork(ta, day) {
    const history = this.taHistory[ta][day] || [];

    if (history.length < 2) {
      return true;
    }

    return !(history.at(-1) && history.at(-2));
  }

  // ------------------------
  // TA-specific rules
  // ------------------------

  canTakeSession(ta, day, session) {
    const rule = this.taRules[ta];

    // No special rules
    if (!rule) {
      return true;
    }

    // ------------------------
    // Date-based restrictions
    // ------------------------

    if (rule.excludeDates) {
      if (rule.excludeDates.includes(day)) {
        return false;
      }
    }

    // ------------------------
    // Restrict TA to only
    // specific sessions
    // ------------------------

    if (rule.only) {
      return rule.only.includes(session);
    }

    // ------------------------
    // Exclude specific sessions
    // ------------------------

    if (rule.exclude) {
      return !rule.exclude.includes(session);
    }

    return true;
  }

  // ------------------------
  // Sort TAs by fairness
  // ------------------------

  getEligibleTAs(day, session, assigned) {
    return Object.keys(this.sessionCounts)
      .filter(
        (ta) =>
          // TA has not already been assigned
          // during this session
          !assigned.has(ta) &&

          // TA is not working 3 consecutive sessions
          this.canWork(ta, day) &&

          // TA satisfies their personal rules
          this.canTakeSession(ta, day, session),
      )
      .sort(
        (a, b) =>
          this.sessionCounts[a] -
          this.sessionCounts[b],
      );
  }

  // ------------------------
  // Main scheduler
  // ------------------------

  scheduleAll(scheduleData) {
    for (const day of Object.keys(scheduleData)) {
      this.schedule[day] = {};

      for (const session of Object.keys(scheduleData[day])) {
        // ------------------------
        // Remove skipped rooms
        // ------------------------

        const rooms = Object.keys(
          scheduleData[day][session],
        ).filter(
          (room) => !this.skipRooms.has(room),
        );

        // If the session contains only
        // skipped rooms, move to next session.
        if (rooms.length === 0) {
          continue;
        }

        // Build individual TA slots
        const slots = this.buildSlots(rooms);

        // TAs already assigned in this session
        const assigned = new Set();

        this.schedule[day][session] = {};

        // ------------------------
        // Assign each slot
        // ------------------------

        for (const slot of slots) {
          let eligible = this.getEligibleTAs(
            day,
            session,
            assigned,
          );

          // ------------------------
          // Fallback:
          // Relax consecutive-session rule
          // ------------------------

          if (eligible.length === 0) {
            console.warn(
              `Relaxing consecutive rule: ${day} ${session}`,
            );

            eligible = Object.keys(
              this.sessionCounts,
            )
              .filter(
                (ta) =>
                  !assigned.has(ta) &&
                  this.canTakeSession(
                    ta,
                    day,
                    session,
                  ),
              )
              .sort(
                (a, b) =>
                  this.sessionCounts[a] -
                  this.sessionCounts[b],
              );
          }

          // ------------------------
          // No TA available
          // ------------------------

          if (eligible.length === 0) {
            console.error(
              `No TA available for ${day} - ${session} - ${slot.room}`,
            );

            continue;
          }

          // Select TA with the lowest
          // number of assignments
          const ta = eligible[0];

          // ------------------------
          // Create room array
          // ------------------------

          if (
            !this.schedule[day][session][slot.room]
          ) {
            this.schedule[day][session][slot.room] =
              [];
          }

          // ------------------------
          // Assign TA
          // ------------------------

          this.schedule[day][session][
            slot.room
          ].push(ta);

          // Update workload
          this.sessionCounts[ta]++;

          // Prevent the TA from being assigned
          // to another room in this session
          assigned.add(ta);
        }

        // ------------------------
        // Update TA daily history
        // ------------------------

        Object.keys(this.taHistory).forEach(
          (ta) => {
            if (!this.taHistory[ta][day]) {
              this.taHistory[ta][day] = [];
            }

            this.taHistory[ta][day].push(
              assigned.has(ta),
            );
          },
        );
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

// Calculate total required TA slots
scheduler.getTotalSessions(examsSchedule);

// Generate schedule
const result =
  scheduler.scheduleAll(examsSchedule);

// ------------------------
// Save schedule
// ------------------------

fs.writeFileSync(
  path.join(
    __dirname,
    "./outputs/ss-end-sem-ta_schedule.json",
  ),
  JSON.stringify(result, null, 2),
);

// ------------------------
// Save summary
// ------------------------

fs.writeFileSync(
  path.join(
    __dirname,
    "./outputs/ss-end-sem-ta_summary.json",
  ),
  JSON.stringify(
    scheduler.getSessionSummary(),
    null,
    2,
  ),
);

console.log("✅ TA scheduling complete!");

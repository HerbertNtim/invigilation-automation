import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url"; // Required for __dirname in ES modules

// ---------------------------
// Fix __dirname for ES modules
// ---------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------
// Classes
// ---------------------------

/**
 * Represents a Teaching Assistant (TA)
 */
class TA {
  constructor(name) {
    this.name = name;
    this.assignedSessions = new Set(); // sessions the TA is already assigned to
  }

  isAvailable(session) {
    return !this.assignedSessions.has(session);
  }

  assign(session) {
    this.assignedSessions.add(session);
  }

  unassign(session) {
    this.assignedSessions.delete(session);
  }
}

/**
 * Represents the Scheduler using N-Queen–style backtracking
 */
class Scheduler {
  /**
   * @param {TA[]} tas - List of all TAs
   * @param {Object} roomsJson - { date: { session: { room: [] } } }
   */
  constructor(tas, roomsJson) {
    this.tas = tas;
    this.roomsJson = roomsJson;
    this.schedule = {}; // Final schedule: date -> session -> room -> TA
    this.assignments = 0; // counter
  }

  /**
   * Start scheduling
   */
  run() {
    console.log("\n📝 Starting TA assignment...");
    const dates = Object.keys(this.roomsJson);

    for (const date of dates) {
      this.schedule[date] = {};
      const sessions = Object.keys(this.roomsJson[date]);
      for (const session of sessions) {
        this.schedule[date][session] = {};
        const rooms = Object.keys(this.roomsJson[date][session]);
        if (!this.backtrackAssign(date, session, rooms, 0)) {
          console.log(
            `⚠️ Could not assign all rooms on ${date} - ${session}`
          );
        }
      }
    }

    console.log("\n✅ TA assignment complete!");
    console.log(`📊 Total assignments: ${this.assignments}`);
    return this.schedule;
  }

  /**
   * Recursive backtracking assignment
   * @param {string} date
   * @param {string} session
   * @param {string[]} rooms
   * @param {number} roomIndex
   * @returns {boolean}
   */
  backtrackAssign(date, session, rooms, roomIndex) {
    // All rooms assigned
    if (roomIndex >= rooms.length) return true;

    const room = rooms[roomIndex];

    for (const ta of this.tas) {
      if (ta.isAvailable(`${date}|${session}`)) {
        // Assign TA
        ta.assign(`${date}|${session}`);
        this.schedule[date][session][room] = ta.name;
        this.assignments++;

        // Recursive call for next room
        if (this.backtrackAssign(date, session, rooms, roomIndex + 1)) {
          return true;
        }

        // Backtrack
        ta.unassign(`${date}|${session}`);
        this.schedule[date][session][room] = null;
        this.assignments--;
      }
    }

    // No TA could be assigned to this room
    return false;
  }
}

// ---------------------------
// Example usage
// ---------------------------

// Load rooms.json
const roomsPath = path.join(__dirname, "./outputs/rooms.json");
const roomsJson = JSON.parse(fs.readFileSync(roomsPath, "utf-8"));
console.log("📂 Rooms loaded:", Object.keys(roomsJson).length, "dates");

// Example list of TAs
const tas = [
  new TA("TA_1"),
  new TA("TA_2"),
  new TA("TA_3"),
  new TA("TA_4"),
  new TA("TA_5"),
  new TA("TA_6"),
  new TA("TA_7"),
  new TA("TA_8"),
];

// Initialize scheduler
const scheduler = new Scheduler(tas, roomsJson);

// Run scheduler
const finalSchedule = scheduler.run();

// Save output
const output = path.join(__dirname, "./outputs/ta_schedule.json");
fs.writeFileSync(output, JSON.stringify(finalSchedule, null, 2));

console.log("\n💾 Schedule written to:", output);

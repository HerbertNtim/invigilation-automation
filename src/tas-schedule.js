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

const MIN_SESSIONS = 14;

class InvigilationSchedulerJSON {
  constructor(attendants, timetable) {
    this.attendants = attendants;
    this.timetable = timetable;

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

    this.preferredRoomAssignments = {}; // load from attendants JSON
    this.sessionConstraints = {};
    this.dayConstraints = {};
    this.preferredSessionCounts = {};

    attendants.forEach((att) => {
      if (att.preferredRoomAssignments) this.preferredRoomAssignments[att.name] = att.preferredRoomAssignments;
      if (att.sessionConstraints) this.sessionConstraints[att.name] = att.sessionConstraints;
      if (att.dayConstraints) this.dayConstraints[att.name] = att.dayConstraints;
      if (att.preferredSessionCount) this.preferredSessionCounts[att.name] = att.preferredSessionCount;
    });

    this.schedule = {};
    this.assignmentCounts = {};
    this.roomAssignmentHistory = {};
    this.dailyAssignmentCounts = {};
    this.sessionAssignmentCounts = {};
  }

  buildSlots() {
    const slots = [];
    Object.entries(this.timetable).forEach(([day, sessions]) => {
      Object.entries(sessions).forEach(([session, rooms]) => {
        Object.entries(rooms).forEach(([room, _ignored]) => {
          const capacity = this.roomCapacity[room] || 1;
          for (let i = 0; i < capacity; i++) {
            slots.push({ day, session, room, assigned: null });
          }
        });
      });
    });
    return slots;
  }

  canAssign(att, slot) {
    const dayName = slot.day.split(",")[0];
    if (this.dayConstraints[att.name]?.includes(dayName)) return false;
    if (this.sessionConstraints[att.name] && !this.sessionConstraints[att.name].includes(slot.session)) return false;
    if (att.assigned?.some(a => a.day === slot.day && a.session === slot.session)) return false;
    if ((att.assigned?.length || 0) >= (this.preferredSessionCounts[att.name] || MIN_SESSIONS)) return false;
    return true;
  }

  score(att, slot) {
    let score = att.assigned?.length || 0;
    if (this.preferredRoomAssignments[att.name]?.includes(slot.room)) score -= 5;
    return score;
  }

  assignSlots(slots) {
    // Hardest-first: slots with fewest eligible attendants first
    slots.sort((a, b) => {
      const aEligible = this.attendants.filter(att => this.canAssign(att, a)).length;
      const bEligible = this.attendants.filter(att => this.canAssign(att, b)).length;
      return aEligible - bEligible;
    });

    slots.forEach(slot => {
      const candidates = this.attendants
        .filter(att => this.canAssign(att, slot))
        .sort((a, b) => this.score(a, slot) - this.score(b, slot));

      if (candidates.length === 0) return;
      const chosen = candidates[0];

      slot.assigned = chosen.name;
      chosen.assigned = chosen.assigned || [];
      chosen.assigned.push(slot);

      // Update tracking
      this.assignmentCounts[chosen.name] = (this.assignmentCounts[chosen.name] || 0) + 1;
      this.roomAssignmentHistory[chosen.name] = this.roomAssignmentHistory[chosen.name] || {};
      this.roomAssignmentHistory[chosen.name][slot.room] = (this.roomAssignmentHistory[chosen.name][slot.room] || 0) + 1;
      this.dailyAssignmentCounts[chosen.name] = this.dailyAssignmentCounts[chosen.name] || {};
      this.dailyAssignmentCounts[chosen.name][slot.day] = (this.dailyAssignmentCounts[chosen.name][slot.day] || 0) + 1;
      this.sessionAssignmentCounts[chosen.name] = this.sessionAssignmentCounts[chosen.name] || {};
      this.sessionAssignmentCounts[chosen.name][slot.session] = (this.sessionAssignmentCounts[chosen.name][slot.session] || 0) + 1;
    });
  }

  buildTimetableOutput(slots) {
    const result = {};
    slots.forEach(slot => {
      result[slot.day] ??= {};
      result[slot.day][slot.session] ??= {};
      result[slot.day][slot.session][slot.room] ??= [];
      result[slot.day][slot.session][slot.room].push(slot.assigned);
    });
    return result;
  }

  buildSummary() {
    const summary = {};
    this.attendants.forEach(att => {
      summary[att.name] = att.assigned?.length || 0;
    });
    return summary;
  }

  generate() {
    const slots = this.buildSlots();
    this.assignSlots(slots);

    const timetable = this.buildTimetableOutput(slots);
    const summary = this.buildSummary();

    fs.writeFileSync(path.join(__dirname, "./outputs/finalTimetable.json"), JSON.stringify(timetable, null, 2));
    fs.writeFileSync(path.join(__dirname, "./outputs/summary.json"), JSON.stringify(summary, null, 2));

    console.log("Timetable and summary generated!");
    return { timetable, summary };
  }
}

// ---------- RUN ----------
const scheduler = new InvigilationSchedulerJSON(ATTENDANTS, examsTimetable);
scheduler.generate();

import { describe, expect, it } from "vitest";
import { createWorld, newSession, step } from "./engine";
import {
  clinicConsultation,
  clinicDestination,
  clinicStatus,
  deliverClinicCare,
} from "./clinic";
import { restore } from "./persistence";
function scene() {
  const w = createWorld(0);
  w.tick = 72;
  w.water = 55;
  const site = w.buildings[12];
  const nurse = w.villagers[4],
    patient = w.villagers[5];
  patient.health = 53;
  for (const v of w.villagers) v.nextDecision = 700;
  for (const [v, x, action] of [
    [patient, site.x - 0.5, "Attend des soins devant la clinique"],
    [nurse, site.x + 1.5, "Soigne ses voisins"],
  ] as const) {
    Object.assign(v, {
      x,
      y: site.y + 2.5,
      target: [x, site.y + 2.5],
      route: [],
      action,
      actionAt: 56,
    });
  }
  return { w, site, patient, nurse };
}
describe("daily clinic", () => {
  it("only heals after both have arrived and have spent time there", () => {
    const { w, site, nurse, patient } = scene();
    nurse.route = [[19, 21.5]];
    expect(clinicConsultation(w, site)).toBeNull();
    nurse.route = [];
    nurse.actionAt = 70;
    expect(deliverClinicCare(w)).toBeNull();
    w.tick = 86;
    expect(deliverClinicCare(w)?.patient).toBe(patient);
    expect([patient.health, w.water]).toEqual([68, 52]);
    expect(clinicStatus(w, site)?.treatedToday).toBe(true);
    expect(deliverClinicCare(w)).toBeNull();
  });
  it.each(["night", "empty", "danger", "damaged", "thirst", "death"])(
    "does not give care during %s",
    (kind) => {
      const { w, site, patient, nurse } = scene();
      if (kind === "night") w.tick = 170;
      if (kind === "empty") w.water = 27;
      if (kind === "danger")
        w.disasters = [
          { kind: "fire", x: site.x, y: site.y, life: 40, people: [] },
        ];
      if (kind === "damaged") site.condition = 10;
      if (kind === "thirst") patient.thirst = 75;
      if (kind === "death") nurse.dead = true;
      expect(deliverClinicCare(w)).toBeNull();
      expect(patient.health).toBe(53);
    },
  );
  it("records the care for both residents and the building, and persists the daily limit", () => {
    const { w, site, patient, nurse } = scene();
    step(w);
    expect(site.events[0].text).toContain(
      `${nurse.name} soigne ${patient.name}`,
    );
    expect(patient.memories[0]).toBe(site.events[0]);
    expect(nurse.memories[0]).toBe(site.events[0]);
    const copy = restore(JSON.stringify(w));
    expect(copy.clinicTreatedAt).toBe(w.tick);
    copy.settings.scenario = "session";
    newSession(copy, 1);
    expect(copy.clinicTreatedAt).toBeUndefined();
  });
  it("routes both neighbours during normal simulation and records completed treatment", () => {
    const { w, site, patient, nurse } = scene();
    for (const [v, x] of [
      [patient, 15.5],
      [nurse, 22.5],
    ] as const) {
      Object.assign(v, {
        x,
        y: 22.5,
        target: [x, 22.5],
        route: [],
        nextDecision: w.tick,
        action: "Inspecte les chemins",
      });
    }
    for (let i = 0; i < 150 && w.clinicTreatedAt === undefined; i++) step(w);
    expect(w.clinicTreatedAt).toBeDefined();
    expect(site.events[0]?.text).toContain(
      `${nurse.name} soigne ${patient.name}`,
    );
  });
  it("sends resident and carer to separate spots but lets immediate needs win", () => {
    const { w, nurse, patient } = scene();
    expect(clinicDestination(w, patient)?.target).toEqual([17.5, 21.5]);
    expect(clinicDestination(w, nurse)?.target).toEqual([19.5, 21.5]);
    patient.hunger = 68;
    expect(clinicDestination(w, patient)).toBeNull();
    expect(clinicDestination(w, nurse)).toBeNull();
  });
});

import { hourOf, TICKS_PER_DAY } from "../daylight";
import { talkingPartner } from "./neighbour-talk";
import { indoors } from "./shelter";
import type { Building, Villager, World } from "./types";

const cost = 3;
const gain = 15;
const waitTicks = 16;
const patientAction = "Attend des soins devant la clinique";
const nurseAction = "Soigne ses voisins";
const isNurse = (v: Villager) => v.age >= 18 && v.id % 8 === 4;
const atClinic = (v: Villager, b: Building) =>
  !v.route.length &&
  Math.hypot(v.x - v.target[0], v.y - v.target[1]) < 0.3 &&
  Math.hypot(v.x - b.x - 0.5, v.y - b.y - 2.5) <= 3;

function canParticipate(w: World, v: Villager) {
  return (
    !v.dead &&
    !v.visit &&
    !talkingPartner(w, v) &&
    !indoors(v, w) &&
    v.energy >= 25 &&
    v.thirst < 45 &&
    v.hunger < 50 &&
    !w.disasters?.some(
      (e) => e.kind === "fight" && e.life > 0 && e.people.includes(v.id),
    )
  );
}
function eligiblePatient(w: World, v: Villager) {
  return (
    !isNurse(v) &&
    v.age >= 3 &&
    v.health < 64 &&
    v.health > 0 &&
    canParticipate(w, v)
  );
}

export function clinicStatus(w: World, site: Building) {
  if (site.type !== "clinic") return null;
  const hour = hourOf(w.tick);
  const treatedToday =
    w.clinicTreatedAt !== undefined &&
    Math.floor(w.clinicTreatedAt / TICKS_PER_DAY) ===
      Math.floor(w.tick / TICKS_PER_DAY);
  const unsafe = w.disasters?.some(
    (e) =>
      e.life > 0 &&
      (e.kind === "quake" ||
        (["fire", "monster", "fight"].includes(e.kind) &&
          Math.hypot(site.x - e.x, site.y - e.y) < 4)),
  );
  const message =
    site.condition < 45 || unsafe
      ? "Les consultations sont suspendues : le bâtiment est abîmé ou le quartier est en danger."
      : treatedToday
        ? "Les soins du jour ont été donnés."
        : hour < 8 || hour >= 19
          ? "Les consultations reprennent à 8 h, à l’heure du village."
          : w.water < 28
            ? "La réserve est trop basse : il faut laisser 25 points d’eau au village."
            : !w.villagers.some(
                  (v) => isNurse(v) && v.health >= 50 && canParticipate(w, v),
                )
              ? "Aucun soignant n’est disponible pour l’instant."
              : null;
  return { message, treatedToday };
}

export function clinicDestination(w: World, v: Villager) {
  const site = w.buildings.find((b) => b.type === "clinic");
  if (!site || clinicStatus(w, site)?.message !== null) return null;
  if (eligiblePatient(w, v)) {
    return {
      target: [site.x - 0.5, site.y + 2.5] as [number, number],
      action: patientAction,
    };
  }
  if (
    isNurse(v) &&
    v.health >= 50 &&
    canParticipate(w, v) &&
    w.villagers.some(
      (p) =>
        eligiblePatient(w, p) &&
        (p.action === patientAction ||
          Math.hypot(p.x - site.x, p.y - site.y) < 8),
    )
  ) {
    return {
      target: [site.x + 1.5, site.y + 2.5] as [number, number],
      action: nurseAction,
    };
  }
  return null;
}

export function clinicConsultation(w: World, site: Building) {
  if (clinicStatus(w, site)?.message !== null) return null;
  const patient = w.villagers
    .filter(
      (v) =>
        eligiblePatient(w, v) &&
        v.action === patientAction &&
        atClinic(v, site),
    )
    .sort((a, b) => a.health - b.health || a.id - b.id)[0];
  const nurse = w.villagers.find(
    (v) =>
      isNurse(v) &&
      v.health >= 50 &&
      v.action === nurseAction &&
      atClinic(v, site) &&
      canParticipate(w, v),
  );
  return patient && nurse ? { patient, nurse } : null;
}

export function deliverClinicCare(w: World) {
  const site = w.buildings.find((b) => b.type === "clinic");
  const consult = site && clinicConsultation(w, site);
  if (!site || !consult) return null;
  const { patient, nurse } = consult;
  if (
    w.tick - Math.max(patient.actionAt ?? w.tick, nurse.actionAt ?? w.tick) <
    waitTicks
  )
    return null;
  w.water -= cost;
  patient.health = Math.min(100, patient.health + gain);
  w.clinicTreatedAt = w.tick;
  patient.action = "Repart après ses soins";
  patient.actionAt = w.tick;
  patient.nextDecision = w.tick + 1;
  return { site, nurse, patient, cost, gain };
}

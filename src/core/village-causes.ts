import type { Building, Villager, World } from "./types";
import { buildingWear, localHealth } from "./local-environment";
import { isWet, season } from "./seasons";
export interface VillageCause {
  id: string;
  title: string;
  detail: string;
}
const nearFire = (w: World, x: number, y: number, radius: number) =>
  w.disasters?.some(
    (e) =>
      e.kind === "fire" && e.life > 0 && Math.hypot(e.x - x, e.y - y) < radius,
  );

/** Explain current mechanisms, without inventing an unrecorded event history. */
export function villageCauses(w: World): VillageCause[] {
  const causes: VillageCause[] = [];
  const fires =
    w.disasters?.filter((e) => e.kind === "fire" && e.life > 0).length ?? 0;
  if (fires)
    causes.push({
      id: "fire",
      title: `${fires} incendie(s) en cours`,
      detail:
        "Les flammes abîment les bâtiments et brûlent les sols proches. Les habitants valides peuvent former une chaîne de seaux ; sans réserve d’eau, ils ne peuvent plus éteindre le feu.",
    });
  const well = w.buildings.find((b) => b.type === "well");
  if (well && well.condition < 70)
    causes.push({
      id: "well",
      title: "Un puits abîmé remplit moins les réserves",
      detail:
        "L’état du puits réduit son apport d’eau. La consommation des habitants et l’évaporation continuent ; réparer le puits aide à rétablir l’approvisionnement.",
    });
  else if (w.water < 35 || w.pressure > 40)
    causes.push({
      id: "water",
      title:
        w.pressure > 40
          ? "La réserve d’eau est sous pression"
          : "La réserve d’eau est faible",
      detail:
        w.pressure > 40
          ? "La pression fictive réduit l’apport du puits et accélère les pertes d’eau. La pluie ou la neige apportent de l’eau, tandis que les habitants continuent à boire."
          : "Les habitants et les seaux d’incendie prélèvent de l’eau dans la réserve commune. Le puits et les précipitations peuvent la remplir à nouveau.",
    });
  if (w.moisture < 45 || w.fertility < 50)
    causes.push({
      id: "soil",
      title: "Des sols secs affaiblissent les récoltes",
      detail:
        "La fertilité suit lentement l’humidité du sol. Quand elle baisse, les cultures produisent moins ; les réserves alimentaires peuvent alors diminuer malgré les récoltes.",
    });
  else if (w.pressure > 20)
    causes.push({
      id: "harvest",
      title: "La pression freine déjà les récoltes",
      detail:
        "Même avec un sol encore fertile, la pression fictive réduit la production. Les besoins alimentaires des habitants continuent à être prélevés dans les réserves.",
    });
  if (w.food < 35)
    causes.push({
      id: "food",
      title: "Le garde-manger se vide",
      detail:
        "Les repas font baisser la faim seulement si des vivres sont encore disponibles. Une faim durable creuse les joues et amaigrit les habitants ; des repas réguliers leur rendent progressivement des forces.",
    });
  if (causes.length < 4 && season(w.tick) === 3)
    causes.push({
      id: "winter",
      title: "L’hiver ralentit les cultures",
      detail:
        "La saison réduit les récoltes. Le village dépend davantage de ses réserves alimentaires pendant que les habitants continuent à se nourrir.",
    });
  if (causes.length < 4 && isWet(w))
    causes.push({
      id: "rain",
      title: "Les précipitations soutiennent la reprise",
      detail:
        "La pluie ou la neige ajoutent de l’eau et humidifient les sols. La fertilité, la végétation et les traces de brûlure récupèrent ensuite à leur propre rythme.",
    });
  if (!causes.length)
    causes.push({
      id: "stable",
      title: "Les ressources permettent encore la vie ordinaire",
      detail:
        "Le puits alimente les réserves, les cultures produisent et les habitants mangent et boivent. Les besoins continuent d’évoluer ; cet état n’est pas une promesse que les réserves resteront stables.",
    });
  return causes.slice(0, 4);
}
export function personCauses(w: World, v: Villager): VillageCause[] {
  if (v.dead)
    return [
      {
        id: "remains",
        title: "Une vie s’est arrêtée",
        detail:
          "Son corps reste dans le village et devient peu à peu un squelette. Ses souvenirs et ses liens restent consultables.",
      },
    ];
  const causes: VillageCause[] = [];
  if (v.hitAt !== undefined && w.tick >= v.hitAt && w.tick - v.hitAt < 12)
    causes.push({
      id: "hit",
      title: "Un coup vient d’être reçu",
      detail:
        "L’habitant réagit à l’impact. Les attaques et les bagarres peuvent réduire sa santé, indépendamment de la faim et de la soif.",
    });
  if (v.thirst > 85 || v.hunger > 90)
    causes.push({
      id: "health",
      title: "La privation fait baisser sa santé",
      detail:
        v.thirst > 85 && v.hunger > 90
          ? "Sa soif et sa faim ont atteint des niveaux dangereux. Boire et manger sont nécessaires pour sortir de cette situation."
          : v.thirst > 85
            ? "Sa soif a atteint un niveau dangereux. Il lui faut rejoindre un point d’eau dont la réserve n’est pas vide."
            : "Sa faim a atteint un niveau dangereux. Il lui faut un repas avec des vivres disponibles.",
    });
  if (v.health < 40 && v.thirst <= 85 && v.hunger <= 90 && causes.length < 3)
    causes.push({
      id: "recovery",
      title: "Sa santé reste fragile",
      detail:
        "La faim et la soif ne sont plus au niveau qui fait perdre de la santé. Sans nouveau coup ni autre danger, la récupération est progressive.",
    });
  if (v.hunger > 65)
    causes.push({
      id: "hunger",
      title: "La faim durable l’amaigrit",
      detail:
        w.food <= 1
          ? "Les réserves sont vides : chercher un repas ne suffit plus à calmer sa faim. Le manque de nourriture s’accumule dans son état nutritionnel."
          : "Sa faim s’accumule dans son état nutritionnel. Un repas à destination fait baisser la faim ; la silhouette ne retrouve pas ses forces immédiatement.",
    });
  else if ((v.malnutrition ?? 0) >= 20)
    causes.push({
      id: "nutrition",
      title: "Les traces du manque persistent",
      detail:
        v.hunger < 35
          ? "Il est à nouveau nourri, mais l’amaigrissement diminue lentement. Plusieurs repas réguliers sont nécessaires pour retrouver des forces."
          : "L’amaigrissement reflète les privations passées. Il ne commence à se résorber que lorsque la faim est suffisamment basse.",
    });
  if (v.thirst > 45 && causes.length < 3)
    causes.push({
      id: "thirst",
      title: "Il cherche à étancher sa soif",
      detail:
        w.water <= 1
          ? "La réserve d’eau est vide : atteindre un point d’eau ne suffit plus à boire."
          : "La soif baisse lorsqu’il atteint le puits ou un point d’eau avec une réserve disponible. Elle continue d’augmenter pendant le trajet.",
    });
  if (!causes.length && v.visit?.phase === "inside")
    causes.push({
      id: "rest",
      title: "Le repos à l’abri rend de l’énergie",
      detail:
        "L’habitant se repose à l’intérieur, puis ressort après sa visite ou plus tôt si ses besoins deviennent urgents. Une maison menacée doit être évacuée.",
    });
  if (!causes.length)
    causes.push({
      id: "ordinary",
      title: "Ses besoins sont encore supportables",
      detail:
        "Il suit son activité du moment. Sa faim, sa soif et son énergie continuent d’évoluer, puis il choisit un repas, de l’eau ou du repos selon ses besoins.",
    });
  return causes.slice(0, 3);
}
export function buildingCauses(w: World, b: Building): VillageCause[] {
  const causes: VillageCause[] = [];
  if (nearFire(w, b.x, b.y, 1))
    causes.push({
      id: "fire",
      title: "Le feu menace ce bâtiment",
      detail:
        "Les flammes au même emplacement réduisent son état. Une chaîne de seaux peut les maîtriser si les voisins sont valides et si la réserve d’eau le permet.",
    });
  if (b.condition <= 15)
    causes.push({
      id: "ruin",
      title: "Le bâtiment est en ruine",
      detail:
        b.type === "home"
          ? "Les habitants ne peuvent plus y entrer. Sa condition doit remonter avant que les visites reprennent."
          : "Son état très faible se voit dans les débris et les parties effondrées.",
    });
  if (w.pressure > 20)
    causes.push({
      id: "wear",
      title: "La pression use ce lieu",
      detail:
        localHealth(w, b.x, b.y) < 45
          ? "L’usure est renforcée par la sécheresse du sol proche et l’exposition propre à cet endroit. Deux bâtiments ne se dégradent donc pas forcément à la même vitesse."
          : "L’usure dépend de son exposition et de l’état du sol proche. Les dégâts d’incendie s’ajoutent à cette usure.",
    });
  else if (b.condition < 100 && buildingWear(w, b).repair > 0)
    causes.push({
      id: "upkeep",
      title: "L’entretien peut reprendre lentement",
      detail:
        b.type === "home"
          ? "La faible pression permet l’entretien courant. Des occupants vivants en bonne santé le renforcent ; l’état du bâtiment remonte progressivement."
          : "La faible pression permet à l’état du bâtiment de remonter progressivement, tant que de nouveaux dégâts ne l’emportent pas.",
    });
  if (["well", "reservoir"].includes(b.type))
    causes.push({
      id: "water",
      title:
        b.type === "well"
          ? "Ce puits participe à l’approvisionnement"
          : "La réserve reflète l’eau du village",
      detail:
        b.type === "well"
          ? "Son état et la pression déterminent l’apport d’eau. Boire, l’évaporation et les seaux d’incendie prélèvent dans la réserve commune."
          : "Le niveau montré est celui de la réserve commune. Il baisse avec les besoins du village et remonte avec l’approvisionnement et les précipitations.",
    });
  if (b.type === "farm")
    causes.push({
      id: "farm",
      title: "Les cultures dépendent de la terre et de la saison",
      detail:
        "La production alimentaire dépend de la fertilité globale, de la pression et de la saison. Les plantes et brûlures locales montrent aussi la santé de cette parcelle ; cet aspect local n’est pas un compteur de récolte supplémentaire.",
    });
  if (!causes.length)
    causes.push({
      id: "sound",
      title: "Ce lieu tient encore debout",
      detail:
        "Sa condition détermine son dessin et ses dégâts visibles. La pression, l’exposition, les incendies et l’entretien peuvent la faire évoluer.",
    });
  return causes.slice(0, 3);
}

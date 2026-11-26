export type Provenance = "demo" | "measured" | "estimated";
export type Scenario = "persistent" | "daily" | "session";
export interface UsageEvent {
  id: string;
  session: string;
  at: string;
  origin: string;
  provenance: Provenance;
  input: number;
  output: number;
  cached?: number;
  reasoning?: number;
  project?: string;
}
export interface Memory {
  tick: number;
  text: string;
  kind: "hope" | "warning" | "ordinary";
  person?: number;
}
export interface Villager {
  id: number;
  name: string;
  age: number;
  bornAt?: number;
  role: string;
  home: number;
  household: number;
  x: number;
  y: number;
  target: [number, number];
  route: [number, number][];
  action: string;
  actionAt?: number;
  visit?: import("./home-visits").HomeVisit;
  visitAfter?: number;
  aidAfter?: number;
  walkWait?: number;
  repairTarget?: number;
  hunger: number;
  malnutrition?: number;
  thirst: number;
  energy: number;
  health: number;
  hitAt?: number;
  hitSide?: -1 | 1;
  morale: number;
  trust: number;
  resilience: number;
  dead: boolean;
  diedAt?: number;
  ties: { id: number; bond: number; favors: number }[];
  memories: Memory[];
  cooldown: number;
  nextDecision?: number;
}
export interface Building {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  condition: number;
  events: Memory[];
}
export interface Settings {
  budget: number;
  curve: number;
  thresholds: number[];
  scenario: Scenario;
  reducedMotion: boolean;
  storyCamera: boolean;
  eventFrequency: number;
  retentionDays: number;
  includeInput: boolean;
  includeOutput: boolean;
  /** Budget follows the average daily usage of past days (default on). */
  adaptive?: boolean;
  usageProject?: string;
  usageSession?: string;
}
export interface World {
  stories?: import("./village-stories").StoryState;
  cropGrowth?: number[];
  lastBirthAt?: number;
  localEnvironment?: import("./local-environment").LocalEnvironment;
  disasters?: import("./apocalypse").Disaster[];
  version: 1;
  seed: number;
  tick: number;
  savedAt: number;
  session: string;
  day: string;
  settings: Settings;
  usage: UsageEvent[];
  pressure: number;
  /** Budget in force this tick (adaptive or fixed); derived, not authoritative. */
  budgetNow?: number;
  relief: number;
  lastUsageTick: number;
  water: number;
  food: number;
  moisture: number;
  fertility: number;
  vegetation: number;
  air: number;
  cooperation: number;
  unrest: number;
  weather: string;
  rainCollectedAt?: number;
  marketTradedAt?: number;
  villagers: Villager[];
  buildings: Building[];
  chronicle: Memory[];
  milestones: number[];
  replayIndex: number;
  replayOn: boolean;
  snapshots: {
    tick: number;
    population: number;
    pressure: number;
    session: string;
  }[];
  replay?: {
    events: UsageEvent[];
    cursor: number;
    startedTick: number;
    firstAt: number;
  };
}

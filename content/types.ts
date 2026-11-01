export type SkillArea =
  | "javascript_typescript"
  | "react_next"
  | "backend"
  | "databases"
  | "oop_solid"
  | "dsa"
  | "system_design"
  | "project"
  | "communication";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface DaySpec {
  day: number;
  title: string;
  skill: SkillArea;
  topics: string[];
  objectives: string[];
  questions: string[];
  assignments: string[];
  outcomes: string[];
  mock?: boolean;
  revision?: boolean;
}

export interface PhaseSpec {
  number: number;
  title: string;
  days: DaySpec[];
}

export interface QuestionSpec {
  slug: string;
  category: string;
  skill: SkillArea;
  difficulty: Difficulty;
  title: string;
  short: string;
  explanation: string;
  code?: string;
  realWorld?: string;
  followUps: string[];
  related: string[];
  keyPoints: string[];
  days: number[];
}

export interface ChallengeSpec {
  slug: string;
  category: string;
  skill: SkillArea;
  difficulty: Difficulty;
  title: string;
  description: string;
  input: string;
  output: string;
  hints: string[];
  explanation: string;
  code?: string;
  time: string;
  space: string;
}

export interface DesignSpec {
  slug: string;
  title: string;
  summary: string;
  functional: string[];
  nonFunctional: string[];
  api: string;
  schema: string;
  architecture: { layer: string; components: string[] }[];
  scaling: string[];
  caching: string[];
  security: string[];
  failure: string[];
  tradeoffs: string[];
  keyPoints: string[];
}

export interface MilestoneSpec {
  slug: string;
  title: string;
  description: string;
  targetDay: number;
  tasks: string[];
}

import type { ObjectId } from "mongodb";

export type Role = "admin" | "member";

export interface UserDoc {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  language: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: ObjectId;
  lastLoginAt?: Date;
}

export interface FileDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  mime: string;
  size: number;
  data: Buffer;
  createdAt: Date;
}

export interface ArtDoc {
  _id: ObjectId;
  key: string;
  mime: string;
  data: Buffer;
  prompt: string;
  createdAt: Date;
}

/* ---------- The person's story (accumulated evidence) ---------- */

export interface Experience {
  id: string;
  title: string;
  company: string;
  location?: string;
  start?: string; // "2020-03" or "2020"
  end?: string; // "present" or "2023-03"
  bullets: Bullet[];
  source?: string[]; // which sources contributed
}
export interface Bullet {
  id: string;
  text: string;
  confirm?: boolean; // number the person should confirm before use
  source?: string;
}
export interface Education {
  id: string;
  degree: string;
  school: string;
  year?: string;
  detail?: string;
}
export interface SimpleItem {
  id: string;
  text: string;
  year?: string;
  source?: string;
  confirm?: boolean;
}
export interface Strength {
  label: string;
  level: number; // 0-100, from evidence density
}
export interface ChartSpec {
  id: string;
  title: string;
  type: "bar" | "line";
  unit?: string;
  series: { label: string; value: number; confirm?: boolean }[];
  note?: string;
}

export interface Profile {
  name: string;
  headline?: string;
  location?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
  summary?: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
  strengths: Strength[];
  speaking: SimpleItem[];
  publications: SimpleItem[];
  certifications: SimpleItem[];
  languages: string[];
  awards: SimpleItem[];
  facts: { id: string; text: string; source: string; period?: string }[]; // atomic sourced facts
}

/* ---------- Stage 2 understanding ---------- */
export interface Understanding {
  fileName: string;
  pages?: number;
  readMs: number;
  detectedLanguage: string;
  lastUpdated?: string; // "2023-03"
  lastUpdatedLabel?: string; // "March 2023"
  gapLabel?: string; // "3½ years ago"
  seniority: string; // "senior product leader", "early-career developer", "CXO"
  track: "leader" | "builder" | "specialist";
  timeline: { period: string; text: string }[];
  note: string; // "This reads like a senior product leader's resume..."
  questionBudget: number;
}

/* ---------- Stage 3 candidates ---------- */
export interface Candidate {
  id: string;
  group: "linkedin" | "web";
  kind: string; // "Talk", "Article", "Code", "Profile", "Press", "Paper", "Listing"
  source: string; // "LinkedIn", "Medium", "GitHub"
  title: string;
  subtitle?: string;
  url: string;
  strength: "strong" | "possible" | "unlikely";
  why: string;
  date?: string; // "YYYY" or "YYYY-MM" when the page shows one
  addedByUser?: boolean;
  selected?: boolean;
}

export interface Extraction {
  candidateId: string;
  title: string;
  status: "pending" | "reading" | "done" | "failed";
  readMs?: number;
  took: string[];
  leftOut: { text: string; why: string }[];
  willAsk: string[];
  note?: string; // for "nothing taken" explanation
  useAnyway?: boolean;
  followed?: { url: string; title: string }[]; // linked pages Mosaic also opened
}

/* ---------- Stage 4 ---------- */
export interface Question {
  id: string;
  text: string;
  textLocalized?: string;
  why?: string;
  status: "open" | "answered" | "skipped";
  answerText?: string;
  answerLanguage?: string;
  answerTranslation?: string;
  durationSec?: number;
}

/* ---------- Stage 5 ---------- */
export interface Insight {
  n: number;
  tone: "good" | "warn";
  title: string;
  text: string;
  askPrompt?: string; // optional quick follow-up question
}

/* ---------- Stage 7 ---------- */
export interface Comment {
  id: string;
  sectionId: string;
  sectionLabel: string;
  text: string;
  mode: "spoken" | "typed";
  createdAt: string;
  resolution?: string;
  previous?: unknown; // previous section snapshot for undo
}

export interface ResumeDoc {
  look: "visual" | "classic";
  language: string;
  name: string;
  headline: string;
  location?: string;
  contact: { email?: string; phone?: string; linkedin?: string; website?: string };
  summary: string;
  experience: Experience[];
  education: Education[];
  strengths: Strength[];
  skills: string[];
  speaking: SimpleItem[];
  publications: SimpleItem[];
  certifications: SimpleItem[];
  awards: SimpleItem[];
  languages: string[];
  charts: ChartSpec[];
  pageTwoStartsAt?: string; // section id that begins page 2
  confirmations: { id: string; where: string; text: string; resolved?: boolean }[];
  checks: { twoPages: boolean; plainLanguage: boolean };
}

export interface ProjectDoc {
  _id: ObjectId;
  userId: ObjectId;
  title: string;
  stage: number; // 1..8 highest reached
  language: string; // language Mosaic talks in
  outputLanguage: string; // resume language
  secondLanguage?: string;
  createdAt: Date;
  updatedAt: Date;

  sourceFileId?: ObjectId;
  sourceText?: string;
  understanding?: Understanding;
  skippedUpload?: boolean;

  profile: Profile;

  research?: {
    status: "idle" | "running" | "done" | "failed";
    startedAt?: Date;
    finishedAt?: Date;
    pagesChecked: number;
    candidates: Candidate[];
    intro?: string;
    error?: string;
  };
  linkedinChoice?: string | "none";
  linkedinExport?: { text: string; fileName?: string; addedAt: Date };
  extractions: Extraction[];
  readingStatus?: "idle" | "running" | "done";

  questions: Question[];
  liveDraft?: string; // bullet being written as the person speaks

  targetRole?: string;
  roleSuggestions?: string[];
  jobDescription?: string;
  shape?: "leader" | "builder" | "specialist";
  shapeReason?: string;
  insights?: Insight[];

  look: "visual" | "classic";
  photoFileId?: ObjectId;
  resume?: ResumeDoc;
  resumeSecond?: ResumeDoc;
  craftStatus?: "idle" | "running" | "done" | "failed";
  comments: Comment[];
  infographicArtId?: ObjectId;

  shareSlug?: string;
  nudge?: boolean;
}

export type ProjectJSON = Omit<ProjectDoc, "_id" | "userId" | "sourceFileId" | "photoFileId" | "infographicArtId" | "createdAt" | "updatedAt"> & {
  id: string;
  sourceFileId?: string;
  photoFileId?: string;
  infographicArtId?: string;
  createdAt: string;
  updatedAt: string;
};

export function emptyProfile(name = ""): Profile {
  return {
    name,
    experience: [],
    education: [],
    skills: [],
    strengths: [],
    speaking: [],
    publications: [],
    certifications: [],
    languages: [],
    awards: [],
    facts: [],
  };
}

export function serializeProject(p: ProjectDoc): ProjectJSON {
  const { _id, userId, sourceFileId, photoFileId, infographicArtId, createdAt, updatedAt, ...rest } = p;
  void userId;
  return {
    ...rest,
    id: _id.toString(),
    sourceFileId: sourceFileId?.toString(),
    photoFileId: photoFileId?.toString(),
    infographicArtId: infographicArtId?.toString(),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

export const STAGES = [
  { n: 1, slug: "welcome", label: "Welcome" },
  { n: 2, slug: "upload", label: "Upload" },
  { n: 3, slug: "identity", label: "Is this you?" },
  { n: 4, slug: "talk", label: "Tell me more" },
  { n: 5, slug: "aim", label: "Aim" },
  { n: 6, slug: "look", label: "Look" },
  { n: 7, slug: "craft", label: "Craft" },
  { n: 8, slug: "ready", label: "Ready" },
] as const;

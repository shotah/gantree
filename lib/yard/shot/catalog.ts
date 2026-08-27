import type { OperatorRole } from "@/lib/yard/door/channels";
import type { BuildInput } from "@/lib/yard/crane/build";

export type ShotOperator = {
  name: string;
  passphrase: string;
  role: OperatorRole;
  cranes: string[];
  displayName: string;
  email: string;
  description: string;
  timezone: string;
  location: string;
  telegram: string;
};

export type ShotCrane = {
  slug: string;
  profile: NonNullable<BuildInput["profile"]>;
  model: string;
  channel: string;
  tags: string[];
  /** Extra .env (API keys, allowlist). */
  env: Record<string, string>;
  /** Write a dummy OAuth session so google/youtube count as published. */
  oauth: string[];
  about: ShotOperator["name"];
  self: string;
};

export const SHOT_PASS_BOB = "bob-dev-ok";
export const SHOT_PASS_REST = "yard-shot-ok";

export const SHOT_OPERATORS: ShotOperator[] = [
  {
    name: "bob",
    passphrase: SHOT_PASS_BOB,
    role: "admin",
    cranes: [],
    displayName: "Bob Kit",
    email: "bob@yard.local",
    description: "Owns the Mini. Builds cranes, keeps the door, reads the spend bar on Thursdays.",
    timezone: "America/Los_Angeles",
    location: "Portland, OR",
    telegram: "41001001",
  },
  {
    name: "mei",
    passphrase: SHOT_PASS_REST,
    role: "admin",
    cranes: [],
    displayName: "Mei Chen",
    email: "mei@yard.local",
    description: "Night operator. Calendars, maps, the boring adulting nobody else will do.",
    timezone: "America/Los_Angeles",
    location: "Portland, OR",
    telegram: "41001002",
  },
  {
    name: "sam",
    passphrase: SHOT_PASS_REST,
    role: "user",
    cranes: ["kit", "ada"],
    displayName: "Sam Ortega",
    email: "sam@yard.local",
    description: "Kit and Ada. Garmin days, spreadsheet nights, one thread that actually finishes.",
    timezone: "America/Chicago",
    location: "Austin, TX",
    telegram: "41001003",
  },
  {
    name: "nia",
    passphrase: SHOT_PASS_REST,
    role: "user",
    cranes: ["jules", "moss"],
    displayName: "Nia Okonkwo",
    email: "nia@yard.local",
    description: "Jules and Moss. Cast the living room. Never the WAN.",
    timezone: "America/New_York",
    location: "Brooklyn, NY",
    telegram: "41001004",
  },
  {
    name: "owen",
    passphrase: SHOT_PASS_REST,
    role: "readonly",
    cranes: ["piper"],
    displayName: "Owen Park",
    email: "owen@yard.local",
    description: "Looks at Piper. Does not recreate. Asks Bob when a grant goes dark.",
    timezone: "America/Denver",
    location: "Boulder, CO",
    telegram: "41001005",
  },
];

const TG = (names: string[]): string =>
  SHOT_OPERATORS.filter((o) => names.includes(o.name)).map((o) => o.telegram).join(",");

export const SHOT_CRANES: ShotCrane[] = [
  {
    slug: "kit",
    profile: "slim",
    model: "gemini-3.6-flash",
    channel: "telegram",
    tags: ["home"],
    env: {
      LLM_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      LLM_API_KEY: "shot-llm-kit",
      GEMINI_SEARCH_API_KEY: "shot-search-kit",
      TELEGRAM_BOT_TOKEN: "410000001:AAHshotKitxxxxxxxxxxxxxxxxxxxxxxx",
      TELEGRAM_ALLOWED_USERS: TG(["bob", "mei", "sam"]),
    },
    oauth: [],
    about: "bob",
    self: "I keep Bob's north-star list short. Search, math, then stop talking.",
  },
  {
    slug: "ada",
    profile: "life",
    model: "gemini-3.6-flash",
    channel: "telegram",
    tags: ["home", "life"],
    env: {
      LLM_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      LLM_API_KEY: "shot-llm-ada",
      GEMINI_SEARCH_API_KEY: "shot-search-ada",
      GOOGLE_OAUTH_CLIENT_ID: "shot-google-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "shot-google-secret",
      GOOGLE_MAPS_API_KEY: "shot-maps-ada",
      TELEGRAM_BOT_TOKEN: "410000002:AAHshotAdaxxxxxxxxxxxxxxxxxxxxxxx",
      TELEGRAM_ALLOWED_USERS: TG(["bob", "sam"]),
    },
    oauth: ["google"],
    about: "sam",
    self: "Sam's calendar is the job. Contacts first, then the hole, then the event.",
  },
  {
    slug: "jules",
    profile: "slim",
    model: "grok-4",
    channel: "telegram",
    tags: ["home", "guest"],
    env: {
      LLM_BASE_URL: "https://api.x.ai/v1",
      LLM_API_KEY: "shot-llm-jules",
      GEMINI_SEARCH_API_KEY: "shot-search-jules",
      TELEGRAM_BOT_TOKEN: "410000003:AAHshotJulesxxxxxxxxxxxxxxxxxxxxx",
      TELEGRAM_ALLOWED_USERS: TG(["nia", "mei"]),
    },
    oauth: [],
    about: "nia",
    self: "Guest crane. Fast answers. I do not keep the house keys.",
  },
  {
    slug: "moss",
    profile: "life-cast",
    model: "gemma3:12b",
    channel: "telegram",
    tags: ["home", "lab"],
    env: {
      LLM_BASE_URL: "http://127.0.0.1:11434/v1",
      LLM_API_KEY: "ollama",
      GEMINI_SEARCH_API_KEY: "shot-search-moss",
      GOOGLE_OAUTH_CLIENT_ID: "shot-google-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "shot-google-secret",
      GOOGLE_MAPS_API_KEY: "shot-maps-moss",
      YOUTUBE_OAUTH_CLIENT_ID: "shot-yt-id",
      YOUTUBE_OAUTH_CLIENT_SECRET: "shot-yt-secret",
      TELEGRAM_BOT_TOKEN: "410000004:AAHshotMossxxxxxxxxxxxxxxxxxxxxxx",
      TELEGRAM_ALLOWED_USERS: TG(["nia"]),
    },
    oauth: ["google", "youtube"],
    about: "nia",
    self: "Living room. Cast when she says so. The Mini is enough.",
  },
  {
    slug: "piper",
    profile: "life",
    model: "gpt-4.1-mini",
    channel: "telegram",
    tags: ["home"],
    env: {
      LLM_BASE_URL: "https://api.openai.com/v1",
      LLM_API_KEY: "shot-llm-piper",
      GEMINI_SEARCH_API_KEY: "shot-search-piper",
      GOOGLE_OAUTH_CLIENT_ID: "shot-google-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "shot-google-secret",
      GOOGLE_MAPS_API_KEY: "shot-maps-piper",
      TELEGRAM_BOT_TOKEN: "410000005:AAHshotPiperxxxxxxxxxxxxxxxxxxxxx",
      TELEGRAM_ALLOWED_USERS: TG(["owen", "bob"]),
    },
    oauth: [],
    about: "owen",
    self: "Owen watches. Google still needs the hop. I nag until someone clicks it.",
  },
];

export const SHOT_TAG_COLORS: Record<string, string> = {
  home: "red",
  life: "green",
  guest: "amber",
  lab: "sky",
};

export const SHOT_CRANE_USERS: Record<string, string[]> = {
  kit: ["41001001", "41001002", "41001003"],
  ada: ["41001001", "41001003"],
  jules: ["41001004", "41001002"],
  moss: ["41001004"],
  piper: ["41001005", "41001001"],
};

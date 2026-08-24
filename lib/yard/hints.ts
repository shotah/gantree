export type HintCopy = { hint: string; example?: string };

export const HINTS = {
  buildYard: {
    hint: "Where this crane runs. Home Mini can use life-cast (TV on the LAN). Cloud VM is a slim box — no mDNS, no cast.",
    example: "home Mini",
  },
  buildSlug: {
    hint: "Folder, container, and board name. Lowercase letter first, then letters, digits, or hyphen. Max 32.",
    example: "kit",
  },
  buildProfile: {
    hint: "Seed MCP for a *new* crane only. Grant or revoke later. slim = search + math. life adds Google + maps. life-cast adds TV (home only).",
    example: "slim (search + math)",
  },
  buildModel: {
    hint: "Completer model id written to LLM_MODEL. Must exist on the provider behind LLM_BASE_URL / LLM_API_KEY.",
    example: "gemini-3.6-flash",
  },
  buildChannel: {
    hint: "Mouth. Telegram is the usual walk. Discord and Slack tokens go in Secrets after build. stdio is a terminal, not chat.",
    example: "telegram",
  },
  botToken: {
    hint: "Telegram Bot API token from @BotFather after /newbot — not your Telegram login, not an LLM key. Digits, a colon, then a long secret.",
    example: "123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  },
  allowlist: {
    hint: "Numeric Telegram user ids who may talk to her — not @username. First id: Desktop → Settings → Advanced → Experimental → Show Peer IDs, or message @userinfobot.",
    example: "123456789",
  },
  hostRetain: {
    hint: "How long host CPU/RAM samples stay in yard sqlite. Shortening deletes older rows. Session idle is not this field.",
    example: "7",
  },
  turnRetain: {
    hint: "How long per-crane turn and spend samples stay. Graphs go empty if you cut this below the chart window.",
    example: "32",
  },
  timezone: {
    hint: "IANA name for day buckets on spend. Blank uses the host's local zone.",
    example: "America/Los_Angeles",
  },
  defaultImage: {
    hint: "Docker tag for *new* cranes. Existing compose tags stay until you pin/recreate that crane.",
    example: "shotah/ai-gantry:latest",
  },
  promptRate: {
    hint: "Optional $/1M for the spend calculator (prompt tokens). Not a bill — estimated chars/4 × this rate.",
    example: "0.15",
  },
  genRate: {
    hint: "Optional $/1M for generated tokens. Same calculator, not a provider invoice.",
    example: "0.60",
  },
  operatorName: {
    hint: "Login name for /login. 2–32 letters, digits, `.` `_` `-`.",
    example: "ada",
  },
  operatorPass: {
    hint: "Door passphrase, ≥10 characters. Not blank, not the login name, not a common password. There is no email reset.",
    example: "a long phrase you will remember",
  },
  operatorConfirm: {
    hint: "Type the same passphrase again. Mismatch refuses the save.",
  },
  operatorRole: {
    hint: "admin = whole yard (build, operators, every crane). user = assigned cranes, can grant/recreate/env/destroy. readonly = look only.",
    example: "user",
  },
  operatorCranes: {
    hint: "Which board slugs this user or readonly may open. Admin ignores this list.",
    example: "kit, tryout",
  },
  displayName: {
    hint: "What the header shows. Can differ from the login name. UUID stays the same if you rename.",
    example: "Ada",
  },
  loginName: {
    hint: "What /login asks for. Renaming does not mint a new operator.",
    example: "ada",
  },
  email: {
    hint: "A label on this operator — not a mailbox, not a reset path.",
    example: "ada@example.com",
  },
  profileBlurb: {
    hint: "Free text about you. Not sent to the crane. Max 280 characters.",
  },
  chatTelegram: {
    hint: "Your numeric Telegram user id, stored on you. Not wired into a crane allowlist until you add it there. Not @username.",
    example: "123456789",
  },
  chatSlack: {
    hint: "Slack member id from the profile (starts with U or W). Stored on you, not auto-copied onto a crane.",
    example: "U012ABCDEF",
  },
  chatDiscord: {
    hint: "Discord snowflake id (Developer Mode → Copy User ID). Stored on you, not auto-copied onto a crane.",
    example: "123456789012345678",
  },
  currentPass: {
    hint: "The passphrase you use at /login right now.",
  },
  newPass: {
    hint: "Replacement door passphrase, ≥10 characters. Same rules as setup.",
  },
  adminPass: {
    hint: "Sets their login passphrase. They have to sign in again. Same rules as setup. You do not need the old one.",
  },
  tgName: {
    hint: "Display name in Telegram (setMyName). Not the @username BotFather minted.",
    example: "Kit",
  },
  tgAbout: {
    hint: "Short bio under the name (setMyShortDescription). Shows on the profile card.",
    example: "Ada's long-horizon agent",
  },
  tgDescription: {
    hint: "Text in an empty chat (setMyDescription). First thing a stranger sees before they message.",
  },
  tgCommands: {
    hint: "The `/` menu. One per line: command then a dash then a blurb. /new distills the thread into SELF.md and drops history.",
    example: "tools - list granted MCP",
  },
  imagePin: {
    hint: "Compose image tag. pull + recreate docker-pulls this, keeps the host uid that owns data/, then waits for doctor.",
    example: "shotah/ai-gantry:latest",
  },
  persona: {
    hint: "Who she should be and who you are. New cranes get the ai-gantry template. Replace from template only fills the box — Save writes the file.",
  },
  injectUser: {
    hint: "Admin only. Copies selected operator profile fields into About you in the editor. Identity (the agent's name) stays put. Save still writes the file.",
  },
  self: {
    hint: "The agent's voice, rituals, and north-star aims. /new distills the thread here. Prune it — don't treat it as config.",
  },
  authCode: {
    hint: "Code from /auth in Telegram, or from the laptop hop catch page. MFA servers want the email code, not an OAuth URL.",
  },
  envRecreate: {
    hint: "The file is on disk. The running container still has the old environment. Recreate this crane — restart will not pick up the new values.",
  },
  destroyCrane: {
    hint: "Stops and removes the Docker container, then drops this crane from the yard. Assigned operators lose the slug. Files stay unless you check below.",
  },
  destroyFiles: {
    hint: "Deletes gantries/<slug>/ — persona, data, .env, mcp.toml. Unchecked keeps the folder so a later build can reuse it.",
  },
  craneTags: {
    hint: "Board labels — whose keys this crane bills, which house it belongs to. Not secrets. Letter first, then letters, digits, . _ -. Color is yard-wide: the same label stays the same hue on every card.",
    example: "home",
  },
  cloneCrane: {
    hint: "A new crane from this one. Mix the three: settings for keys and grants, persona files for voice, database for memories.",
  },
  cloneSlug: {
    hint: "New folder and container. Must differ from the source. Lowercase letter first, then letters, digits, or hyphen. Max 32.",
    example: "kit-copy",
  },
  cloneSettings: {
    hint: ".env keys and URLs, mcp.toml grants, board tags, and the image pin. Two cranes with the same Telegram token cannot both poll — stop one or paste a new token.",
  },
  clonePersona: {
    hint: "PERSONA.md, SELF.md, and avatar. Unchecked seeds the new slug from the template.",
  },
  cloneDatabase: {
    hint: "Copies gantry.db (memories). Unchecked starts empty. OAuth files and MCP bins stay with the source.",
  },
} as const satisfies Record<string, HintCopy>;

const ENV_HINTS: Record<string, HintCopy> = {
  LLM_BASE_URL: {
    hint: "OpenAI-compatible base URL for the completer. Blank uses the harness default (Gemini).",
    example: "https://generativelanguage.googleapis.com/v1beta/openai/",
  },
  LLM_API_KEY: {
    hint: "Provider key for the completer. Gemini: Google AI Studio. Not a Telegram bot token.",
    example: "AIzaSy…",
  },
  LLM_MODEL: {
    hint: "Model id the crane asks the completer for. Must exist on that provider.",
    example: "gemini-3.6-flash",
  },
  CHANNEL: {
    hint: "Mouth: telegram, discord, slack, or stdio. Changing this does not mint a new bot — paste that channel's token too.",
    example: "telegram",
  },
  TELEGRAM_BOT_TOKEN: HINTS.botToken,
  TELEGRAM_ALLOWED_USERS: {
    hint: "Comma or space separated numeric Telegram user ids. Not @username. Recreate after save.",
    example: "123456789,987654321",
  },
  DISCORD_BOT_TOKEN: {
    hint: "Discord bot token from the Developer Portal → Bot tab. Reset the token there if you only have the application id.",
    example: "MTIz.XXXX.XXXX",
  },
  SLACK_BOT_TOKEN: {
    hint: "Slack bot token (xoxb-). From the app's OAuth & Permissions, not the signing secret.",
    example: "xoxb-…",
  },
  SLACK_APP_TOKEN: {
    hint: "Slack app-level token (xapp-) for socket mode. From Basic Information → App-Level Tokens.",
    example: "xapp-…",
  },
  GEMINI_API_KEY: {
    hint: "Google AI Studio key for google-search (Gemini grounding). Not LLM_API_KEY, not the Workspace OAuth secret.",
    example: "AIzaSy…",
  },
  GOOGLE_API_KEY: {
    hint: "Alternate Google AI Studio key name. google-search accepts this instead of GEMINI_API_KEY.",
    example: "AIzaSy…",
  },
  USER_GOOGLE_EMAIL: {
    hint: "Default Google account for workspace tools (Gmail, Calendar, Drive). Not required for google-search. Not a password, not the AI Studio key.",
    example: "you@gmail.com",
  },
  GOOGLE_PSE_API_KEY: {
    hint: "Programmable Search Engine key for google__search_query. Not GEMINI_API_KEY. General web search uses google-search instead.",
    example: "AIzaSy…",
  },
  GOOGLE_PSE_ENGINE_ID: {
    hint: "Programmable Search Engine cx id that pairs with GOOGLE_PSE_API_KEY.",
    example: "012345678901234567890:abcdefghijk",
  },
  GEMINI_MODEL: {
    hint: "Optional Gemini model id for google-search. Blank uses the MCP default.",
    example: "gemini-3.1-pro-preview",
  },
  GOOGLE_GENAI_USE_VERTEXAI: {
    hint: "Set true to send google-search through Vertex AI instead of AI Studio. Then GOOGLE_CLOUD_PROJECT is required.",
    example: "true",
  },
  GOOGLE_CLOUD_PROJECT: {
    hint: "GCP project id for google-search on Vertex. Required when GOOGLE_GENAI_USE_VERTEXAI is on. Not an API key.",
    example: "my-gcp-project",
  },
  GOOGLE_CLOUD_LOCATION: {
    hint: "Vertex region for google-search. Blank defaults to global.",
    example: "global",
  },
  GOOGLE_MAPS_API_KEY: {
    hint: "Google Cloud Maps / Places key. Enable the APIs the maps MCP lists, then restrict the key.",
    example: "AIzaSy…",
  },
  GOOGLE_OAUTH_CLIENT_ID: {
    hint: "OAuth client id from Google Cloud (Web application). Looks like a long id ending in .apps.googleusercontent.com.",
    example: "123456789-abc.apps.googleusercontent.com",
  },
  GOOGLE_OAUTH_CLIENT_SECRET: {
    hint: "OAuth client secret that pairs with GOOGLE_OAUTH_CLIENT_ID. Not the AI Studio key.",
  },
  GARMIN_EMAIL: {
    hint: "Garmin account email the garmin MCP logs in as.",
    example: "you@example.com",
  },
  GARMIN_PASSWORD: {
    hint: "Garmin account password. MFA, if enabled, is a later prompt — not this field.",
  },
  STRAVA_CLIENT_ID: {
    hint: "Strava API application client id (not your athlete id). From https://www.strava.com/settings/api.",
    example: "123456",
  },
  STRAVA_CLIENT_SECRET: {
    hint: "Strava API client secret that pairs with STRAVA_CLIENT_ID. Then run the OAuth hop.",
  },
  X_BEARER_TOKEN: {
    hint: "X (Twitter) bearer token from the developer portal. App-only; not your password.",
    example: "AAAAAAAA…",
  },
  YOUTUBE_OAUTH_CLIENT_ID: {
    hint: "Google Cloud OAuth client id for YouTube (TV/device). Often the same project as Google, different client type.",
    example: "123456789-abc.apps.googleusercontent.com",
  },
  YOUTUBE_OAUTH_CLIENT_SECRET: {
    hint: "OAuth client secret that pairs with YOUTUBE_OAUTH_CLIENT_ID.",
  },
  FEEDS_USER_AGENT: {
    hint: "Contact User-Agent some feeds require (email or URL). Blank may work; set it if a feed 403s.",
    example: "kit-feeds (you@example.com)",
  },
  GOOGLE_HEALTH_CLIENT_ID: {
    hint: "OAuth client id for Google Health / Fitbit. Enable health.googleapis.com, Web application, loopback redirect.",
    example: "123456789-abc.apps.googleusercontent.com",
  },
  GOOGLE_HEALTH_CLIENT_SECRET: {
    hint: "OAuth client secret that pairs with GOOGLE_HEALTH_CLIENT_ID. Then the auth hop.",
  },
  SERPAPI_API_KEY: {
    hint: "SerpAPI key for Google Flights search. Free tier is a monthly search quota, not an LLM key.",
    example: "abc123…",
  },
  RENTCAST_API_KEY: {
    hint: "RentCast API key for US listings. Developer plan is a small monthly request quota.",
    example: "abc123…",
  },
  MARKETCHECK_API_KEY: {
    hint: "MarketCheck Cars API key for used/new inventory. Free plan is a monthly call quota.",
    example: "abc123…",
  },
};

const UNKNOWN_ENV: HintCopy = {
  hint: "Env for a granted tool. Paste the value from that provider. Blank leaves an existing secret unchanged.",
};

export function envHint(key: string): HintCopy {
  return ENV_HINTS[key] ?? UNKNOWN_ENV;
}

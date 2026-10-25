import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const DATA_VERSION = 1;
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isSnowflake(value) {
  return typeof value === "string" && SNOWFLAKE_PATTERN.test(value);
}

function makeDefaultConfig() {
  return {
    welcomeChannelId: null,
    modLogChannelId: null,
    autoRoleId: null,
    selfAssignableRoleIds: [],
  };
}

function normalizeConfig(raw) {
  const config = makeDefaultConfig();
  if (!isRecord(raw)) return config;

  for (const field of ["welcomeChannelId", "modLogChannelId", "autoRoleId"]) {
    config[field] = isSnowflake(raw[field]) ? raw[field] : null;
  }

  if (Array.isArray(raw.selfAssignableRoleIds)) {
    config.selfAssignableRoleIds = [
      ...new Set(raw.selfAssignableRoleIds.filter(isSnowflake)),
    ];
  }

  return config;
}

function normalizeWarnings(raw) {
  if (!isRecord(raw)) return {};

  const warnings = {};
  for (const [key, entries] of Object.entries(raw)) {
    const ids = key.split(":");
    if (ids.length !== 2 || !ids.every(isSnowflake) || !Array.isArray(entries)) {
      continue;
    }

    warnings[key] = entries.filter(
      (entry) =>
        isRecord(entry) &&
        typeof entry.id === "string" &&
        typeof entry.reason === "string" &&
        isSnowflake(entry.moderatorId) &&
        typeof entry.createdAt === "string" &&
        Number.isFinite(Date.parse(entry.createdAt)),
    );
  }

  return warnings;
}

export function normalizeStoreData(raw) {
  if (!isRecord(raw) || raw.version !== DATA_VERSION) {
    throw new Error("The Sukuna data file has an unsupported or invalid format.");
  }

  const guilds = {};
  if (isRecord(raw.guilds)) {
    for (const [guildId, config] of Object.entries(raw.guilds)) {
      if (isSnowflake(guildId)) guilds[guildId] = normalizeConfig(config);
    }
  }

  return {
    version: DATA_VERSION,
    guilds,
    warnings: normalizeWarnings(raw.warnings),
  };
}

export function warningKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

export class JsonStore {
  constructor(filePath) {
    this.filePath = resolve(filePath);
    this.data = { version: DATA_VERSION, guilds: {}, warnings: {} };
    this.saveQueue = Promise.resolve();
  }

  static fromEnvironment() {
    const directory = resolve(process.env.BOT_DATA_DIR || join(process.cwd(), "data"));
    return new JsonStore(join(directory, "sukuna-data.json"));
  }

  async load() {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      const text = await readFile(this.filePath, "utf8");
      this.data = normalizeStoreData(JSON.parse(text));
    } catch (error) {
      if (error?.code === "ENOENT") {
        this.data = { version: DATA_VERSION, guilds: {}, warnings: {} };
        return this;
      }

      if (error instanceof SyntaxError) {
        throw new Error(
          `Sukuna's data file is not valid JSON. It was left untouched at ${this.filePath}.`,
        );
      }

      throw error;
    }

    return this;
  }

  getGuildConfig(guildId) {
    if (!isSnowflake(guildId)) throw new Error("Invalid server ID.");
    this.data.guilds[guildId] ??= makeDefaultConfig();
    return this.data.guilds[guildId];
  }

  async setGuildConfig(guildId, patch) {
    if (!isSnowflake(guildId) || !isRecord(patch)) {
      throw new Error("Invalid server settings.");
    }

    const allowedFields = new Set([
      "welcomeChannelId",
      "modLogChannelId",
      "autoRoleId",
      "selfAssignableRoleIds",
    ]);
    const config = this.getGuildConfig(guildId);

    for (const [field, value] of Object.entries(patch)) {
      if (!allowedFields.has(field)) throw new Error("Unknown server setting.");
      if (field === "selfAssignableRoleIds") {
        if (!Array.isArray(value) || !value.every(isSnowflake)) {
          throw new Error("Invalid self-assignable role list.");
        }
        config[field] = [...new Set(value)];
      } else {
        if (value !== null && !isSnowflake(value)) {
          throw new Error(`Invalid value for ${field}.`);
        }
        config[field] = value;
      }
    }

    await this.save();
    return config;
  }

  getWarnings(guildId, userId) {
    return [...(this.data.warnings[warningKey(guildId, userId)] ?? [])];
  }

  async addWarning(guildId, userId, moderatorId, reason) {
    if (![guildId, userId, moderatorId].every(isSnowflake)) {
      throw new Error("Invalid warning record.");
    }

    const key = warningKey(guildId, userId);
    const entry = {
      id: randomUUID(),
      reason: String(reason).slice(0, 500),
      moderatorId,
      createdAt: new Date().toISOString(),
    };
    this.data.warnings[key] ??= [];
    this.data.warnings[key].push(entry);
    await this.save();
    return entry;
  }

  async clearWarnings(guildId, userId) {
    const key = warningKey(guildId, userId);
    const previousCount = this.data.warnings[key]?.length ?? 0;
    delete this.data.warnings[key];
    await this.save();
    return previousCount;
  }

  async save() {
    const operation = this.saveQueue.then(
      () => this.writeAtomically(),
      () => this.writeAtomically(),
    );
    this.saveQueue = operation.catch(() => {});
    return operation;
  }

  async writeAtomically() {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    const contents = `${JSON.stringify(this.data, null, 2)}\n`;

    try {
      await writeFile(temporaryPath, contents, { encoding: "utf8", mode: 0o600 });
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => {});
      throw error;
    }
  }
}

export function parseDuration(input) {
  const match = /^(\d+)\s*(s|m|h|d|w)$/i.exec(input ?? "");
  if (!match) return null;

  const amount = Number(match[1]);
  const unitMilliseconds = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  }[match[2].toLowerCase()];
  const milliseconds = amount * unitMilliseconds;

  if (
    !Number.isSafeInteger(amount) ||
    milliseconds < 1_000 ||
    milliseconds > 28 * 86_400_000
  ) {
    return null;
  }

  return milliseconds;
}

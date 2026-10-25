import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { handleMessage, parseCommand } from "../src/command-handler.js";
import { safeErrorMessage } from "../src/logging.js";
import { selfAssignableRoleProblem } from "../src/permissions.js";
import {
  JsonStore,
  normalizeStoreData,
  parseDuration,
} from "../src/store.js";

const guildId = "10000000000000001";
const userId = "20000000000000002";
const moderatorId = "30000000000000003";
const channelId = "40000000000000004";

test("prefix parser accepts lowercase s and ignores ordinary messages", () => {
  assert.deepEqual(parseCommand("s ping"), { command: "ping", args: [] });
  assert.deepEqual(parseCommand("s timeout @member 20m reason words"), {
    command: "timeout",
    args: ["@member", "20m", "reason", "words"],
  });
  assert.deepEqual(parseCommand("s"), { command: "", args: [] });
  assert.equal(parseCommand("someone said hi"), null);
  assert.equal(parseCommand("S ping"), null);
});

test("s avatar is not accepted as an alias for s av", async () => {
  const replies = [];
  const message = {
    author: { bot: false },
    guild: {},
    content: "s avatar",
    reply: async (payload) => replies.push(payload),
  };

  await handleMessage(message, {}, {});
  assert.match(replies[0].content, /Unknown command/);
});

test("duration parser accepts valid units and enforces Discord's 28-day limit", () => {
  assert.equal(parseDuration("30s"), 30_000);
  assert.equal(parseDuration("10m"), 600_000);
  assert.equal(parseDuration("2h"), 7_200_000);
  assert.equal(parseDuration("1d"), 86_400_000);
  assert.equal(parseDuration("4w"), 28 * 86_400_000);
  assert.equal(parseDuration("29d"), null);
  assert.equal(parseDuration("0m"), null);
  assert.equal(parseDuration("1h30m"), null);
  assert.equal(parseDuration("soon"), null);
});

test("error diagnostics redact token-like strings before logging", () => {
  const token = "abc.def.abcdefghijklmnopqrstuvwxyz0123456789";
  const message = safeErrorMessage(new Error(`Login failed using ${token}`), token);
  assert.equal(message, "Login failed using [REDACTED]");
  assert.doesNotMatch(message, /abcdefghijklmnopqrstuvwxyz/);
});

test("self-role validation rejects privileged and managed roles", () => {
  const makeRole = (id, permission = 0n, managed = false) => ({
    id,
    guild: { id: guildId },
    managed,
    permissions: new PermissionsBitField(permission),
  });

  assert.equal(selfAssignableRoleProblem(makeRole("50000000000000005")), null);
  assert.match(
    selfAssignableRoleProblem(
      makeRole("50000000000000005", PermissionFlagsBits.Administrator),
    ),
    /staff-level/,
  );
  assert.match(
    selfAssignableRoleProblem(makeRole("50000000000000005", 0n, true)),
    /Integration-managed/,
  );
  assert.match(selfAssignableRoleProblem(makeRole(guildId)), /@everyone/);
});

test("settings and warnings survive a store reload", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sukuna-store-test-"));
  try {
    const firstRun = await new JsonStore(join(directory, "sukuna-data.json")).load();
    await firstRun.setGuildConfig(guildId, {
      welcomeChannelId: channelId,
      selfAssignableRoleIds: ["50000000000000005"],
    });
    const warning = await firstRun.addWarning(
      guildId,
      userId,
      moderatorId,
      "Test warning",
    );

    const afterRestart = await new JsonStore(join(directory, "sukuna-data.json")).load();
    assert.equal(afterRestart.getGuildConfig(guildId).welcomeChannelId, channelId);
    assert.deepEqual(afterRestart.getGuildConfig(guildId).selfAssignableRoleIds, [
      "50000000000000005",
    ]);
    assert.deepEqual(afterRestart.getWarnings(guildId, userId), [warning]);
    assert.equal(await afterRestart.clearWarnings(guildId, userId), 1);
    assert.deepEqual(
      (await new JsonStore(join(directory, "sukuna-data.json")).load()).getWarnings(
        guildId,
        userId,
      ),
      [],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("store normalization drops invalid IDs and defaults bad settings safely", () => {
  const data = normalizeStoreData({
    version: 1,
    guilds: {
      [guildId]: {
        welcomeChannelId: "not-a-snowflake",
        modLogChannelId: channelId,
        selfAssignableRoleIds: ["50000000000000005", "bad"],
      },
      invalid: { welcomeChannelId: channelId },
    },
    warnings: null,
  });

  assert.deepEqual(data.guilds[guildId], {
    welcomeChannelId: null,
    modLogChannelId: channelId,
    autoRoleId: null,
    selfAssignableRoleIds: ["50000000000000005"],
  });
  assert.equal(data.guilds.invalid, undefined);
  assert.deepEqual(data.warnings, {});
  assert.throws(() => normalizeStoreData({ version: 99 }), /unsupported or invalid/);
});

test("invalid JSON is reported without overwriting the user's data file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sukuna-invalid-store-test-"));
  const filePath = join(directory, "sukuna-data.json");
  const original = "{ not valid json";

  try {
    await writeFile(filePath, original, "utf8");
    await assert.rejects(new JsonStore(filePath).load(), /not valid JSON/);
    assert.equal(await readFile(filePath, "utf8"), original);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

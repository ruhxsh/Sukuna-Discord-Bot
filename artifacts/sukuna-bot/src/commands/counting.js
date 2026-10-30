
import { PermissionFlagsBits } from "discord.js";
import { logError } from "../logging.js";
import {
  mentionedTextChannel,
  requireBotChannelPermission,
  requirePermission,
  requireTextChannel,
  UserFacingError,
} from "../permissions.js";

const INTEGER_PATTERN = /^\d+$/;
const NUMBER_LIKE_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const guildQueues = new Map();

async function withGuildQueue(guildId, operation) {
  const previous = guildQueues.get(guildId) ?? Promise.resolve();
  let release;

  const current = new Promise((resolve) => {
    release = resolve;
  });

  guildQueues.set(guildId, current);
  await previous;

  try {
    return await operation();
  } finally {
    release();

    if (guildQueues.get(guildId) === current) {
      guildQueues.delete(guildId);
    }
  }
}

export async function handleCountingSetup(message, store, disable = false) {
  requirePermission(message, PermissionFlagsBits.ManageGuild, "Manage Server");

  if (disable) {
    await store.setGuildConfig(message.guild.id, {
      countingChannelId: null,
    });

    await message.reply({
      content:
        "The counting game is disabled. The current and highest counts are saved.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const channel = mentionedTextChannel(message);

  if (
    !channel?.isTextBased?.() ||
    !channel.send ||
    channel.guild?.id !== message.guild.id
  ) {
    throw new UserFacingError(
      "Mention a text channel in this server, for example `s setcounting #counting`.",
    );
  }

  requireTextChannel(channel);

  requireBotChannelPermission(
    message.guild,
    channel,
    PermissionFlagsBits.AddReactions,
    "Add Reactions",
  );

  requireBotChannelPermission(
    message.guild,
    channel,
    PermissionFlagsBits.ManageMessages,
    "Manage Messages",
  );

  await store.setGuildConfig(message.guild.id, {
    countingChannelId: channel.id,
  });

  await message.reply({
    content: `The counting game is enabled in <#${channel.id}>. The current count is ${store.getGuildConfig(message.guild.id).currentCount}.`,
    allowedMentions: { repliedUser: false, parse: [] },
  });
}

export async function handleCountingMessage(message, store) {
  const guildId = message.guild?.id;
  const channelId = message.channel?.id;
  const content = message.content?.trim() ?? "";

  if (!guildId || !channelId || !NUMBER_LIKE_PATTERN.test(content)) {
    return false;
  }

  try {
    return await withGuildQueue(guildId, async () => {
      const config = store.getGuildConfig(guildId);

      if (config.countingChannelId !== channelId) {
        return false;
      }

      const botMember = message.guild.members.me;
      const channelPermissions = botMember
        ? message.channel.permissionsFor?.(botMember)
        : null;

      const canReact = channelPermissions?.has(
        PermissionFlagsBits.AddReactions,
      );

      const canDelete = channelPermissions?.has(
        PermissionFlagsBits.ManageMessages,
      );

      if (!canReact || !canDelete) {
        logError(
          new Error(
            "Missing Add Reactions or Manage Messages permission in the configured counting channel.",
          ),
          "Could not process a counting game message",
        );
        return true;
      }

      const count = Number(content);

      const accepted =
        INTEGER_PATTERN.test(content) &&
        Number.isSafeInteger(count) &&
        count >= 0 &&
        (await store.tryIncrementCounting(
          guildId,
          count,
          message.author.id,
        ));

      if (accepted) {
        try {
          await message.react("✅");
        } catch (error) {
          logError(error, "Could not add the counting game reaction");
        }
      } else {
        try {
          await message.delete();
        } catch (error) {
          logError(error, "Could not delete an incorrect counting message");
        }
      }

      return true;
    });
  } catch (error) {
    logError(error, "Could not process a counting game message");
    return true;
  }
}

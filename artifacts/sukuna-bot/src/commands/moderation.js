import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { sendModerationLog } from "../logging.js";
import {
  mentionedMember,
  requireBotChannelPermission,
  requireBotPermission,
  requireManageableMember,
  requirePermission,
  requireTextChannel,
  UserFacingError,
} from "../permissions.js";
import { parseDuration } from "../store.js";

const DEFAULT_REASON = "No reason provided.";
const MAX_PURGE_AMOUNT = 100;

function getTarget(message) {
  const target = mentionedMember(message);
  if (!target) {
    throw new UserFacingError("Tag a server member to use this command.");
  }
  return target;
}

function getReason(args, startAt) {
  const reason = args.slice(startAt).join(" ").trim() || DEFAULT_REASON;
  if (reason.length > 500) {
    throw new UserFacingError("Keep the reason under 500 characters.");
  }
  return reason;
}

async function reply(message, content) {
  return message.reply({
    content,
    allowedMentions: { repliedUser: false, parse: [] },
  });
}

async function handleKick(message, args, store) {
  requirePermission(message, PermissionFlagsBits.KickMembers, "Kick Members");
  requireBotPermission(message.guild, PermissionFlagsBits.KickMembers, "Kick Members");
  const target = getTarget(message);
  requireManageableMember(message, target);
  const reason = getReason(args, 1);

  await target.kick(reason);
  await sendModerationLog({
    guild: message.guild,
    store,
    action: "Kick",
    moderator: message.author,
    target: target.user,
    reason,
  });
  await reply(message, `Kicked **${target.user.tag}**. Reason: ${reason}`);
}

async function handleBan(message, args, store) {
  requirePermission(message, PermissionFlagsBits.BanMembers, "Ban Members");
  requireBotPermission(message.guild, PermissionFlagsBits.BanMembers, "Ban Members");
  const target = getTarget(message);
  requireManageableMember(message, target);
  const reason = getReason(args, 1);

  await target.ban({ reason });
  await sendModerationLog({
    guild: message.guild,
    store,
    action: "Ban",
    moderator: message.author,
    target: target.user,
    reason,
  });
  await reply(message, `Banned **${target.user.tag}**. Reason: ${reason}`);
}

async function handleTimeout(message, args, store) {
  requirePermission(message, PermissionFlagsBits.ModerateMembers, "Moderate Members");
  requireBotPermission(message.guild, PermissionFlagsBits.ModerateMembers, "Moderate Members");
  const target = getTarget(message);
  requireManageableMember(message, target);
  const duration = parseDuration(args[1]);
  if (!duration) {
    throw new UserFacingError(
      "Use a duration such as `30s`, `10m`, `2h`, `1d`, or `1w` (maximum 28 days).",
    );
  }
  const reason = getReason(args, 2);

  await target.timeout(duration, reason);
  await sendModerationLog({
    guild: message.guild,
    store,
    action: `Timeout (${args[1]})`,
    moderator: message.author,
    target: target.user,
    reason,
  });
  await reply(message, `Timed out **${target.user.tag}** for ${args[1]}. Reason: ${reason}`);
}

async function handleUntimeout(message, args, store) {
  requirePermission(message, PermissionFlagsBits.ModerateMembers, "Moderate Members");
  requireBotPermission(message.guild, PermissionFlagsBits.ModerateMembers, "Moderate Members");
  const target = getTarget(message);
  requireManageableMember(message, target);

  if (!target.communicationDisabledUntilTimestamp) {
    await reply(message, `**${target.user.tag}** is not timed out.`);
    return;
  }

  const reason = "Timeout removed by a moderator.";
  await target.timeout(null, reason);
  await sendModerationLog({
    guild: message.guild,
    store,
    action: "Remove timeout",
    moderator: message.author,
    target: target.user,
    reason,
  });
  await reply(message, `Removed the timeout from **${target.user.tag}**.`);
}

async function handleWarn(message, args, store) {
  requirePermission(message, PermissionFlagsBits.ModerateMembers, "Moderate Members");
  const target = getTarget(message);
  requireManageableMember(message, target);
  const reason = getReason(args, 1);

  const warning = await store.addWarning(
    message.guild.id,
    target.id,
    message.author.id,
    reason,
  );
  await sendModerationLog({
    guild: message.guild,
    store,
    action: `Warning ${warning.id.slice(0, 8)}`,
    moderator: message.author,
    target: target.user,
    reason,
  });
  await reply(message, `Warned **${target.user.tag}**. Reason: ${reason}`);
}

async function handleWarnings(message, store) {
  requirePermission(message, PermissionFlagsBits.ModerateMembers, "Moderate Members");
  const target = getTarget(message);
  const warnings = store.getWarnings(message.guild.id, target.id);

  if (!warnings.length) {
    await reply(message, `**${target.user.tag}** has no saved warnings.`);
    return;
  }

  const recent = warnings.slice(-10).reverse();
  const description = recent
    .map((warning, index) => {
      const date = new Date(warning.createdAt).toLocaleString();
      const reason =
        warning.reason.length > 220 ? `${warning.reason.slice(0, 217)}...` : warning.reason;
      return `**${warnings.length - index}.** ${reason}\nBy <@${warning.moderatorId}> · ${date}`;
    })
    .join("\n\n");

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(`Warnings for ${target.user.tag} (${warnings.length} total)`)
    .setDescription(description.slice(0, 4000));

  await message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
}

async function handleClearWarnings(message, store) {
  requirePermission(message, PermissionFlagsBits.ModerateMembers, "Moderate Members");
  const target = getTarget(message);
  const count = await store.clearWarnings(message.guild.id, target.id);

  if (count > 0) {
    await sendModerationLog({
      guild: message.guild,
      store,
      action: "Clear warnings",
      moderator: message.author,
      target: target.user,
      reason: `Cleared ${count} warning${count === 1 ? "" : "s"}.`,
    });
  }
  await reply(
    message,
    count
      ? `Cleared ${count} warning${count === 1 ? "" : "s"} for **${target.user.tag}**.`
      : `**${target.user.tag}** had no saved warnings.`,
  );
}

async function handlePurge(message, args, store) {
  requirePermission(message, PermissionFlagsBits.ManageMessages, "Manage Messages");
  requireTextChannel(message.channel);
  requireBotChannelPermission(
    message.guild,
    message.channel,
    PermissionFlagsBits.ManageMessages,
    "Manage Messages",
  );

  const amount = Number(args[0]);
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_PURGE_AMOUNT) {
    throw new UserFacingError("Choose a number from 1 to 100: `s purge 25`.");
  }

  const deleted = await message.channel.bulkDelete(amount, true);
  const count = deleted.size;
  if (count > 0) {
    await sendModerationLog({
      guild: message.guild,
      store,
      action: "Purge",
      moderator: message.author,
      target: message.author,
      reason: `Deleted ${count} recent message${count === 1 ? "" : "s"} in #${message.channel.name}.`,
    });
  }
  await message.channel.send({
    content: `Deleted ${count} recent message${count === 1 ? "" : "s"}. Messages older than 14 days are skipped by Discord.`,
    allowedMentions: { parse: [] },
  });
}

export async function handleModeration(message, command, args, store) {
  switch (command) {
    case "kick":
      await handleKick(message, args, store);
      return true;
    case "ban":
      await handleBan(message, args, store);
      return true;
    case "timeout":
      await handleTimeout(message, args, store);
      return true;
    case "untimeout":
      await handleUntimeout(message, args, store);
      return true;
    case "warn":
      await handleWarn(message, args, store);
      return true;
    case "warnings":
      await handleWarnings(message, store);
      return true;
    case "clearwarnings":
      await handleClearWarnings(message, store);
      return true;
    case "purge":
      await handlePurge(message, args, store);
      return true;
    default:
      return false;
  }
}

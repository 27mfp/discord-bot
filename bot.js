const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const prisma = new PrismaClient();

client.once("ready", () => {
  console.log(`Bot is ready! Logged in as ${client.user.tag}`);
  registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand()) {
    const { commandName } = interaction;
    console.log(`Command received: ${commandName}`);

    const commandHandlers = {
      leaderboard: handleLeaderboard,
      matches: handleMatches,
      markpaid: handleMarkPaid,
      playerdebt: handlePlayerDebt,
      debtlist: handleDebtList,
      jogo: handleJogo,
    };

    const handler = commandHandlers[commandName];
    if (handler) {
      try {
        await handler(interaction);
      } catch (error) {
        console.error(`Error in ${commandName} command:`, error);
        await interaction.reply({
          content: `An error occurred while executing the ${commandName} command.`,
          ephemeral: true,
        });
      }
    }
  } else if (interaction.isAutocomplete()) {
    const { commandName } = interaction;

    const autocompleteHandlers = {
      markpaid: handleMarkPaidAutocomplete,
      playerdebt: handlePlayerDebtAutocomplete,
      jogo: handleJogoAutocomplete,
    };

    const handler = autocompleteHandlers[commandName];
    if (handler) {
      try {
        await handler(interaction);
      } catch (error) {
        console.error(`Error in ${commandName} autocomplete:`, error);
        await interaction.respond([]);
      }
    }
  }
});

async function handleLeaderboard(interaction) {
  try {
    await interaction.deferReply();
    const pageSize = 10;
    let currentPage = 0;

    const totalPlayers = await prisma.player.count();
    const totalPages = Math.ceil(totalPlayers / pageSize);

    const fetchPlayersForPage = async (page) => {
      return prisma.player.findMany({
        skip: page * pageSize,
        take: pageSize,
        orderBy: { elo: "desc" },
      });
    };

    const generateLeaderboardEmbed = (players, page) => {
      const embed = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle("🏆 Leaderboard")
        .setDescription(
          `Top players ${page * pageSize + 1}-${
            page * pageSize + players.length
          } out of ${totalPlayers}`
        )
        .setThumbnail("attachment://trophy.png") // Use the attached image
        .setFooter({ text: `Page ${page + 1}/${totalPages}` })
        .setTimestamp();

      const leaderboardField = players
        .map((player, index) => {
          const globalRank = page * pageSize + index + 1;
          const medal =
            globalRank === 1
              ? "🥇"
              : globalRank === 2
              ? "🥈"
              : globalRank === 3
              ? "🥉"
              : `${globalRank}.`;
          return `${medal} **${player.name}**\nELO: ${player.elo.toFixed(
            2
          )} | Matches: ${player.matches} | Wins: ${player.wins}`;
        })
        .join("\n\n");

      embed.addFields({ name: "Rankings", value: leaderboardField });

      return embed;
    };

    const createMessage = async (page) => {
      const players = await fetchPlayersForPage(page);
      const embed = generateLeaderboardEmbed(players, page);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("previous")
          .setLabel("◀️ Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Next ▶️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages - 1)
      );

      // Attach the local image file
      const attachments = [
        { attachment: "./img/trophy.png", name: "trophy.png" },
      ];

      return { embeds: [embed], components: [row], files: attachments };
    };

    await interaction.editReply(await createMessage(currentPage));

    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({ time: 300000 });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: "You can't use these buttons.",
          ephemeral: true,
        });
        return;
      }

      await i.deferUpdate();
      if (i.customId === "previous") {
        currentPage = Math.max(0, currentPage - 1);
      } else if (i.customId === "next") {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
      }

      await i.editReply(await createMessage(currentPage));
    });

    collector.on("end", () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("previous")
          .setLabel("◀️ Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Next ▶️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true)
      );

      interaction.editReply({ components: [disabledRow] }).catch(console.error);
    });
  } catch (error) {
    console.error("Error in leaderboard command:", error);
    await interaction.editReply({
      content: "An error occurred while fetching the leaderboard.",
      components: [],
    });
  }
}
async function handleMatches(interaction) {
  console.log("Starting matches command");
  try {
    await interaction.deferReply();
    console.log("Interaction deferred");

    const pageSize = 5;
    let currentPage = 0;

    console.log("Fetching total match count");
    const totalMatches = await prisma.match.count();
    const totalPages = Math.ceil(totalMatches / pageSize);

    console.log(`Total matches: ${totalMatches}, Total pages: ${totalPages}`);

    const fetchMatchesForPage = async (page) => {
      console.log(`Fetching matches for page ${page}`);
      return prisma.match.findMany({
        skip: page * pageSize,
        take: pageSize,
        orderBy: {
          date: "desc",
        },
        include: {
          players: {
            include: {
              player: true,
            },
          },
        },
      });
    };

    const generateMatchesEmbed = (matches, page) => {
      console.log(`Generating matches embed for page ${page}`);
      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("⚽ Recent Matches")
        .setDescription(
          `Showing matches ${page * pageSize + 1}-${
            page * pageSize + matches.length
          } out of ${totalMatches}`
        )
        .setFooter({ text: `Page ${page + 1}/${totalPages}` });

      matches.forEach((match, index) => {
        const teams = match.players.reduce((acc, pm) => {
          if (!acc[pm.team]) {
            acc[pm.team] = [];
          }
          acc[pm.team].push(pm.player.name);
          return acc;
        }, {});

        let matchDetails = `📅 ${match.date.toDateString()}\n⏰ ${
          match.time
        }\n📍 ${match.location}\n\n`;
        Object.entries(teams).forEach(([teamName, players]) => {
          matchDetails += `**Team ${teamName}:** ${players.join(", ")}\n`;
        });

        if (match.result) {
          matchDetails += `\n**Result:** ${match.result}`;
        }

        embed.addFields({ name: `Match ${index + 1}`, value: matchDetails });
      });

      return embed;
    };

    const createMessage = async (page) => {
      console.log(`Creating message for page ${page}`);
      const matches = await fetchMatchesForPage(page);
      const embed = generateMatchesEmbed(matches, page);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("previous")
          .setLabel("◀️ Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Next ▶️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages - 1)
      );

      return { embeds: [embed], components: [row] };
    };

    console.log("Sending initial matches message");
    await interaction.editReply(await createMessage(currentPage));

    const message = await interaction.fetchReply();
    console.log("Matches message sent, setting up collector");

    const collector = message.createMessageComponentCollector({
      time: 300000, // 5 minutes
    });

    collector.on("collect", async (i) => {
      console.log(`Button clicked: ${i.customId}`);
      await i.deferUpdate();
      if (i.customId === "previous") {
        currentPage = Math.max(0, currentPage - 1);
      } else if (i.customId === "next") {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
      }

      console.log(`Updating matches to page ${currentPage}`);
      await i.editReply(await createMessage(currentPage));
    });

    collector.on("end", () => {
      console.log("Matches collector ended");
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("previous")
          .setLabel("◀️ Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Next ▶️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true)
      );

      interaction.editReply({ components: [disabledRow] }).catch(() => {
        console.log(
          "Failed to edit reply after collector end. Message may have been deleted."
        );
      });
    });

    console.log("Matches command completed successfully");
  } catch (error) {
    console.error("Error in matches command:", error);
    await interaction
      .editReply({
        content: "An error occurred while fetching the matches.",
        components: [],
      })
      .catch(console.error);
  }
}
async function handleMarkPaid(interaction) {
  try {
    const playerId = parseInt(interaction.options.getString("player"));
    const matchId = parseInt(interaction.options.getString("match"));

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    const match = await prisma.match.findUnique({ where: { id: matchId } });

    if (!player || !match) {
      await interaction.reply({
        content: "Invalid player or match selected.",
        ephemeral: true,
      });
      return;
    }

    const playerMatch = await prisma.playerMatch.findFirst({
      where: {
        playerId: playerId,
        matchId: matchId,
      },
    });

    if (!playerMatch) {
      await interaction.reply({
        content: `No record found for ${
          player.name
        } in the match on ${formatDate(match.date)} at ${match.location}.`,
        ephemeral: true,
      });
      return;
    }

    await prisma.playerMatch.update({
      where: {
        id: playerMatch.id,
      },
      data: {
        paid: true,
      },
    });

    const embed = new EmbedBuilder()
      .setColor("#00FF00")
      .setTitle("Payment Marked")
      .setDescription(
        `Successfully marked ${player.name} as paid for the match.`
      )
      .addFields(
        { name: "Date", value: formatDate(match.date), inline: true },
        { name: "Time", value: match.time, inline: true },
        { name: "Location", value: match.location, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in markpaid command:", error);
    await interaction.reply({
      content: "An error occurred while marking the player as paid.",
      ephemeral: true,
    });
  }
}
async function handlePlayerDebt(interaction) {
  console.log("Starting playerdebt command");
  try {
    const playerId = parseInt(interaction.options.getString("player"));

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        playerMatches: {
          where: { paid: false },
          include: {
            match: {
              include: {
                players: true,
              },
            },
          },
        },
      },
    });

    if (!player) {
      await interaction.reply("Invalid player selected.");
      return;
    }

    if (player.playerMatches.length === 0) {
      await interaction.reply(`${player.name} doesn't owe any money.`);
      return;
    }

    let totalDebt = 0;
    let matchDetails = "";

    player.playerMatches.forEach((playerMatch, index) => {
      const match = playerMatch.match;
      const playerCount = match.players.length;
      const debtForThisMatch = match.price / playerCount;
      totalDebt += debtForThisMatch;
      matchDetails += `${index + 1}. ${
        match.date.toISOString().split("T")[0]
      } - ${match.time} - ${match.location} (€${debtForThisMatch.toFixed(
        2
      )})\n`;
    });

    const embed = new EmbedBuilder()
      .setColor("#FF4500")
      .setTitle(`${player.name}'s Debt`)
      .setDescription(`Total amount owed: €${totalDebt.toFixed(2)}`)
      .addFields(
        { name: "Unpaid Matches", value: matchDetails },
        { name: "Current ELO", value: player.elo.toFixed(0) },
        { name: "Total Matches", value: player.matches.toString() },
        { name: "Wins", value: player.wins.toString() }
      );

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in playerdebt command:", error);
    await interaction.reply(
      "An error occurred while fetching player debt information."
    );
  }
}
async function handleDebtList(interaction) {
  console.log("Starting debtlist command");
  try {
    await interaction.deferReply();

    const playersWithDebt = await prisma.player.findMany({
      where: {
        playerMatches: {
          some: {
            paid: false,
          },
        },
      },
      include: {
        playerMatches: {
          where: {
            paid: false,
          },
          include: {
            match: {
              include: {
                players: true,
              },
            },
          },
        },
      },
    });

    if (playersWithDebt.length === 0) {
      await interaction.editReply("No players currently owe any money.");
      return;
    }

    const debtList = playersWithDebt
      .map((player) => {
        const totalDebt = player.playerMatches.reduce((sum, pm) => {
          const playersInMatch = pm.match.players.length;
          return sum + pm.match.price / playersInMatch;
        }, 0);
        return {
          name: player.name,
          debt: totalDebt,
          unpaidGames: player.playerMatches.length,
        };
      })
      .sort((a, b) => b.debt - a.debt);

    const createEmbed = (players, pageNumber, totalPages) => {
      const embed = new EmbedBuilder()
        .setColor("#FF4500")
        .setTitle(`Players Owing Money (Page ${pageNumber}/${totalPages})`)
        .setDescription("List of players with outstanding debts");

      const debtListText = players
        .map(
          (player, index) =>
            `${index + 1}. **${player.name}**\n   €${player.debt.toFixed(2)} (${
              player.unpaidGames
            } unpaid game${player.unpaidGames > 1 ? "s" : ""})`
        )
        .join("\n\n");

      embed.addFields({ name: "Debt List", value: debtListText });

      return embed;
    };

    const PLAYERS_PER_PAGE = 10;
    const totalPages = Math.ceil(debtList.length / PLAYERS_PER_PAGE);

    const embeds = [];
    for (let i = 0; i < debtList.length; i += PLAYERS_PER_PAGE) {
      const pageNumber = Math.floor(i / PLAYERS_PER_PAGE) + 1;
      const playersOnPage = debtList.slice(i, i + PLAYERS_PER_PAGE);
      embeds.push(createEmbed(playersOnPage, pageNumber, totalPages));
    }

    if (embeds.length === 1) {
      await interaction.editReply({ embeds });
    } else {
      let currentPage = 0;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("previous")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary)
      );

      const updateMessage = async () => {
        await interaction.editReply({
          embeds: [embeds[currentPage]],
          components: [row],
        });
      };

      await updateMessage();

      const message = await interaction.fetchReply();

      const collector = message.createMessageComponentCollector({
        filter: (i) =>
          i.user.id === interaction.user.id &&
          (i.customId === "previous" || i.customId === "next"),
        time: 60000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "previous") {
          currentPage = (currentPage - 1 + embeds.length) % embeds.length;
        } else if (i.customId === "next") {
          currentPage = (currentPage + 1) % embeds.length;
        }
        await i.update({
          embeds: [embeds[currentPage]],
          components: [row],
        });
      });

      collector.on("end", () => {
        row.components.forEach((button) => button.setDisabled(true));
        interaction.editReply({ components: [row] }).catch(console.error);
      });
    }
  } catch (error) {
    console.error("Error in debtlist command:", error);
    await interaction.editReply(
      "An error occurred while fetching the debt list."
    );
  }
}
async function handleJogo(interaction) {
  console.log("Starting jogo command");
  try {
    await interaction.deferReply();
    const matchId = parseInt(interaction.options.getString("jogo"));

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        players: {
          include: {
            player: true,
          },
        },
      },
    });

    if (!match) {
      await interaction.editReply("Jogo não encontrado.");
      return;
    }

    const embed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle(`Detalhes do Jogo`)
      .setDescription(`Jogo em ${formatDate(match.date)}`);

    const teams = match.players.reduce((acc, pm) => {
      if (!acc[pm.team]) {
        acc[pm.team] = [];
      }
      acc[pm.team].push(pm.player.name);
      return acc;
    }, {});

    let matchDetails = `📅 ${formatDate(match.date)}\n⏰ ${match.time}\n📍 ${
      match.location
    }\n💰 Preço: €${match.price.toFixed(2)}\n\n`;
    Object.entries(teams).forEach(([teamName, players]) => {
      matchDetails += `**Equipe ${teamName}:** ${players.join(", ")}\n`;
    });

    if (match.result) {
      matchDetails += `\n**Resultado:** ${match.result}`;
    }

    embed.addFields({ name: "Detalhes do Jogo", value: matchDetails });

    await interaction.editReply({ embeds: [embed] });
    console.log("Jogo command completed successfully");
  } catch (error) {
    console.error("Error in jogo command:", error);
    await interaction.editReply(
      "Ocorreu um erro ao buscar os detalhes do jogo."
    );
  }
}
async function handleMarkPaidAutocomplete(interaction) {
  const focusedOption = interaction.options.getFocused(true);
  let choices = [];

  if (focusedOption.name === "player") {
    choices = await getPlayerChoices(focusedOption.value);
  } else if (focusedOption.name === "match") {
    choices = await getMatchChoices(focusedOption.value);
  }

  await interaction.respond(choices);
}

async function handlePlayerDebtAutocomplete(interaction) {
  const focusedOption = interaction.options.getFocused(true);
  if (focusedOption.name === "player") {
    const choices = await getPlayerChoices(focusedOption.value);
    await interaction.respond(choices);
  }
}

async function handleJogoAutocomplete(interaction) {
  const focusedValue = interaction.options.getFocused();
  const choices = await getMatchChoices(focusedValue);
  await interaction.respond(choices);
}

async function getPlayerChoices(searchTerm) {
  const players = await prisma.player.findMany({
    take: 25,
    where: {
      name: {
        contains: searchTerm,
        mode: "insensitive",
      },
    },
    orderBy: {
      name: "asc",
    },
  });
  return players.map((player) => ({
    name: player.name,
    value: player.id.toString(),
  }));
}

async function getMatchChoices(searchTerm) {
  const dateFilter = getDateFilter(searchTerm);
  const matches = await prisma.match.findMany({
    take: 25,
    where: {
      OR: [
        { date: dateFilter },
        {
          location: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
      ],
    },
    orderBy: {
      date: "desc",
    },
  });
  return matches.map((match) => ({
    name: `${formatDate(match.date)} - ${match.time} - ${match.location}`,
    value: match.id.toString(),
  }));
}

function getDateFilter(searchTerm) {
  const searchDate = new Date(searchTerm);
  if (!isNaN(searchDate.getTime())) {
    const nextDay = new Date(searchDate);
    nextDay.setDate(nextDay.getDate() + 1);
    return {
      gte: searchDate,
      lt: nextDay,
    };
  }
  return {};
}

function formatDate(date) {
  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, "-");
}

async function registerCommands() {
  console.log("Registering slash commands");
  const commands = [
    {
      name: "leaderboard",
      description: "Show the player leaderboard",
    },
    {
      name: "matches",
      description: "Show recent matches",
    },
    {
      name: "markpaid",
      description: "Mark a player as paid for a specific match",
      options: [
        {
          name: "player",
          type: 3,
          description: "Select the player",
          required: true,
          autocomplete: true,
        },
        {
          name: "match",
          type: 3,
          description: "Select the match",
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      name: "playerdebt",
      description: "Show how much a player owes",
      options: [
        {
          name: "player",
          type: 3,
          description: "Select the player",
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      name: "debtlist",
      description: "Show a list of players who owe money",
    },
    {
      name: "jogo",
      description: "Mostrar detalhes de um jogo específico",
      options: [
        {
          name: "jogo",
          type: 3,
          description: "Selecione o jogo",
          required: true,
          autocomplete: true,
        },
      ],
    },
  ];

  try {
    console.log("Started refreshing application (/) commands.");
    await client.application.commands.set(commands);
    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error("Error registering commands:", error);
  }
}

client.login(process.env.DISCORD_TOKEN);

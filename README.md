# Football Match Management Discord Bot

This Discord bot helps manage football matches, player statistics, and payments for a local football group.

## Features

- Display player leaderboard
- Show recent matches
- Mark players as paid for specific matches
- Display player debts
- Show a list of players who owe money
- Display details of a specific match

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- A Discord account and a registered Discord application/bot
- PostgreSQL database

## Installation

1. Clone this repository:

   ```
   git clone https://github.com/yourusername/football-match-bot.git
   cd football-match-bot
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Set up your environment variables:
   Create a `.env` file in the root directory and add the following:

   ```
   DISCORD_TOKEN=your_discord_bot_token
   DATABASE_URL=your_postgresql_database_url
   ```

4. Set up the database:

   ```
   npx prisma migrate dev
   ```

5. Start the bot:
   ```
   npm start
   ```

## Usage

The bot responds to the following slash commands:

- `/leaderboard`: Show the player leaderboard
- `/matches`: Show recent matches
- `/markpaid`: Mark a player as paid for a specific match
- `/playerdebt`: Show how much a player owes
- `/debtlist`: Show a list of players who owe money
- `/jogo`: Show details of a specific match

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

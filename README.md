# EverQuest Charm Pet Finder

A web application for finding the best charm pets in EverQuest (Quarm server) based on zone and charm spell selection.

## Features

- **Zone Selection**: Browse all available zones with spawned NPCs
- **Charm Spell Selection**: Choose from various charm spells (defaults to Boltran's Agacerie, max level 53)
- **NPC Statistics**: View detailed stats for charmable NPCs including:
  - Level, HP, and damage output
  - Magic Resist (MR) - crucial for charm success
  - AC, ATK, and attack speed
  - Base stats (STR, DEX, AGI)
  - Calculated DPS and average damage

## Prerequisites

- Node.js (v14 or higher)
- MySQL Server
- Quarm database dump (included in `dump/` directory)

## Installation

1. **Clone or download this repository**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up the database:**
   - Follow instructions in `database-setup.md`
   - Create a MySQL database named `quarm`
   - Import the SQL files in order:
     ```sql
     SOURCE dump/quarm_2025-11-02-07_55/quarm_2025-11-02-07_55.sql;
     SOURCE dump/quarm_2025-11-02-07_55/player_tables_2025-11-02-07_55.sql;
     SOURCE dump/quarm_2025-11-02-07_55/login_tables_2025-11-02-07_55.sql;
     ```

4. **Configure environment:**
   - Copy `.env.example` to `.env`
   - Update database credentials:
     ```
     DB_HOST=localhost
     DB_USER=root
     DB_PASSWORD=your_password
     DB_NAME=quarm
     ```

## Usage

1. **Start the server:**
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

2. **Open your browser:**
   - Navigate to `http://localhost:3000`

3. **Find charm pets:**
   - Select a zone from the dropdown
   - Choose a charm spell (defaults to Boltran's Agacerie)
   - Click "Search for Charm Pets"
   - Browse the results sorted by level

## How It Works

The application queries the Quarm database to find NPCs that meet the following criteria:
- Located in the selected zone
- Level is at or below the charm spell's maximum level
- Body type is Humanoid (1) or Animal (21)
- Has positive HP and level

Results show key statistics to help you choose the best charm pet:
- **Magic Resist (MR)**: Lower is better for charm success (color-coded)
- **Max Hit & DPS**: Higher damage output is better
- **HP**: More hit points means the pet survives longer
- **Stats**: STR, DEX, AGI affect combat performance

## Project Structure

```
eqpetfinder/
├── server.js              # Express backend API
├── package.json           # Node.js dependencies
├── .env                   # Environment configuration (create from .env.example)
├── database-setup.md      # Database setup instructions
├── public/                # Frontend files
│   ├── index.html         # Main HTML page
│   ├── styles.css         # Styling
│   └── app.js             # Frontend JavaScript
└── dump/                  # Quarm database dump
    └── quarm_2025-11-02-07_55/
```

## API Endpoints

- `GET /api/zones` - Get all zones with spawned NPCs
- `GET /api/charm-spells` - Get list of charm spells
- `GET /api/npcs/:zone?maxLevel=X` - Get charmable NPCs for a zone
- `GET /api/health` - Check database connection

## Tips for Choosing Charm Pets

1. **Magic Resist**: Lower MR means easier to charm and less likely to break
2. **Level**: Higher level pets generally deal more damage
3. **DPS**: Calculated damage per second gives you overall effectiveness
4. **HP**: Higher HP pets survive longer in combat
5. **Attack Speed**: Faster attack speed can be beneficial for proc-based effects

## Troubleshooting

- **Can't connect to database**: Check MySQL is running and credentials in `.env` are correct
- **No NPCs showing**: Ensure all SQL files were imported successfully
- **Port already in use**: Change `PORT` in `.env` to a different number

## License

ISC

## Credits

Database dump from Quarm (EQMacEmu) server

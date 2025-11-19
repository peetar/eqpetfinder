# EverQuest Charm Pet Finder

A web application for finding the best charm pets in EverQuest (Quarm server) based on zone and charm spell selection.

## Features

- **Zone Selection**: Browse all available zones with spawned NPCs
- **Charm Spell Selection**: Choose from charm spells across multiple classes:
  - Enchanter (9 spells)
  - Bard (3 spells)
  - Necromancer (7 undead-only spells)
  - Druid (8 animal-only spells)
- **NPC Statistics**: View detailed stats for charmable NPCs including:
  - Level range (min-max) with warnings for NPCs that can spawn above charm level
  - HP and max damage output
  - Magic Resist (MR) - crucial for charm success (color-coded, warnings for MR > 80)
  - Body Type (Animal, Undead, Humanoid, Giant, etc.)
  - Class information
  - Summon ability warnings
  - Links to pqdi.cc NPC database

## Prerequisites

- Node.js (v14 or higher)
- **No database required!** All data is stored in JSON format

## Installation

1. **Clone or download this repository**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **That's it!** The NPC data is included in `npc-data.json` (6.5 MB)

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
   - Browse the results sorted by max damage

## Deployment

This app is ready to deploy to Vercel with zero configuration:

```bash
vercel
```

The JSON data file is included in the repository, so no external database is needed.

## How It Works

The application filters NPCs from `npc-data.json` based on:
- Located in the selected zone
- Level is at or below the charm spell's maximum level
- Body type filtering:
  - Always excludes: Trap, Timer, Atenha Ra
  - Necromancer spells: Also exclude Humanoid (undead only)
  - Druid spells: Also exclude Humanoid (animal only)
- Excludes uncharmable NPCs (special ability code 14)
- Has positive HP and level

Results show key statistics:
- **Level Range**: Shows if NPC can spawn above charm level (⚠️)
- **Magic Resist (MR)**: Lower is better, warnings for MR > 80 (⚠️)
- **Summon**: Warning if NPC can summon (⚠️)
- **Max Hit**: Higher damage output is better
- **HP**: More hit points means the pet survives longer

## Project Structure

```
eqpetfinder/
├── server.js              # Express backend API
├── package.json           # Node.js dependencies
├── npc-data.json          # NPC data (6.5 MB, 15k+ NPCs)
├── export-data.js         # Script to export data from MySQL (optional)
├── vercel.json            # Vercel deployment config
├── public/                # Frontend files
│   ├── index.html         # Main HTML page
│   ├── styles.css         # Styling
│   └── app.js             # Frontend JavaScript
└── dump/                  # Original MySQL dump (not needed for running app)
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

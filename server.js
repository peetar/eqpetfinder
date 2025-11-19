require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quarm',
  port: process.env.DB_PORT || 3306
};

// Create database pool
const pool = mysql.createPool(dbConfig);

// NPC Class mapping
const NPC_CLASSES = {
  1: 'Warrior',
  2: 'Cleric',
  3: 'Paladin',
  4: 'Ranger',
  5: 'Shadow Knight',
  6: 'Druid',
  7: 'Monk',
  8: 'Bard',
  9: 'Rogue',
  10: 'Shaman',
  11: 'Necromancer',
  12: 'Wizard',
  13: 'Magician',
  14: 'Enchanter',
  15: 'Beastlord',
  16: 'Berserker',
  20: 'Merchant',
  21: 'Banker',
  40: 'Warrior GM',
  41: 'Cleric GM',
  60: 'Merchant GM',
  61: 'Banker GM'
};

// NPC Bodytype mapping
const NPC_BODYTYPES = {
  1: 'Humanoid',
  2: 'Lycanthrope',
  3: 'Undead',
  4: 'Giant',
  5: 'Construct',
  6: 'Extraplanar',
  7: 'Magical',
  8: 'Summoned',
  9: 'No Target',
  10: 'Vampire',
  11: 'Atenha Ra',
  12: 'Greater Akheva',
  13: 'Khati Sha',
  21: 'Animal',
  22: 'Insect',
  23: 'Monster',
  24: 'Summoned2',
  25: 'Plant',
  26: 'Dragon',
  27: 'Summoned3',
  28: 'Dragon2',
  65: 'Untargetable',
  66: 'Trap',
  67: 'Timer'
};

// Charm spell data
const CHARM_SPELLS = [
  // Enchanter
  { id: 1, name: "Command of Druzzil", maxLevel: 64, classes: ['Enchanter'], bodytype: 'any' },
  { id: 2, name: "Dictate", maxLevel: 58, classes: ['Enchanter'], bodytype: 'any' },
  { id: 3, name: "Beckon", maxLevel: 57, classes: ['Enchanter'], bodytype: 'any' },
  { id: 4, name: "Boltran's Agacerie", maxLevel: 53, classes: ['Enchanter'], bodytype: 'any' },
  { id: 5, name: "Allure", maxLevel: 51, classes: ['Enchanter'], bodytype: 'any' },
  { id: 6, name: "Cajoling Whispers", maxLevel: 46, classes: ['Enchanter'], bodytype: 'any' },
  { id: 7, name: "Dire Charm", maxLevel: 46, classes: ['Enchanter'], bodytype: 'any' },
  { id: 8, name: "Beguile", maxLevel: 37, classes: ['Enchanter'], bodytype: 'any' },
  { id: 9, name: "Charm", maxLevel: 25, classes: ['Enchanter'], bodytype: 'any' },
  
  // Bard
  { id: 10, name: "Call of the Banshee", maxLevel: 57, classes: ['Bard'], bodytype: 'any' },
  { id: 11, name: "Solon's Bewitching Bravura", maxLevel: 51, classes: ['Bard'], bodytype: 'any' },
  { id: 12, name: "Solon's Song of the Sirens", maxLevel: 37, classes: ['Bard'], bodytype: 'any' },
  
  // Necromancer (Undead only)
  { id: 13, name: "Word of Terris (undead)", maxLevel: 60, classes: ['Necromancer'], bodytype: 'undead' },
  { id: 14, name: "Enslave Death (undead)", maxLevel: 55, classes: ['Necromancer'], bodytype: 'undead' },
  { id: 15, name: "Thrall of Bones (undead)", maxLevel: 53, classes: ['Necromancer'], bodytype: 'undead' },
  { id: 16, name: "Cajole Undead (undead)", maxLevel: 51, classes: ['Necromancer'], bodytype: 'undead' },
  { id: 17, name: "Beguile Undead (undead)", maxLevel: 46, classes: ['Necromancer'], bodytype: 'undead' },
  { id: 18, name: "Dire Charm (undead)", maxLevel: 46, classes: ['Necromancer'], bodytype: 'undead' },
  { id: 19, name: "Dominate Undead (undead)", maxLevel: 32, classes: ['Necromancer'], bodytype: 'undead' },
  
  // Druid (Animal only)
  { id: 20, name: "Command of Tunare (animal)", maxLevel: 60, classes: ['Druid'], bodytype: 'animal' },
  { id: 21, name: "Call of Karana (animal)", maxLevel: 53, classes: ['Druid'], bodytype: 'animal' },
  { id: 22, name: "Allure of the Wild (animal)", maxLevel: 49, classes: ['Druid'], bodytype: 'animal' },
  { id: 23, name: "Dire Charm (animal)", maxLevel: 46, classes: ['Druid'], bodytype: 'animal' },
  { id: 24, name: "Beguile Animals (animal)", maxLevel: 43, classes: ['Druid'], bodytype: 'animal' },
  { id: 25, name: "Tunare's Request (animal)", maxLevel: 35, classes: ['Druid'], bodytype: 'animal' },
  { id: 26, name: "Charm Animals (animal)", maxLevel: 33, classes: ['Druid'], bodytype: 'animal' },
  { id: 27, name: "Befriend Animal (animal)", maxLevel: 24, classes: ['Druid'], bodytype: 'animal' }
];

// API Routes

// Get all zones
app.get('/api/zones', async (req, res) => {
  try {
    const [zones] = await pool.query(`
      SELECT DISTINCT z.short_name, z.long_name 
      FROM zone z
      INNER JOIN spawn2 s ON z.short_name = s.zone
      WHERE z.long_name IS NOT NULL 
        AND z.long_name != ''
      ORDER BY z.long_name
    `);
    res.json(zones);
  } catch (error) {
    console.error('Error fetching zones:', error);
    res.status(500).json({ error: 'Failed to fetch zones' });
  }
});

// Get charm spells
app.get('/api/charm-spells', async (req, res) => {
  res.json(CHARM_SPELLS);
});

// Get charmable NPCs for a zone
app.get('/api/npcs/:zone', async (req, res) => {
  const { zone } = req.params;
  const { maxLevel, spellId } = req.query;
  
  try {
    // Find the charm spell to determine bodytype filtering
    const charmSpell = spellId ? CHARM_SPELLS.find(s => s.id === parseInt(spellId)) : null;
    
    // Build bodytype exclusion conditions
    // Always exclude: Trap (66), Timer (67), Atenha Ra (11)
    let bodytypeCondition = 'AND n.bodytype NOT IN (11, 66, 67)';
    
    // For Necromancer and Druid, also exclude Humanoid (1)
    if (charmSpell && (charmSpell.bodytype === 'undead' || charmSpell.bodytype === 'animal')) {
      bodytypeCondition = 'AND n.bodytype NOT IN (1, 11, 66, 67)';
    }
    
    // Query to get NPCs from the specified zone
    // Filters for charmable NPCs (level <= maxLevel, not charmed already, etc.)
    const query = `
      SELECT DISTINCT
        n.id,
        n.name,
        n.level,
        n.maxlevel,
        n.hp,
        n.mindmg,
        n.maxdmg,
        n.MR as magic_resist,
        n.FR as fire_resist,
        n.CR as cold_resist,
        n.PR as poison_resist,
        n.DR as disease_resist,
        n.bodytype,
        n.race,
        n.class,
        n.special_abilities
      FROM npc_types n
      INNER JOIN spawnentry se ON n.id = se.npcID
      INNER JOIN spawngroup sg ON se.spawngroupID = sg.id
      INNER JOIN spawn2 s ON sg.id = s.spawngroupID
      WHERE s.zone = ?
        ${maxLevel ? 'AND n.level <= ?' : ''}
        AND n.hp > 0
        AND n.level > 0
        AND (n.special_abilities NOT LIKE '%^14,1%' OR n.special_abilities IS NULL)  -- Exclude uncharmable NPCs (code 14)
        ${bodytypeCondition}
      ORDER BY n.maxdmg DESC, n.level DESC, n.name
    `;
    
    const params = maxLevel ? [zone, maxLevel] : [zone];
    const [npcs] = await pool.query(query, params);
    
    // Calculate additional useful stats and add class name
    const enrichedNpcs = npcs.map(npc => ({
      ...npc,
      class_name: NPC_CLASSES[npc.class] || 'Unknown',
      bodytype_name: NPC_BODYTYPES[npc.bodytype] || `Type ${npc.bodytype}`,
      level_range: npc.maxlevel > npc.level ? `${npc.level}-${npc.maxlevel}` : `${npc.level}`,
      exceeds_charm_level: maxLevel && npc.maxlevel > parseInt(maxLevel),
      has_summon: npc.special_abilities ? 
        (npc.special_abilities.startsWith('1,1') || npc.special_abilities.includes('^1,1')) : 
        false,
      hp_per_level: (npc.hp / npc.level).toFixed(0)
    }));
    
    res.json(enrichedNpcs);
  } catch (error) {
    console.error('Error fetching NPCs:', error);
    res.status(500).json({ error: 'Failed to fetch NPCs' });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`EQ Pet Finder running on http://localhost:${PORT}`);
  console.log(`Database: ${dbConfig.database}@${dbConfig.host}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await pool.end();
  process.exit(0);
});

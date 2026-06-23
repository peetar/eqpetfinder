const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const SPECIAL_ABILITY = {
  SUMMON: 1,
  ENRAGE: 2,
  FLURRY: 5,
  DO_NOT_EQUIP: 8,
  UNCHARMABLE: 14,
  UNMEZZABLE: 13,
  UNSTUNABLE: 15,
  UNSNARABLE: 16
};

const OTHER_ABILITY_CONFIG = [
  { code: SPECIAL_ABILITY.FLURRY, key: 'flurry', label: 'Flurry', shortLabel: 'FL' },
  { code: SPECIAL_ABILITY.ENRAGE, key: 'enrage', label: 'Enrage', shortLabel: 'EN' },
  { code: SPECIAL_ABILITY.DO_NOT_EQUIP, key: 'do_not_equip', label: 'Do Not Equip', shortLabel: 'NE' },
  { code: SPECIAL_ABILITY.UNMEZZABLE, key: 'unmezzable', label: 'Unmezzable', shortLabel: 'MZ' },
  { code: SPECIAL_ABILITY.UNSTUNABLE, key: 'unstunable', label: 'Unstunable', shortLabel: 'ST' },
  { code: SPECIAL_ABILITY.UNSNARABLE, key: 'unsnarable', label: 'Unsnarable', shortLabel: 'SN' }
];

function parseSpecialAbilities(specialAbilities) {
  if (!specialAbilities) {
    return new Map();
  }

  const parsed = new Map();

  specialAbilities
    .split('^')
    .map(part => part.trim())
    .filter(Boolean)
    .forEach(part => {
      const [codeText, enabledText = '1'] = part.split(',');
      const code = parseInt(codeText, 10);
      const enabled = parseInt(enabledText, 10);

      if (!Number.isNaN(code)) {
        parsed.set(code, Number.isNaN(enabled) ? 1 : enabled);
      }
    });

  return parsed;
}

function hasSpecialAbility(parsedAbilities, code) {
  return (parsedAbilities.get(code) || 0) > 0;
}

function getOtherAbilities(npc, parsedAbilities) {
  return OTHER_ABILITY_CONFIG.filter(ability => hasSpecialAbility(parsedAbilities, ability.code));
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load NPC data from JSON file
console.log('Loading NPC data...');
const npcData = JSON.parse(fs.readFileSync(path.join(__dirname, 'npc-data.json'), 'utf8'));
console.log(`Loaded ${npcData.zones.length} zones with ${Object.keys(npcData.npcsByZone).length} zone datasets`);

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
  { id: 1, name: "Command of Druzzil", maxLevel: 64, levelRequired: 64, classes: ['Enchanter'], bodytype: 'any' },
  { id: 2, name: "Dictate", maxLevel: 58, levelRequired: 58, classes: ['Enchanter'], bodytype: 'any' },
  { id: 3, name: "Beckon", maxLevel: 57, levelRequired: 57, classes: ['Enchanter'], bodytype: 'any' },
  { id: 4, name: "Boltran's Agacerie", maxLevel: 53, levelRequired: 53, classes: ['Enchanter'], bodytype: 'any' },
  { id: 5, name: "Allure", maxLevel: 51, levelRequired: 49, classes: ['Enchanter'], bodytype: 'any' },
  { id: 6, name: "Cajoling Whispers", maxLevel: 46, levelRequired: 39, classes: ['Enchanter'], bodytype: 'any' },
  { id: 7, name: "Dire Charm", maxLevel: 46, levelRequired: 59, classes: ['Enchanter'], bodytype: 'any' },
  { id: 8, name: "Beguile", maxLevel: 37, levelRequired: 29, classes: ['Enchanter'], bodytype: 'any' },
  { id: 9, name: "Charm", maxLevel: 25, levelRequired: 12, classes: ['Enchanter'], bodytype: 'any' },
  
  // Bard
  { id: 10, name: "Call of the Banshee", maxLevel: 57, levelRequired: 57, classes: ['Bard'], bodytype: 'any' },
  { id: 11, name: "Solon's Bewitching Bravura", maxLevel: 51, levelRequired: 51, classes: ['Bard'], bodytype: 'any' },
  { id: 12, name: "Solon's Song of the Sirens", maxLevel: 37, levelRequired: 27, classes: ['Bard'], bodytype: 'any' },
  
  // Necromancer (Undead only)
  { id: 13, name: "Word of Terris (undead)", maxLevel: 60, levelRequired: 60, classes: ['Necromancer'], bodytype: 'undead' },
  { id: 14, name: "Enslave Death (undead)", maxLevel: 55, levelRequired: 55, classes: ['Necromancer'], bodytype: 'undead' },
  { id: 15, name: "Thrall of Bones (undead)", maxLevel: 53, levelRequired: 53, classes: ['Necromancer'], bodytype: 'undead' },
  { id: 16, name: "Cajole Undead (undead)", maxLevel: 51, levelRequired: 49, classes: ['Necromancer'], bodytype: 'undead' },
  { id: 17, name: "Beguile Undead (undead)", maxLevel: 46, levelRequired: 39, classes: ['Necromancer'], bodytype: 'undead' },
  { id: 18, name: "Dire Charm (undead)", maxLevel: 46, levelRequired: 59, classes: ['Necromancer'], bodytype: 'undead' },
  { id: 19, name: "Dominate Undead (undead)", maxLevel: 32, levelRequired: 18, classes: ['Necromancer'], bodytype: 'undead' },
  
  // Druid (Animal only)
  { id: 20, name: "Command of Tunare (animal)", maxLevel: 60, levelRequired: 60, classes: ['Druid'], bodytype: 'animal' },
  { id: 21, name: "Call of Karana (animal)", maxLevel: 53, levelRequired: 53, classes: ['Druid'], bodytype: 'animal' },
  { id: 22, name: "Allure of the Wild (animal)", maxLevel: 49, levelRequired: 49, classes: ['Druid'], bodytype: 'animal' },
  { id: 23, name: "Dire Charm (animal)", maxLevel: 46, levelRequired: 59, classes: ['Druid'], bodytype: 'animal' },
  { id: 24, name: "Beguile Animals (animal)", maxLevel: 43, levelRequired: 39, classes: ['Druid'], bodytype: 'animal' },
  { id: 25, name: "Tunare's Request (animal)", maxLevel: 35, levelRequired: 34, classes: ['Druid'], bodytype: 'animal' },
  { id: 26, name: "Charm Animals (animal)", maxLevel: 33, levelRequired: 29, classes: ['Druid'], bodytype: 'animal' },
  { id: 27, name: "Befriend Animal (animal)", maxLevel: 24, levelRequired: 14, classes: ['Druid'], bodytype: 'animal' }
];

// API Routes

// Get all zones
app.get('/api/zones', (req, res) => {
  res.json(npcData.zones);
});

// Get charm spells
app.get('/api/charm-spells', (req, res) => {
  res.json(CHARM_SPELLS);
});

// Get charmable NPCs for a zone
app.get('/api/npcs/:zone', (req, res) => {
  const { zone } = req.params;
  const { maxLevel, spellId } = req.query;
  
  try {
    // Get NPCs for this zone
    const zoneNpcs = npcData.npcsByZone[zone] || [];
    
    if (zoneNpcs.length === 0) {
      return res.json([]);
    }
    
    // Find the charm spell to determine bodytype filtering
    const charmSpell = spellId ? CHARM_SPELLS.find(s => s.id === parseInt(spellId)) : null;
    
    // Filter NPCs
    let filteredNpcs = zoneNpcs.filter(npc => {
      // Basic filters
      if (npc.hp <= 0 || npc.level <= 0) return false;
      
      // Level filter
      if (maxLevel && npc.level > parseInt(maxLevel)) return false;
      
      // Exclude uncharmable NPCs (special_abilities code 14)
      if (npc.special_abilities && npc.special_abilities.includes('14,1')) return false;
      
      // Exclude merchants and bankers (classes 20, 21, 40, 41, 60, 61)
      if ([20, 21, 40, 41, 60, 61].includes(npc.class)) return false;
      
      // Bodytype filters - always exclude Trap (66), Timer (67), Atenha Ra (11)
      if ([11, 66, 67].includes(npc.bodytype)) return false;
      
      // Class-specific bodytype filtering
      if (charmSpell) {
        if (charmSpell.bodytype === 'undead') {
          // Necromancer: only show Undead (3)
          if (npc.bodytype !== 3) return false;
        } else if (charmSpell.bodytype === 'animal') {
          // Druid: only show Animal (21)
          if (npc.bodytype !== 21) return false;
        }
        // Enchanter/Bard: show all (already filtered Trap, Timer, Atenha Ra above)
      }
      
      return true;
    });
    
    // Enrich NPCs with additional data
    const enrichedNpcs = filteredNpcs.map(npc => {
      const parsedAbilities = parseSpecialAbilities(npc.special_abilities);

      return {
        ...npc,
        class_name: NPC_CLASSES[npc.class] || 'Unknown',
        bodytype_name: NPC_BODYTYPES[npc.bodytype] || `Type ${npc.bodytype}`,
        level_range: npc.maxlevel > npc.level ? `${npc.level}-${npc.maxlevel}` : `${npc.level}`,
        exceeds_charm_level: maxLevel && npc.maxlevel > parseInt(maxLevel),
        has_summon: hasSpecialAbility(parsedAbilities, SPECIAL_ABILITY.SUMMON),
        hp_per_level: (npc.hp / npc.level).toFixed(0),
        strength: typeof npc.strength === 'number' ? npc.strength : null,
        attack: typeof npc.attack === 'number' ? npc.attack : null,
        accuracy: typeof npc.accuracy === 'number' ? npc.accuracy : null,
        other_abilities: getOtherAbilities(npc, parsedAbilities)
      };
    });
    
    // Sort by max damage descending, then level descending
    enrichedNpcs.sort((a, b) => {
      if (b.maxdmg !== a.maxdmg) return b.maxdmg - a.maxdmg;
      if (b.level !== a.level) return b.level - a.level;
      return a.name.localeCompare(b.name);
    });
    
    res.json(enrichedNpcs);
  } catch (error) {
    console.error('Error fetching NPCs:', error);
    res.status(500).json({ error: 'Failed to fetch NPCs' });
  }
});

// Get all killable targets for a zone (excluding GMs/raid targets > 150k HP, merchants, traps)
app.get('/api/kill-targets/:zone', (req, res) => {
  const { zone } = req.params;
  
  try {
    const zoneNpcs = npcData.npcsByZone[zone] || [];
    
    if (zoneNpcs.length === 0) {
      return res.json([]);
    }
    
    // Filter NPCs
    let filteredNpcs = zoneNpcs.filter(npc => {
      // Basic filters
      if (npc.hp <= 0 || npc.level <= 0) return false;
      
      // Exclude raid bosses/GMs by filtering out anything > 150k HP
      if (npc.hp > 150000) return false;
      
      // Exclude merchants and bankers (classes 20, 21, 40, 41, 60, 61)
      if ([20, 21, 40, 41, 60, 61].includes(npc.class)) return false;
      
      // Bodytype filters - always exclude Trap (66), Timer (67), Atenha Ra (11)
      if ([11, 66, 67].includes(npc.bodytype)) return false;
      
      return true;
    });
    
    // Enrich NPCs with basic data needed for the kill table
    const enrichedNpcs = filteredNpcs.map(npc => {
      return {
        id: npc.id,
        name: npc.name,
        level: npc.level,
        maxlevel: npc.maxlevel,
        hp: npc.hp,
        class: npc.class,
        bodytype: npc.bodytype
      };
    });
    
    // Sort by level descending, then name
    enrichedNpcs.sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return a.name.localeCompare(b.name);
    });
    
    res.json(enrichedNpcs);
  } catch (error) {
    console.error('Error fetching kill targets:', error);
    res.status(500).json({ error: 'Failed to fetch kill targets' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', dataSource: 'json', zones: npcData.zones.length });
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`EQ Pet Finder running on http://localhost:${PORT}`);
  console.log(`Data source: JSON file (${npcData.zones.length} zones)`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

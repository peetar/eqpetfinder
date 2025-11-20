// Script to export NPC data from MySQL to JSON
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs').promises;

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
};

async function exportData() {
  console.log('Connecting to database...');
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    // Get all zones with NPCs
    console.log('Fetching zones...');
    const [zones] = await connection.query(`
      SELECT DISTINCT z.short_name, z.long_name 
      FROM zone z
      INNER JOIN spawn2 s ON z.short_name = s.zone
      WHERE z.long_name IS NOT NULL AND z.long_name != ''
      ORDER BY z.long_name
    `);
    console.log(`Found ${zones.length} zones`);
    
    // Get all NPCs with their spawn zones
    console.log('Fetching NPCs...');
    const [npcs] = await connection.query(`
      SELECT DISTINCT
        n.id,
        n.name,
        n.level,
        n.maxlevel,
        n.hp,
        n.mindmg,
        n.maxdmg,
        n.attack_delay,
        n.runspeed,
        n.MR as magic_resist,
        n.FR as fire_resist,
        n.CR as cold_resist,
        n.PR as poison_resist,
        n.DR as disease_resist,
        n.bodytype,
        n.race,
        n.class,
        n.special_abilities,
        s.zone
      FROM npc_types n
      INNER JOIN spawnentry se ON n.id = se.npcID
      INNER JOIN spawngroup sg ON se.spawngroupID = sg.id
      INNER JOIN spawn2 s ON sg.id = s.spawngroupID
      WHERE n.hp > 0
        AND n.level > 0
        AND n.bodytype NOT IN (11, 66, 67)
        AND n.runspeed > 0
    `);
    console.log(`Found ${npcs.length} NPC spawn records`);
    
    // Group NPCs by zone for efficient lookup
    const npcsByZone = {};
    npcs.forEach(npc => {
      if (!npcsByZone[npc.zone]) {
        npcsByZone[npc.zone] = [];
      }
      // Remove zone from the NPC object since it's the key
      const { zone, ...npcData } = npc;
      npcsByZone[npc.zone].push(npcData);
    });
    
    // Create the export object
    const exportData = {
      version: '1.0',
      exported: new Date().toISOString(),
      zones: zones,
      npcsByZone: npcsByZone
    };
    
    // Write to JSON file
    console.log('Writing to JSON file...');
    const jsonStr = JSON.stringify(exportData, null, 2);
    await fs.writeFile('npc-data.json', jsonStr);
    
    // Calculate file size
    const stats = await fs.stat('npc-data.json');
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log('\n=== Export Complete ===');
    console.log(`Zones: ${zones.length}`);
    console.log(`Total NPC records: ${npcs.length}`);
    console.log(`File size: ${fileSizeMB} MB`);
    console.log(`Output: npc-data.json`);
    
  } finally {
    await connection.end();
  }
}

exportData().catch(console.error);

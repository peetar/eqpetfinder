---
name: quarm-db-pipeline
description: >-
  Extracts, imports, and processes Project Quarm database dumps (.tar.gz or .sql) into SQLite quarm.db,
  and re-exports cleaned, unbloated JSON files (npc-data.json, npcs_enriched.json, loottables.json, items_summary.json).
  Use whenever a new Quarm DB dump is downloaded or when refreshing/exporting NPC, loot, or item datasets.
---

# Quarm Database Pipeline & Data Exporter Guide

Use this skill whenever a new Project Quarm database dump (e.g. `quarm_YYYY-MM-DD.tar.gz`) is downloaded, or when you need to re-parse, query, or export NPC, loot, and item datasets for web applications.

## High-Level Architecture

```
[quarm_*.tar.gz] 
       │  (Extract & sanitize invalid Windows ':' characters)
       ▼
[quarm_*.sql] 
       │  (python scripts/import_quarm_db.py  ~7s)
       ▼
[quarm.db] (SQLite, 23.7 MB, 15 tables with B-tree indexes)
       │  (python scripts/export_quarm_data.py ~5s)
       ├─► npc-data.json       (eqpetfinder: 182 zones, 15k records)
       ├─► npcs_enriched.json  (Curated unbloated stats, decoded abilities)
       ├─► loottables.json     (Loot drops with calculated effective rates)
       └─► items_summary.json  (Catalog of 11k dropped items with stats)
```

---

## Step-by-Step Procedure

### 1. Ingest New Database Dump

When the user provides a path to a downloaded dump (e.g. `C:\Users\peter\Downloads\quarm_YYYY-MM-DD.tar.gz`):

1. **Copy or reference the archive in the project root**:
   ```powershell
   Copy-Item "<path_to_archive>.tar.gz" -Destination "c:\code\eqpetfinder\" -Force
   ```
2. **Run the DB importer**:
   ```bash
   npm run import-db -- "path\to\quarm_YYYY-MM-DD.tar.gz"
   ```
   *(If run without arguments, `npm run import-db` automatically finds the newest `quarm_*.tar.gz` in `c:\code\eqpetfinder\`).*

> [!NOTE]
> The import script handles extracting into `db_extracted/`, sanitizing invalid Windows NTFS colon characters (`:` -> `_`), parsing MySQL multi-row inserts into SQLite, and creating B-tree indexes on `spawn2`, `spawnentry`, `npc_types`, `loottable_entries`, and `lootdrop_entries` in ~7 seconds.

---

### 2. Export All Clean Datasets

Once `quarm.db` is built or updated, generate all JSON datasets:

```bash
npm run export-data
```
*(Or directly: `python scripts/export_quarm_data.py`)*

This generates/updates 4 dedicated datasets in ~5 seconds:

| Dataset | Size | Purpose & Contents |
| :--- | :--- | :--- |
| [`npc-data.json`](file:///c:/code/eqpetfinder/npc-data.json) | ~8.5 MB | **EQ Pet Finder**: Zone-grouped NPCs with pet stats (HP, DPS, runspeed, MR/FR/CR/PR/DR, delay, special abilities). |
| [`npcs_enriched.json`](file:///c:/code/eqpetfinder/npcs_enriched.json) | ~14.5 MB | **Multi-App NPC Stats**: Curated, unbloated stats for all 16k+ spawned NPCs (decoded abilities, true sight, slow mitigation, regens, resists, spawn zones). |
| [`loottables.json`](file:///c:/code/eqpetfinder/loottables.json) | ~30 MB | **Loot Drop Rates**: Every item dropped by any spawned NPC, with group probability, item chance/weight, calculated effective % drop rate, and equip status. |
| [`items_summary.json`](file:///c:/code/eqpetfinder/items_summary.json) | ~2.1 MB | **Dropped Items Catalog**: Compact index of 11k+ dropped items with damage, delay, AC, HP, mana, classes, races, lore, nodrop, and proc/click names. |

---

### 3. Querying Directly via SQL (`quarm.db`)

For backend services or data research, query [`quarm.db`](file:///c:/code/eqpetfinder/quarm.db) directly using standard SQLite:

* **Node.js**: Use `better-sqlite3` or `sqlite3`.
* **Python**: `import sqlite3; conn = sqlite3.connect("quarm.db")`.
* **Sample: Check an NPC's loot drop rates via SQL**:
  ```sql
  SELECT 
    n.name AS mob_name,
    i.Name AS item_name,
    lte.probability AS group_prob,
    lde.chance AS item_chance,
    lte.droplimit,
    lte.mindrop
  FROM npc_types n
  JOIN loottable_entries lte ON n.loottable_id = lte.loottable_id
  JOIN lootdrop_entries lde ON lte.lootdrop_id = lde.lootdrop_id
  JOIN items i ON lde.item_id = i.id
  WHERE n.name LIKE '%Trakanon%';
  ```

---

## Rules & Standards

1. **Avoid MySQL Server Dependency**: Do not attempt to start or connect to local MySQL services. Use the local SQLite `quarm.db` store.
2. **Filter the 75% NPC Bloat**: Never dump raw 101-column `npc_types` into JSON. See [references/npc-fields.md](./references/npc-fields.md) for the audit breakdown of bloat vs. interesting fields.
3. **Preserve Loot Drop Rate Math**: Always calculate effective drop rates based on whether `droplimit == 0 && mindrop == 0` (independent) or `droplimit > 0` (weighted bucket). See [references/loot-mechanics.md](./references/loot-mechanics.md).
4. **Git Hygiene**: Ensure `quarm.db`, `db_extracted/`, and `*.tar.gz` remain in `.gitignore`.

# NPC Types Column Audit & Field Selection Reference

The `npc_types` table contains **101 columns**. Auditing all 15,882 spawned NPCs revealed that ~75% of the fields are unused, dead, constant engine flags, or 3D client polygon appearance models.

---

## 1. The ~75% Bloat Fields (Excluded from Enriched Exports)

### A. 3D Client Appearance / Polygon Models (17 columns)
These fields are only consumed by the classic EverQuest 3D client rendering engine to map textures/tints to player character polygon meshes. They provide zero gameplay, combat, or stat value:
* `texture`, `helmtexture`, `face`
* `luclin_hairstyle`, `luclin_haircolor`, `luclin_eyecolor`, `luclin_eyecolor2`, `luclin_beardcolor`, `luclin_beard`
* `bracertexture`, `chesttexture`, `armtexture`, `handtexture`, `legtexture`, `feettexture`
* `d_melee_texture1`, `d_melee_texture2`
* `armortint_id`, `armortint_red`, `armortint_green`, `armortint_blue`

### B. Constant / Unused Engine Knobs (18 columns)
These fields are either 100% constant across every single NPC in the database or are legacy/dead engine flags:
* `ranged_type` (100% of mobs have value 1)
* `prim_melee_type`, `sec_melee_type` (99.9% default 0)
* `flymode` (99.9% default 0)
* `exp_pct` (99.9% default 100)
* `spellscale`, `healscale` (99.4% default 100)
* `qglobal`, `spawn_limit`, `scalerate`, `instance_spawn_timer_override`
* `underwater`, `engage_notice`, `greed`, `private_corpse`, `stuck_behavior`, `skip_global_loot`, `encounter`, `ignore_despawn`

### C. Dead / Always Empty Columns (3 columns)
* `lastname` (0 non-null values)
* `npc_spells_effects_id` (0 non-null values)
* `rare_spawn` (only 1 mob populated; Quarm uses `unique_spawn_by_name` or spawn chances instead)

---

## 2. The High-Value "Interesting" Fields (Included in Enriched Exports)

### A. Core Identity & Classification
* `id`: NPC Prototype ID (maps to PQDI: `https://www.pqdi.cc/npc/<id>`).
* `name`: Raw database name (e.g. `#Trakanon`, `a_froglok_noble`).
* `clean_name`: Formatted display name (strips `#` and converts `_` to spaces).
* `level` & `maxlevel`: Native level or level range if variable.
* `gender`: `Male`, `Female`, or `Neuter`.
* `race`: Decoded string (e.g. `Iksar`, `Dragon`, `Giant`, `Froglok`).
* `class`: Decoded string (e.g. `Warrior`, `Cleric`, `Shadowknight`, `Wizard`).
* `bodytype`: Decoded string (e.g. `Undead`, `Animal`, `Humanoid`, `Dragon`).
* `zones`: Array of zone short names where this NPC has active spawn points.

### B. Vitals & Melee Combat
* `hp`: Maximum hit points.
* `mana`: Maximum mana (omitted if 0).
* `ac`: Armor Class.
* `mindmg` & `maxdmg`: Base melee damage range.
* `delay`: Attack delay in tenths of a second.
* `attack_count`: Attacks per round (recorded if != default 2).
* `runspeed` & `walkspeed`: Movement speeds.

### C. Resists & Base Attributes
* `resists`: `{ mr, cr, dr, fr, pr }` - Magic, Cold, Disease, Fire, and Poison resists.
* `stats`: `{ str, sta, dex, agi, int, wis, cha }` - Core RPG attributes.

### D. Special Combat Modifiers
* `slow_mitigation`: Percentage slow resistance (e.g. `50` = 50% slow mitigation on Luclin/PoP bosses).
* `atk`, `accuracy`, `avoidance`: Melee accuracy and evasion modifiers (included only when non-zero).
* `hp_regen`, `combat_hp_regen`, `mana_regen`: Regeneration rates per tick (included only when > 0).

### E. Perception & True Sight
* `aggroradius` & `assistradius`: Aggro range and social assist radius.
* `true_sight`: Array indicating stealth detection capabilities:
  * `"Invis"` (`see_invis > 0`)
  * `"InvisUndead"` (`see_invis_undead > 0`)
  * `"Sneak"` (`see_sneak > 0`)
  * `"ImprovedHide"` (`see_improved_hide > 0`)

### F. Decoded Special Abilities
Raw database strings (e.g. `1,1^2,1^13,1^11,1`) are decoded into clean arrays of human-readable tags:
* `Summon`: Ability 1
* `Enrage`: Ability 2
* `Rampage`: Ability 3
* `Flurry`: Ability 4
* `Unslowable`: Ability 11
* `Unmezable`: Ability 12
* `Uncharmable`: Ability 13
* `Unstunable`: Ability 14
* `Immune Flee`: Ability 20

### G. Relational Keys & Flags
* `is_raid_target`: Boolean flag.
* `is_rare`: Boolean flag (named/rare spawn).
* `is_quest`: Boolean flag.
* `loottable_id`: Links to `loottables.json`.
* `spells_id`: Links to NPC cast spells list in `quarm.db`.
* `faction_id`: Links to NPC faction entries in `quarm.db`.
* `merchant_id`: Links to merchant items in `quarm.db`.

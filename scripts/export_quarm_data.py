"""
Quarm Data Exporter
Extracts and generates clean, intelligent JSON files from quarm.db:
1. npc-data.json       - Standard format used by eqpetfinder
2. npcs_enriched.json  - Curated, non-bloated NPC stats with parsed abilities & true sight
3. loottables.json     - Loot drops, item weights, and calculated drop rates for all NPCs
4. items_summary.json  - Compact item catalog for dropped items (stats, lore, nodrop, etc.)
"""

import sqlite3
import json
import os
import sys
from datetime import datetime, timezone

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "quarm.db"))
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

if not os.path.exists(DB_PATH):
    print(f"Error: Database not found at {DB_PATH}")
    sys.exit(1)

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# -------------------------------------------------------------
# 1. Export npc-data.json (for eqpetfinder)
# -------------------------------------------------------------
def export_eqpetfinder_npc_data():
    print("\n[1/4] Exporting npc-data.json for eqpetfinder...")
    
    cur.execute("""
      SELECT DISTINCT z.short_name, z.long_name 
      FROM zone z
      INNER JOIN spawn2 s ON z.short_name = s.zone
      WHERE z.long_name IS NOT NULL AND z.long_name != ''
      ORDER BY z.long_name
    """)
    zones = [dict(r) for r in cur.fetchall()]

    cur.execute("""
      SELECT DISTINCT
        n.id, n.name, n.level, n.maxlevel, n.hp, n.mindmg, n.maxdmg,
        n.attack_delay, n.runspeed,
        n.MR as magic_resist, n.FR as fire_resist, n.CR as cold_resist,
        n.PR as poison_resist, n.DR as disease_resist,
        n.bodytype, n.race, n.class, n.special_abilities,
        n.STR as strength, n.ATK as attack, n.Accuracy as accuracy,
        s.zone
      FROM npc_types n
      INNER JOIN spawnentry se ON n.id = se.npcID
      INNER JOIN spawngroup sg ON se.spawngroupID = sg.id
      INNER JOIN spawn2 s ON sg.id = s.spawngroupID
      WHERE n.hp > 0
        AND n.level > 0
        AND n.bodytype NOT IN (11, 66, 67)
        AND n.runspeed > 0
    """)
    npc_rows = cur.fetchall()

    npcs_by_zone = {}
    for r in npc_rows:
        d = dict(r)
        zone = d.pop("zone")
        if zone not in npcs_by_zone:
            npcs_by_zone[zone] = []
        npcs_by_zone[zone].append(d)

    data = {
        "version": "1.0",
        "exported": datetime.now(timezone.utc).isoformat(),
        "zones": zones,
        "npcsByZone": npcs_by_zone
    }

    out_path = os.path.join(OUTPUT_DIR, "npc-data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"  -> Generated {out_path} ({mb:.2f} MB, {len(zones)} zones, {len(npc_rows):,d} records)")

# -------------------------------------------------------------
# 2. Export npcs_enriched.json (Intelligent non-bloated stats)
# -------------------------------------------------------------
RACES = {
    1: "Human", 2: "Barbarian", 3: "Erudite", 4: "Wood Elf", 5: "High Elf", 6: "Dark Elf",
    7: "Half Elf", 8: "Dwarf", 9: "Troll", 10: "Ogre", 11: "Halfling", 12: "Gnome",
    128: "Iksar", 130: "Vah Shir", 367: "Monster"
}
CLASSES = {
    1: "Warrior", 2: "Cleric", 3: "Paladin", 4: "Ranger", 5: "Shadowknight", 6: "Druid",
    7: "Monk", 8: "Bard", 9: "Rogue", 10: "Shaman", 11: "Necromancer", 12: "Wizard",
    13: "Magician", 14: "Enchanter", 15: "Beastlord", 20: "GM", 21: "Merchant", 40: "Banker"
}
BODYTYPES = {
    1: "Humanoid", 2: "Lycanthrope", 3: "Undead", 4: "Giant", 5: "Construct", 6: "Extraplanar",
    7: "Magical", 8: "Summoned Undead", 9: "Raid Giant", 10: "Armed Undead", 12: "Dragon",
    13: "Brazier", 14: "Tiny Insect", 15: "Monster", 16: "Summoned", 17: "Plant", 18: "Dragon",
    19: "Cold", 20: "Animal", 21: "Insect", 22: "Undead Pet", 23: "Elemental", 24: "Plant",
    25: "Dragon", 26: "Ghost", 27: "Biped", 28: "Ghost", 30: "Fungus", 32: "Trap", 33: "Dervish",
    34: "Ward", 60: "No Target", 63: "Chest", 66: "Trap", 67: "Timer"
}
ABILITY_NAMES = {
    1: "Summon", 2: "Enrage", 3: "Rampage", 4: "Flurry", 5: "Triple", 6: "Quad",
    7: "Dual Wield", 8: "Bane", 9: "Magic Attack", 10: "Ranged Attack", 11: "Unslowable",
    12: "Unmezable", 13: "Uncharmable", 14: "Unstunable", 15: "Unsnareable", 16: "Unfearable",
    17: "Immune Dispel", 18: "Immune Melee", 19: "Immune Magic", 20: "Immune Flee",
    21: "Immune Non-Bane", 22: "Immune Non-Magical", 23: "Will Not Aggro", 24: "Immune Aggro",
    25: "Resist Ranged", 26: "See Invis", 27: "Tethered", 28: "Destructible", 29: "No Harm",
    30: "Always Flee", 31: "Flee at Low HP", 32: "Chase Target", 33: "Focus", 34: "Tunnel Vision",
    35: "De-aggro", 36: "Taunt", 37: "No Target", 38: "Rampage (Area)", 39: "Flurry (Area)"
}

def decode_special_abilities(ab_str):
    if not ab_str:
        return []
    result = []
    parts = ab_str.split("^")
    for p in parts:
        sub = p.split(",")
        try:
            code = int(sub[0])
            name = ABILITY_NAMES.get(code, f"Ability_{code}")
            val = sub[1] if len(sub) > 1 else "1"
            if val != "1" and val != "0":
                result.append(f"{name}({val})")
            else:
                result.append(name)
        except (ValueError, IndexError):
            continue
    return result

def clean_npc_name(raw_name):
    name = raw_name
    if name.startswith("#"):
        name = name[1:]
    return name.replace("_", " ")

def export_enriched_npcs():
    print("\n[2/4] Exporting npcs_enriched.json (Intelligent unbloated stats)...")
    
    cur.execute("""
        SELECT se.npcID, s.zone
        FROM spawnentry se
        JOIN spawn2 s ON se.spawngroupID = s.spawngroupID
        GROUP BY se.npcID, s.zone;
    """)
    npc_zones = {}
    for r in cur.fetchall():
        nid = r["npcID"]
        if nid not in npc_zones:
            npc_zones[nid] = []
        npc_zones[nid].append(r["zone"])

    cur.execute("""
        SELECT 
            n.id, n.name, n.level, n.maxlevel, n.gender, n.race, n.class, n.bodytype,
            n.hp, n.mana, n.AC, n.mindmg, n.maxdmg, n.attack_delay, n.attack_count,
            n.runspeed, n.walkspeed, n.MR, n.CR, n.DR, n.FR, n.PR,
            n.STR, n.STA, n.DEX, n.AGI, n._INT as int_stat, n.WIS, n.CHA,
            n.ATK, n.Accuracy, n.avoidance, n.slow_mitigation,
            n.hp_regen_rate, n.mana_regen_rate, n.combat_hp_regen,
            n.special_abilities, n.aggroradius, n.assistradius,
            n.see_invis, n.see_invis_undead, n.see_sneak, n.see_improved_hide,
            n.raid_target, n.rare_spawn, n.unique_spawn_by_name, n.isquest,
            n.merchant_id, n.npc_spells_id, n.npc_faction_id, n.loottable_id
        FROM npc_types n
        WHERE n.id IN (SELECT DISTINCT npcID FROM spawnentry)
        ORDER BY n.level DESC, n.name ASC;
    """)

    enriched = {}
    for r in cur.fetchall():
        nid = r["id"]
        obj = {
            "id": nid,
            "name": r["name"],
            "clean_name": clean_npc_name(r["name"]),
            "level": r["level"],
            "zones": npc_zones.get(nid, [])
        }
        if r["maxlevel"] > 0 and r["maxlevel"] != r["level"]:
            obj["maxlevel"] = r["maxlevel"]
            
        obj["race"] = RACES.get(r["race"], f"Race_{r['race']}")
        obj["class"] = CLASSES.get(r["class"], f"Class_{r['class']}")
        obj["bodytype"] = BODYTYPES.get(r["bodytype"], f"Body_{r['bodytype']}")
        
        if r["gender"] == 1:
            obj["gender"] = "Female"
        elif r["gender"] == 0:
            obj["gender"] = "Male"
            
        obj["hp"] = r["hp"]
        if r["mana"] > 0:
            obj["mana"] = r["mana"]
        obj["ac"] = r["AC"]
        obj["mindmg"] = r["mindmg"]
        obj["maxdmg"] = r["maxdmg"]
        obj["delay"] = r["attack_delay"]
        if r["attack_count"] > 0 and r["attack_count"] != 2:
            obj["attack_count"] = r["attack_count"]
        obj["runspeed"] = round(r["runspeed"], 2)
        if r["walkspeed"] > 0:
            obj["walkspeed"] = round(r["walkspeed"], 2)
            
        obj["resists"] = {
            "mr": r["MR"], "cr": r["CR"], "dr": r["DR"],
            "fr": r["FR"], "pr": r["PR"]
        }
        obj["stats"] = {
            "str": r["STR"], "sta": r["STA"], "dex": r["DEX"],
            "agi": r["AGI"], "int": r["int_stat"], "wis": r["WIS"], "cha": r["CHA"]
        }
        
        if r["ATK"] > 0: obj["atk"] = r["ATK"]
        if r["Accuracy"] > 0: obj["accuracy"] = r["Accuracy"]
        if r["avoidance"] > 0: obj["avoidance"] = r["avoidance"]
        if r["slow_mitigation"] > 0: obj["slow_mitigation"] = r["slow_mitigation"]
        
        if r["hp_regen_rate"] > 0: obj["hp_regen"] = r["hp_regen_rate"]
        if r["combat_hp_regen"] > 0: obj["combat_hp_regen"] = r["combat_hp_regen"]
        if r["mana_regen_rate"] > 0: obj["mana_regen"] = r["mana_regen_rate"]
        
        if r["aggroradius"] > 0: obj["aggroradius"] = r["aggroradius"]
        if r["assistradius"] > 0: obj["assistradius"] = r["assistradius"]
        
        sight = []
        if r["see_invis"]: sight.append("Invis")
        if r["see_invis_undead"]: sight.append("InvisUndead")
        if r["see_sneak"]: sight.append("Sneak")
        if r["see_improved_hide"]: sight.append("ImprovedHide")
        if sight: obj["true_sight"] = sight
        
        abilities = decode_special_abilities(r["special_abilities"])
        if abilities: obj["special_abilities"] = abilities
        
        if r["raid_target"]: obj["is_raid_target"] = True
        if r["rare_spawn"] or r["unique_spawn_by_name"]: obj["is_rare"] = True
        if r["isquest"]: obj["is_quest"] = True
        
        if r["loottable_id"] > 0: obj["loottable_id"] = r["loottable_id"]
        if r["npc_spells_id"] > 0: obj["spells_id"] = r["npc_spells_id"]
        if r["npc_faction_id"] > 0: obj["faction_id"] = r["npc_faction_id"]
        if r["merchant_id"] > 0: obj["merchant_id"] = r["merchant_id"]
        
        enriched[nid] = obj

    out_path = os.path.join(OUTPUT_DIR, "npcs_enriched.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(enriched, f, indent=2)

    mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"  -> Generated {out_path} ({mb:.2f} MB, {len(enriched):,d} NPCs)")

# -------------------------------------------------------------
# 3. Export loottables.json (Complete loot drops & rates)
# -------------------------------------------------------------
def export_loottables():
    print("\n[3/4] Exporting loottables.json (Loot drops & drop rates)...")
    
    cur.execute("""
        SELECT DISTINCT n.loottable_id
        FROM npc_types n
        JOIN spawnentry se ON n.id = se.npcID
        JOIN spawn2 s ON se.spawngroupID = s.spawngroupID
        WHERE n.loottable_id > 0;
    """)
    used_lt_ids = set(r[0] for r in cur.fetchall())

    cur.execute("""
        SELECT 
            lt.id, lt.name, lt.mincash, lt.maxcash, lt.avgcoin,
            lte.lootdrop_id, lte.multiplier as group_mult, lte.probability as group_prob,
            lte.droplimit, lte.mindrop, ld.name as group_name
        FROM loottable lt
        JOIN loottable_entries lte ON lt.id = lte.loottable_id
        JOIN lootdrop ld ON lte.lootdrop_id = ld.id
        WHERE lt.id IN ({seq})
    """.format(seq=",".join(map(str, used_lt_ids))))

    groups_by_lt = {}
    for r in cur.fetchall():
        lt_id = r["id"]
        if lt_id not in groups_by_lt:
            groups_by_lt[lt_id] = {
                "name": r["name"],
                "cash": {
                    "min": r["mincash"], "max": r["maxcash"], "avg": r["avgcoin"]
                } if r["maxcash"] > 0 else None,
                "groups": []
            }
        groups_by_lt[lt_id]["groups"].append({
            "lootdrop_id": r["lootdrop_id"],
            "name": r["group_name"],
            "probability": r["group_prob"],
            "multiplier": r["group_mult"],
            "droplimit": r["droplimit"],
            "mindrop": r["mindrop"]
        })

    cur.execute("""
        SELECT 
            lde.lootdrop_id, lde.item_id, i.Name as item_name,
            lde.chance, lde.multiplier as item_mult,
            lde.item_charges, lde.equip_item
        FROM lootdrop_entries lde
        JOIN items i ON lde.item_id = i.id
        WHERE lde.lootdrop_id IN (
            SELECT DISTINCT lte.lootdrop_id
            FROM loottable_entries lte
            WHERE lte.loottable_id IN ({seq})
        )
    """.format(seq=",".join(map(str, used_lt_ids))))

    items_by_drop = {}
    for r in cur.fetchall():
        ld_id = r["lootdrop_id"]
        if ld_id not in items_by_drop:
            items_by_drop[ld_id] = []
        items_by_drop[ld_id].append({
            "item_id": r["item_id"],
            "name": r["item_name"],
            "chance": r["chance"],
            "mult": r["item_mult"],
            "charges": r["item_charges"] if r["item_charges"] > 0 else None,
            "equip": bool(r["equip_item"])
        })

    loottables_dict = {}
    for lt_id, lt_data in groups_by_lt.items():
        processed_groups = []
        for g in lt_data["groups"]:
            ld_id = g["lootdrop_id"]
            drop_items = items_by_drop.get(ld_id, [])
            if not drop_items:
                continue
                
            group_prob = g["probability"]
            drop_limit = g["droplimit"]
            min_drop = g["mindrop"]
            
            item_list = []
            if drop_limit == 0 and min_drop == 0:
                for it in drop_items:
                    eff = round((group_prob / 100.0) * it["chance"], 2)
                    item_list.append({
                        "id": it["item_id"],
                        "name": it["name"],
                        "chance": it["chance"],
                        "rate_pct": eff,
                        "equip": it["equip"] if it["equip"] else None,
                        "charges": it["charges"]
                    })
            else:
                tot = sum(it["chance"] for it in drop_items)
                for it in drop_items:
                    wpct = (it["chance"] / tot * 100.0) if tot > 0 else 0
                    eff = round((group_prob / 100.0) * wpct, 2)
                    item_list.append({
                        "id": it["item_id"],
                        "name": it["name"],
                        "weight": it["chance"],
                        "rate_pct": eff,
                        "equip": it["equip"] if it["equip"] else None,
                        "charges": it["charges"]
                    })
                    
            item_list = [{k: v for k, v in it.items() if v is not None} for it in item_list]
            
            g_obj = {
                "group_id": ld_id,
                "name": g["name"],
                "probability": group_prob,
                "items": item_list
            }
            if drop_limit > 0: g_obj["droplimit"] = drop_limit
            if min_drop > 0: g_obj["mindrop"] = min_drop
            if g["multiplier"] > 1: g_obj["multiplier"] = g["multiplier"]
            
            processed_groups.append(g_obj)
            
        lt_obj = {
            "id": lt_id,
            "name": lt_data["name"],
            "drops": processed_groups
        }
        if lt_data["cash"]:
            lt_obj["cash"] = lt_data["cash"]
            
        loottables_dict[lt_id] = lt_obj

    out_path = os.path.join(OUTPUT_DIR, "loottables.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(loottables_dict, f, indent=2)

    mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"  -> Generated {out_path} ({mb:.2f} MB, {len(loottables_dict):,d} loot tables)")

# -------------------------------------------------------------
# 4. Export items_summary.json (Compact dropped items catalog)
# -------------------------------------------------------------
def export_items_summary():
    print("\n[4/4] Exporting items_summary.json (Catalog for dropped items)...")
    
    cur.execute("""
        SELECT 
            i.id, i.Name as name, i.itemtype, i.itemclass, i.damage, i.delay,
            i.ac, i.hp, i.mana, i.classes, i.races, i.slots,
            i.reqlevel, i.reclevel, i.magic, i.nodrop, i.norent, i.lore,
            i.icon, i.clickname, i.procname, i.wornname, i.focusname,
            i.weight, i.size
        FROM items i
        WHERE i.id IN (
            SELECT DISTINCT lde.item_id
            FROM loottable_entries lte
            JOIN lootdrop_entries lde ON lte.lootdrop_id = lde.lootdrop_id
            WHERE lte.loottable_id IN (
                SELECT DISTINCT loottable_id FROM npc_types WHERE loottable_id > 0
            )
        )
        ORDER BY i.Name ASC;
    """)

    items_dict = {}
    for r in cur.fetchall():
        item = {
            "id": r["id"],
            "name": r["name"]
        }
        if r["damage"] > 0: item["damage"] = r["damage"]
        if r["delay"] > 0: item["delay"] = r["delay"]
        if r["ac"] > 0: item["ac"] = r["ac"]
        if r["hp"] > 0: item["hp"] = r["hp"]
        if r["mana"] > 0: item["mana"] = r["mana"]
        if r["reqlevel"] > 0: item["reqlevel"] = r["reqlevel"]
        if r["reclevel"] > 0: item["reclevel"] = r["reclevel"]
        if r["magic"] > 0: item["magic"] = True
        if r["nodrop"] == 0: item["nodrop"] = True
        if r["norent"] == 0: item["norent"] = True
        if r["lore"] == 0: item["lore"] = True
        if r["icon"] > 0: item["icon"] = r["icon"]
        if r["clickname"]: item["click"] = r["clickname"]
        if r["procname"]: item["proc"] = r["procname"]
        if r["wornname"]: item["worn"] = r["wornname"]
        if r["focusname"]: item["focus"] = r["focusname"]
        if r["slots"] > 0: item["slots"] = r["slots"]
        if r["classes"] > 0: item["classes"] = r["classes"]
        if r["races"] > 0: item["races"] = r["races"]
        if r["weight"] > 0: item["weight"] = round(r["weight"] / 10.0, 1)
        
        items_dict[r["id"]] = item

    out_path = os.path.join(OUTPUT_DIR, "items_summary.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(items_dict, f, indent=2)

    mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"  -> Generated {out_path} ({mb:.2f} MB, {len(items_dict):,d} items)")

if __name__ == "__main__":
    start = datetime.now()
    export_eqpetfinder_npc_data()
    export_enriched_npcs()
    export_loottables()
    export_items_summary()
    elapsed = (datetime.now() - start).total_seconds()
    print(f"\nAll exports completed in {elapsed:.2f} seconds!")

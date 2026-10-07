# Loot Table Mechanics & Drop Rate Calculation Reference

This document explains the exact loot drop algorithms used by the Project Quarm / EQMacEmu server in [`zone/loot.cpp`](file:///c:/code/EQMacEmu/zone/loot.cpp#L136-L270).

---

## 1. Relational Structure

An NPC's loot is structured across 4 database tables:

```
npc_types (loottable_id)
   │
   ▼
loottable (id, mincash, maxcash, avgcoin)
   │
   ▼ loottable_entries (probability, multiplier, droplimit, mindrop)
lootdrop (id, name)
   │
   ▼ lootdrop_entries (chance, multiplier, item_charges, equip_item)
items (id, Name, ...)
```

1. **`loottable`**: Defines min/max cash and links to one or more `lootdrop` groups via `loottable_entries`.
2. **`loottable_entries`**:
   * `probability`: Percent chance (0-100) that this lootdrop group triggers. If a roll from 0 to 100 exceeds `probability`, the group produces nothing.
   * `multiplier`: Number of evaluation passes for this group.
   * `droplimit`: Maximum number of items that can drop from this group (0 = unlimited).
   * `mindrop`: Minimum number of items that must drop from this group before stopping.
3. **`lootdrop_entries`**:
   * `item_id`: Reference to `items`.
   * `chance`: The percentage chance (in independent mode) or weight (in bucket mode).
   * `multiplier`: Quantity multiplier (e.g. arrows, gems, quest parts).
   * `equip_item`: `1` if the mob should equip this item when alive, `2` for force-equip.
   * `item_charges`: Charges if charged item.

---

## 2. Drop Modes & Effective Drop Rate Formulas

The server evaluates loot in one of two distinct modes based on `droplimit` and `mindrop`:

### Mode A: Independent Drops (`droplimit == 0 && mindrop == 0`)

Used for general/misc loot drops (e.g. rare mob trinkets, quest drops, gems).

* Every item in the lootdrop group is evaluated individually:
  ```cpp
  if (zone->random.Real(0.0, 100.0) <= e.chance) {
      // Item drops!
  }
  ```
* **Formula**:
  $$\text{Effective Drop Rate} = \left(\frac{\text{Group Probability}}{100}\right) \times \text{Item Chance}$$

* **Example (Pyzjn - Qeynos Hills)**:
  * Loottable group `2547_Pyzjn_Misc`: `probability = 100%`, `droplimit = 0`, `mindrop = 0`.
  * Item `A Glowing Black Stone`: `chance = 75%`.
  * Effective Drop Rate = $1.0 \times 75\% = \mathbf{75.0\%}$.
  * Item `Necromancer Blood`: `chance = 20%`.
  * Effective Drop Rate = $1.0 \times 20\% = \mathbf{20.0\%}$.

---

### Mode B: Weighted Bucket Drops (`droplimit > 0 || mindrop > 0`)

Used for exclusive armor tables, weapon pools, and spell lists (e.g. raid boss chests, Kunark breastplates).

* Items compete against each other in a weighted roll pool:
  ```cpp
  float roll_t = sum(e.chance for all items in group);
  float roll = zone->random.Real(0.0, roll_t);
  ```
* The server rolls `droplimit` times. On each pass, the item whose cumulative weight bracket encompasses `roll` is selected and dropped.
* **Single-Roll Drop Probability**:
  $$\text{Weight \%} = \frac{\text{Item Chance}}{\sum \text{Group Item Chances}} \times 100$$
  $$\text{Effective Drop Rate (per roll)} = \left(\frac{\text{Group Probability}}{100}\right) \times \text{Weight \%}$$

* **Example (Trakanon - Old Sebilis Breastplates)**:
  * Loottable group `sebilis Trakanon`: `probability = 100%`, `droplimit = 2`, `mindrop = 2`.
  * 14 class breastplates and rare weapons are in the table, each with `chance = 8`.
  * Total Weight = $14 \times 8 = 112$.
  * Weight % = $\frac{8}{112} \times 100 = \mathbf{7.14\%}$ per roll.
  * With `droplimit = 2`, the chance of seeing a specific breastplate on a kill is approximately:
    $$1 - (1 - 0.0714)^2 \approx \mathbf{13.78\%}$$.

---

## 3. Min/Max Cash Drops

In `loottable`, cash is stored in copper units:
* `1 platinum = 1,000 copper`
* `1 gold = 100 copper`
* `1 silver = 10 copper`
* `1 copper = 1 copper`

When exported to `loottables.json`, `cash` provides `{ min, max, avg }` in total copper if `maxcash > 0`.

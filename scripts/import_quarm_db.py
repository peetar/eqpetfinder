"""
Quarm DB Importer
Safely extracts and imports a Quarm database dump (.tar.gz or .sql) into SQLite quarm.db.
Handles Windows NTFS filename colon sanitization and builds database indexes.
"""

import os
import sys
import tarfile
import re
import sqlite3
import time

TARGET_TABLES = {
    "zone",
    "spawn2",
    "spawngroup",
    "spawnentry",
    "npc_types",
    "loottable",
    "loottable_entries",
    "lootdrop",
    "lootdrop_entries",
    "items",
    "npc_spells",
    "npc_spells_entries",
    "npc_faction",
    "npc_faction_entries",
    "faction_list"
}

def parse_sql_row(line):
    line = line.strip()
    if not line.startswith("("):
        return None
    if line.endswith("),"):
        line = line[1:-2]
    elif line.endswith(");"):
        line = line[1:-2]
    elif line.endswith(")"):
        line = line[1:-1]
    else:
        return None
    
    vals = []
    curr = []
    in_quote = False
    escaped = False
    
    for ch in line:
        if escaped:
            curr.append(ch)
            escaped = False
        elif ch == '\\':
            escaped = True
        elif ch == "'":
            in_quote = not in_quote
        elif ch == ',' and not in_quote:
            val_str = "".join(curr).strip()
            curr = []
            if val_str == "NULL":
                vals.append(None)
            elif val_str.startswith("'") and val_str.endswith("'"):
                vals.append(val_str[1:-1].replace("\\'", "'").replace('\\"', '"').replace("\\\\", "\\"))
            else:
                try:
                    if "." in val_str:
                        vals.append(float(val_str))
                    else:
                        vals.append(int(val_str))
                except ValueError:
                    vals.append(val_str)
        else:
            curr.append(ch)
            
    val_str = "".join(curr).strip()
    if val_str == "NULL":
        vals.append(None)
    elif val_str.startswith("'") and val_str.endswith("'"):
        vals.append(val_str[1:-1].replace("\\'", "'").replace('\\"', '"').replace("\\\\", "\\"))
    else:
        try:
            if "." in val_str:
                vals.append(float(val_str))
            else:
                vals.append(int(val_str))
        except ValueError:
            vals.append(val_str)
            
    return vals

def extract_archive(archive_path, extract_dir):
    print(f"Extracting {archive_path} -> {extract_dir}...")
    os.makedirs(extract_dir, exist_ok=True)
    main_sql = None
    with tarfile.open(archive_path, "r:gz") as tar:
        for member in tar.getmembers():
            clean_name = member.name.replace(":", "_")
            dest_path = os.path.join(extract_dir, clean_name)
            f_in = tar.extractfile(member)
            if f_in:
                with open(dest_path, "wb") as f_out:
                    f_out.write(f_in.read())
            if clean_name.startswith("quarm_") and clean_name.endswith(".sql"):
                main_sql = dest_path
    return main_sql

def import_sql_to_db(sql_path, db_path):
    print(f"Reading schema from {sql_path}...")
    table_columns = {}
    with open(sql_path, "r", encoding="latin1") as f:
        recording = False
        curr_table = None
        for line in f:
            m = re.match(r"CREATE TABLE\s+[`\"]?([a-zA-Z0-9_]+)[`\"]?", line, re.IGNORECASE)
            if m:
                tname = m.group(1).lower()
                if tname in TARGET_TABLES:
                    recording = True
                    curr_table = tname
                    table_columns[curr_table] = []
                    continue
            if recording:
                m_col = re.match(r"\s*[`\"]([a-zA-Z0-9_]+)[`\"]", line)
                if m_col:
                    table_columns[curr_table].append(m_col.group(1))
                if line.strip().endswith(";"):
                    recording = False
                    curr_table = None

    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("PRAGMA synchronous = OFF;")
    cur.execute("PRAGMA journal_mode = MEMORY;")
    cur.execute("PRAGMA cache_size = 100000;")

    for tname, cols in table_columns.items():
        col_defs = ", ".join([f"`{c}`" for c in cols])
        cur.execute(f"CREATE TABLE `{tname}` ({col_defs});")
    conn.commit()

    print(f"Parsing and importing {len(table_columns)} tables into {db_path}...")
    start_time = time.time()
    current_table = None
    inserting = False
    batch = []
    total_rows = {t: 0 for t in table_columns}

    with open(sql_path, "r", encoding="latin1") as f:
        for line in f:
            if line.startswith("INSERT INTO"):
                m = re.match(r"INSERT INTO\s+[`\"]?([a-zA-Z0-9_]+)[`\"]?", line)
                if m:
                    tname = m.group(1).lower()
                    if tname in table_columns:
                        if batch and current_table:
                            cols = table_columns[current_table]
                            placeholders = ", ".join(["?"] * len(cols))
                            cur.executemany(f"INSERT INTO `{current_table}` VALUES ({placeholders})", batch)
                            total_rows[current_table] += len(batch)
                            batch = []
                        current_table = tname
                        inserting = True
                        continue
                    else:
                        if batch and current_table:
                            cols = table_columns[current_table]
                            placeholders = ", ".join(["?"] * len(cols))
                            cur.executemany(f"INSERT INTO `{current_table}` VALUES ({placeholders})", batch)
                            total_rows[current_table] += len(batch)
                            batch = []
                        current_table = None
                        inserting = False
                        continue
            
            if inserting and current_table:
                row = parse_sql_row(line)
                if row:
                    expected_len = len(table_columns[current_table])
                    if len(row) == expected_len:
                        batch.append(row)
                    elif len(row) < expected_len:
                        row.extend([None] * (expected_len - len(row)))
                        batch.append(row)
                    else:
                        batch.append(row[:expected_len])
                        
                    if len(batch) >= 10000:
                        cols = table_columns[current_table]
                        placeholders = ", ".join(["?"] * len(cols))
                        cur.executemany(f"INSERT INTO `{current_table}` VALUES ({placeholders})", batch)
                        total_rows[current_table] += len(batch)
                        batch = []
                
                if line.strip().endswith(";"):
                    if batch and current_table:
                        cols = table_columns[current_table]
                        placeholders = ", ".join(["?"] * len(cols))
                        cur.executemany(f"INSERT INTO `{current_table}` VALUES ({placeholders})", batch)
                        total_rows[current_table] += len(batch)
                        batch = []
                    inserting = False
                    current_table = None

    if batch and current_table:
        cols = table_columns[current_table]
        placeholders = ", ".join(["?"] * len(cols))
        cur.executemany(f"INSERT INTO `{current_table}` VALUES ({placeholders})", batch)
        total_rows[current_table] += len(batch)

    conn.commit()

    print("Building indexes...")
    cur.execute("CREATE INDEX idx_spawn2_zone ON spawn2(zone);")
    cur.execute("CREATE INDEX idx_spawn2_spawngroupID ON spawn2(spawngroupID);")
    cur.execute("CREATE INDEX idx_spawnentry_spawngroupID ON spawnentry(spawngroupID);")
    cur.execute("CREATE INDEX idx_spawnentry_npcID ON spawnentry(npcID);")
    cur.execute("CREATE INDEX idx_npc_types_loottable_id ON npc_types(loottable_id);")
    cur.execute("CREATE INDEX idx_loottable_entries_loottable_id ON loottable_entries(loottable_id);")
    cur.execute("CREATE INDEX idx_loottable_entries_lootdrop_id ON loottable_entries(lootdrop_id);")
    cur.execute("CREATE INDEX idx_lootdrop_entries_lootdrop_id ON lootdrop_entries(lootdrop_id);")
    cur.execute("CREATE INDEX idx_lootdrop_entries_item_id ON lootdrop_entries(item_id);")
    conn.commit()
    conn.close()

    elapsed = time.time() - start_time
    mb = os.path.getsize(db_path) / (1024 * 1024)
    print(f"\nImport successfully completed in {elapsed:.2f}s!")
    print(f"Database: {db_path} ({mb:.2f} MB)")
    for tname, cnt in total_rows.items():
        print(f"  - {tname:22}: {cnt:,d} rows")

if __name__ == "__main__":
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    db_path = os.path.join(base_dir, "quarm.db")
    
    # Check for archive argument or default tar.gz
    archive_path = None
    if len(sys.argv) > 1:
        archive_path = sys.argv[1]
    else:
        for f in os.listdir(base_dir):
            if f.startswith("quarm_") and f.endswith(".tar.gz"):
                archive_path = os.path.join(base_dir, f)
                break
                
    if not archive_path or not os.path.exists(archive_path):
        print(f"Usage: python import_quarm_db.py <path_to_quarm_dump.tar.gz>")
        sys.exit(1)
        
    extract_dir = os.path.join(base_dir, "db_extracted")
    sql_path = extract_archive(archive_path, extract_dir)
    if not sql_path:
        # Search for quarm*.sql in extract_dir
        for f in os.listdir(extract_dir):
            if f.startswith("quarm_") and f.endswith(".sql"):
                sql_path = os.path.join(extract_dir, f)
                break
                
    if not sql_path or not os.path.exists(sql_path):
        print(f"Error: Could not find extracted quarm SQL file in {extract_dir}")
        sys.exit(1)
        
    import_sql_to_db(sql_path, db_path)

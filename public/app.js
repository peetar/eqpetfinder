// API base URL - use relative path to work on both local and Vercel
const API_URL = '/api';

// DOM elements
const zoneSelect = document.getElementById('zone-select');
const charmSpellSelect = document.getElementById('charm-spell-select');
const searchBtn = document.getElementById('search-btn');
const loadingDiv = document.getElementById('loading');
const resultsDiv = document.getElementById('results');
const noResultsDiv = document.getElementById('no-results');
const errorDiv = document.getElementById('error');
const npcTbody = document.getElementById('npc-tbody');
const npcCount = document.getElementById('npc-count');
const npcTable = document.getElementById('npc-table');

// New DOM elements
const playerClassSelect = document.getElementById('player-class-select');
const playerLevelSelect = document.getElementById('player-level-select');
const xpTableBtn = document.getElementById('xp-table-btn');
const xpModal = document.getElementById('xp-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const closeModalBottomBtn = document.getElementById('close-modal-bottom-btn');
const modalZoneInfo = document.getElementById('modal-zone-info');
const zemWarningAlert = document.getElementById('zem-warning-alert');
const modalSearch = document.getElementById('modal-search');
const modalNpcCount = document.getElementById('modal-npc-count');
const modalNpcTbody = document.getElementById('modal-npc-tbody');
const modalNpcTable = document.getElementById('modal-npc-table');

const DEFAULT_CHARM_CHANGE_DATE = new Date('2026-10-02T00:00:00');
const DEFAULT_CHARM_SPELL_BEFORE = "Boltran's Agacerie";
const DEFAULT_CHARM_SPELL_AFTER = 'Command of Druzzil';
const STAT_BADGE_META = {
    strength: { label: 'STR', positive: 'STR+', negative: 'STR-' },
    attack: { label: 'ATK', positive: 'ATK+', negative: 'ATK-' },
    accuracy: { label: 'ACC', positive: 'ACC+', negative: 'ACC-' }
};

// State
let zones = [];
let charmSpells = [];
let currentNpcs = [];
let currentSort = { column: 'dps', direction: 'desc' };
let currentAverages = { strength: null, attack: null, accuracy: null };

// New State
let zems = {};
let modalNpcs = [];
let modalSort = { column: 'xphp', direction: 'desc' };

// Initialize the app
async function init() {
    try {
        populateLevels();
        await loadZems();
        await Promise.all([loadZones(), loadCharmSpells()]);
        setupEventListeners();
        updateSpellSelect();
    } catch (error) {
        console.error('Initialization error:', error);
        showError();
    }
}

// Populate player levels
function populateLevels() {
    playerLevelSelect.innerHTML = '';
    for (let i = 1; i <= 65; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        if (i === 60) option.selected = true;
        playerLevelSelect.appendChild(option);
    }
}

// Load ZEM data
async function loadZems() {
    try {
        const response = await fetch('/zem-data.json');
        if (!response.ok) throw new Error('Failed to fetch ZEM data');
        zems = await response.json();
    } catch (error) {
        console.error('Error loading ZEM data:', error);
    }
}

// Load zones from API
async function loadZones() {
    try {
        const response = await fetch(`${API_URL}/zones`);
        if (!response.ok) throw new Error('Failed to fetch zones');
        
        zones = await response.json();
        
        // Sort zones ignoring "The" prefix
        zones.sort((a, b) => {
            const aName = a.long_name.replace(/^The\s+/i, '');
            const bName = b.long_name.replace(/^The\s+/i, '');
            return aName.localeCompare(bName);
        });
        
        // Populate zone select
        populateZones(zones);
    } catch (error) {
        console.error('Error loading zones:', error);
        throw error;
    }
}

// Populate zone dropdown
function populateZones(zonesToShow) {
    zoneSelect.innerHTML = '<option value="">-- Select a Zone --</option>';
    zonesToShow.forEach(zone => {
        const option = document.createElement('option');
        option.value = zone.short_name;
        option.textContent = zone.long_name;
        zoneSelect.appendChild(option);
    });
}

// Load charm spells from API
async function loadCharmSpells() {
    try {
        const response = await fetch(`${API_URL}/charm-spells`);
        if (!response.ok) throw new Error('Failed to fetch charm spells');
        
        charmSpells = await response.json();
    } catch (error) {
        console.error('Error loading charm spells:', error);
        throw error;
    }
}

// Update the charm spell dropdown options and selection
function updateSpellSelect() {
    const classVal = playerClassSelect.value;
    const levelVal = parseInt(playerLevelSelect.value);
    
    // Filter spells for this class
    const classSpells = charmSpells.filter(spell => spell.classes.includes(classVal));
    
    charmSpellSelect.innerHTML = '<option value="">-- Select a Charm Spell --</option>';
    
    // Helper to identify special-purpose spells to exclude from the default select
    const isSpecialSpell = name => name.toLowerCase().includes('dire charm') || 
                                name.toLowerCase().includes('dictate') || 
                                name.toLowerCase().includes('beckon');
                                
    // Find the highest usable non-special spell
    let highestUsableSpell = null;
    classSpells.forEach(spell => {
        if (spell.levelRequired <= levelVal && !isSpecialSpell(spell.name)) {
            if (!highestUsableSpell || spell.levelRequired > highestUsableSpell.levelRequired) {
                highestUsableSpell = spell;
            }
        }
    });
    
    // Fallback to highest usable special spell if no regular spell is usable
    if (!highestUsableSpell) {
        classSpells.forEach(spell => {
            if (spell.levelRequired <= levelVal) {
                if (!highestUsableSpell || spell.levelRequired > highestUsableSpell.levelRequired) {
                    highestUsableSpell = spell;
                }
            }
        });
    }
    
    classSpells.forEach(spell => {
        const option = document.createElement('option');
        option.value = spell.id;
        option.dataset.maxLevel = spell.maxLevel;
        option.textContent = `${spell.name} (Max Level: ${spell.maxLevel}, Req Lvl: ${spell.levelRequired})`;
        
        if (highestUsableSpell && spell.id === highestUsableSpell.id) {
            option.selected = true;
        }
        
        charmSpellSelect.appendChild(option);
    });
    
    updateSearchButton();
}

// Setup event listeners
function setupEventListeners() {
    const zoneSearch = document.getElementById('zone-search');
    
    // Zone search filter
    zoneSearch.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredZones = zones.filter(zone => 
            zone.long_name.toLowerCase().includes(searchTerm) ||
            zone.short_name.toLowerCase().includes(searchTerm)
        );
        populateZones(filteredZones);
    });
    
    zoneSelect.addEventListener('change', updateSearchButton);
    
    playerClassSelect.addEventListener('change', () => {
        updateSpellSelect();
        if (resultsDiv.style.display === 'block') {
            searchNPCs();
        }
    });
    
    playerLevelSelect.addEventListener('change', () => {
        updateSpellSelect();
        if (resultsDiv.style.display === 'block') {
            searchNPCs();
        }
    });
    
    charmSpellSelect.addEventListener('change', () => {
        updateSearchButton();
        if (resultsDiv.style.display === 'block') {
            searchNPCs();
        }
    });
    
    searchBtn.addEventListener('click', searchNPCs);
    
    // Modal buttons
    xpTableBtn.addEventListener('click', openXpModal);
    closeModalBtn.addEventListener('click', closeXpModal);
    closeModalBottomBtn.addEventListener('click', closeXpModal);
    
    xpModal.addEventListener('click', (e) => {
        if (e.target === xpModal || e.target.classList.contains('modal-overlay')) {
            closeXpModal();
        }
    });
    
    modalSearch.addEventListener('input', renderModalNPCs);
}

// Update search button state
function updateSearchButton() {
    const zoneSelected = zoneSelect.value !== '';
    const spellSelected = charmSpellSelect.value !== '';
    searchBtn.disabled = !(zoneSelected && spellSelected);
    xpTableBtn.disabled = !zoneSelected;
}

// Search for NPCs
async function searchNPCs() {
    const zone = zoneSelect.value;
    const spellId = charmSpellSelect.value;
    const selectedOption = charmSpellSelect.options[charmSpellSelect.selectedIndex];
    const maxLevel = selectedOption ? selectedOption.dataset.maxLevel : 65;
    
    if (!zone || !spellId) return;
    
    // Hide all result sections
    resultsDiv.style.display = 'none';
    noResultsDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    loadingDiv.style.display = 'block';
    
    try {
        const response = await fetch(`${API_URL}/npcs/${zone}?maxLevel=${maxLevel}&spellId=${spellId}`);
        if (!response.ok) throw new Error('Failed to fetch NPCs');
        
        const npcs = await response.json();
        
        loadingDiv.style.display = 'none';
        
        if (npcs.length === 0) {
            noResultsDiv.style.display = 'block';
        } else {
            displayNPCs(npcs);
        }
    } catch (error) {
        console.error('Error searching NPCs:', error);
        loadingDiv.style.display = 'none';
        showError();
    }
}

// Display NPCs in table
function displayNPCs(npcs) {
    const selectedOption = charmSpellSelect.options[charmSpellSelect.selectedIndex];
    const spellMaxLevel = selectedOption ? parseInt(selectedOption.dataset.maxLevel) : 65;
    const playerLevel = parseInt(playerLevelSelect.value);

    // Store current NPCs for sorting and scaling
    currentNpcs = npcs.map(npc => {
        const delay = npc.attack_delay || 30;
        
        // Cap max level
        const maxCharmLevel = Math.max(npc.level, Math.min(npc.maxlevel, spellMaxLevel));
        
        // Min/Max Hit
        const minMaxHit = npc.maxdmg;
        const maxMaxHit = npc.maxdmg + (maxCharmLevel - npc.level) * 2;
        
        // DPS
        const minAvgDmg = (npc.mindmg + npc.maxdmg) / 2;
        const maxAvgDmg = (npc.mindmg + npc.maxdmg + (maxCharmLevel - npc.level) * 2) / 2;
        const minDps = parseFloat((minAvgDmg / delay * 10).toFixed(1));
        const maxDps = parseFloat((maxAvgDmg / delay * 10).toFixed(1));
        
        // Effective MR
        const minEffMR = calculateEffectiveMR(npc.magic_resist, npc.level, playerLevel);
        const maxEffMR = calculateEffectiveMR(npc.magic_resist, maxCharmLevel, playerLevel);
        
        // HP range scaling
        const minHP = npc.hp;
        const maxHP = Math.round(npc.hp / npc.level * maxCharmLevel);
        
        // Display strings
        const level_range_display = npc.level_range;
            
        const hp_display = maxCharmLevel > npc.level
            ? `${minHP.toLocaleString()} - ${maxHP.toLocaleString()}`
            : `${minHP.toLocaleString()}`;
            
        const maxdmg_display = maxCharmLevel > npc.level
            ? `${minMaxHit}-${maxMaxHit}`
            : `${minMaxHit}`;
            
        const dps_display = maxCharmLevel > npc.level
            ? `${minDps.toFixed(1)}-${maxDps.toFixed(1)}`
            : `${minDps.toFixed(1)}`;
            
        const mr_display = minEffMR === maxEffMR
            ? `${npc.magic_resist}(${minEffMR})`
            : `${npc.magic_resist}(${minEffMR}-${maxEffMR})`;
            
        // Hover text for MR calculation
        let mr_hover = "";
        if (minEffMR === maxEffMR) {
            mr_hover = getMRCalculationHover(npc.magic_resist, npc.level, playerLevel);
        } else {
            mr_hover = `At Level ${npc.level}:\n` + 
                       getMRCalculationHover(npc.magic_resist, npc.level, playerLevel) + 
                       `\n\nAt Level ${maxCharmLevel}:\n` + 
                       getMRCalculationHover(npc.magic_resist, maxCharmLevel, playerLevel);
        }
            
        return { 
            ...npc, 
            delay, 
            maxCharmLevel,
            minMaxHit,
            maxMaxHit,
            minDps,
            maxDps,
            minEffMR,
            maxEffMR,
            minHP,
            maxHP,
            level_range_display,
            hp_display,
            maxdmg_display,
            dps_display,
            mr_display,
            mr_hover
        };
    });
    
    currentAverages = calculateAverages(currentNpcs);
    
    // Sort by default (DPS descending)
    sortNPCs(currentSort.column, currentSort.direction, false);
    
    // Setup sort handlers
    setupSortHandlers();
    
    renderNPCs();
}

// Render NPCs to table
function renderNPCs() {
    // Clear existing rows
    npcTbody.innerHTML = '';
    
    // Update count
    npcCount.textContent = `${currentNpcs.length} NPC${currentNpcs.length !== 1 ? 's' : ''} found`;
    
    // Update sort arrows
    updateSortArrows();
    
    // Add rows
    currentNpcs.forEach(npc => {
        const row = document.createElement('tr');
        
        // Determine stat classes based on values
        const mrClass = getMRClass(npc.maxEffMR);
        const levelWarning = npc.exceeds_charm_level ? '⚠️ ' : '';
        const mrWarning = npc.maxEffMR > 80 ? '⚠️ ' : '';
        const abilityBadges = renderAbilityBadges(npc.other_abilities || []);
        const statBadges = renderStatBadges(npc, currentAverages);
        
        row.innerHTML = `
            <td class="level-cell col-level">${levelWarning}${npc.level_range_display}</td>
            <td class="npc-name col-name"><a href="https://www.pqdi.cc/npc/${npc.id}" target="_blank" rel="noopener noreferrer">${escapeHtml(npc.name)}</a></td>
            <td class="col-class">${npc.class_name}</td>
            <td class="col-bodytype">${npc.bodytype_name}</td>
            <td class="col-summon">${npc.has_summon ? '⚠️ Yes' : 'No'}</td>
            <td class="col-hp">${npc.hp_display}</td>
            <td class="col-maxdmg">${npc.maxdmg_display}</td>
            <td class="col-delay">${npc.delay}</td>
            <td class="col-dps">${npc.dps_display}</td>
            <td class="col-mr ${mrClass}" title="${escapeHtml(npc.mr_hover)}">${mrWarning}${npc.mr_display}</td>
            <td>${abilityBadges}</td>
            <td>${statBadges}</td>
        `;
        
        npcTbody.appendChild(row);
    });
    
    resultsDiv.style.display = 'block';
}

function calculateAverages(npcs) {
    const statKeys = Object.keys(STAT_BADGE_META);
    const averages = {};

    statKeys.forEach(key => {
        const values = npcs
            .map(npc => npc[key])
            .filter(value => typeof value === 'number' && !Number.isNaN(value));

        averages[key] = values.length
            ? values.reduce((sum, value) => sum + value, 0) / values.length
            : null;
    });

    return averages;
}

function renderAbilityBadges(abilities) {
    if (!abilities.length) {
        return '<span class="muted-cell">—</span>';
    }

    return abilities
        .map(ability => renderBadge(ability.shortLabel, ability.label, `ability-badge ability-badge-${ability.key.replace(/_/g, '-')}`))
        .join('');
}

function renderStatBadges(npc, averages) {
    const badges = Object.entries(STAT_BADGE_META)
        .map(([key, meta]) => {
            const value = npc[key];
            const average = averages[key];

            if (typeof value !== 'number' || Number.isNaN(value) || typeof average !== 'number' || Number.isNaN(average) || value === average) {
                return '';
            }

            const isAboveAverage = value > average;
            const label = isAboveAverage ? meta.positive : meta.negative;
            const title = `${meta.label} ${isAboveAverage ? 'Above' : 'Below'} Average (${value} vs ${average.toFixed(1)})`;

            return renderBadge(label, title, `stat-badge ${isAboveAverage ? 'stat-badge-positive' : 'stat-badge-negative'}`);
        })
        .filter(Boolean);

    return badges.length ? badges.join('') : '<span class="muted-cell">—</span>';
}

function renderBadge(text, title, className) {
    return `<span class="${className}" title="${escapeHtml(title)}">${escapeHtml(text)}</span>`;
}

// Setup sort handlers
function setupSortHandlers() {
    document.querySelectorAll('.sortable').forEach(th => {
        th.style.cursor = 'pointer';
        th.onclick = () => {
            const column = th.dataset.sort;
            const newDirection = (currentSort.column === column && currentSort.direction === 'desc') ? 'asc' : 'desc';
            sortNPCs(column, newDirection);
        };
    });
}

// Sort NPCs
function sortNPCs(column, direction, rerender = true) {
    currentSort = { column, direction };
    
    currentNpcs.sort((a, b) => {
        let aVal, bVal;
        
        switch(column) {
            case 'level':
                aVal = a.level;
                bVal = b.level;
                break;
            case 'name':
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
                break;
            case 'class':
                aVal = a.class_name;
                bVal = b.class_name;
                break;
            case 'bodytype':
                aVal = a.bodytype_name;
                bVal = b.bodytype_name;
                break;
            case 'summon':
                aVal = a.has_summon ? 1 : 0;
                bVal = b.has_summon ? 1 : 0;
                break;
            case 'hp':
                // Sort by average HP
                aVal = (a.minHP + a.maxHP) / 2;
                bVal = (b.minHP + b.maxHP) / 2;
                break;
            case 'maxdmg':
                aVal = a.minMaxHit;
                bVal = b.minMaxHit;
                break;
            case 'delay':
                aVal = a.delay;
                bVal = b.delay;
                break;
            case 'dps':
                aVal = a.minDps;
                bVal = b.minDps;
                break;
            case 'mr':
                aVal = a.maxEffMR;
                bVal = b.maxEffMR;
                break;
            default:
                return 0;
        }
        
        if (typeof aVal === 'string') {
            return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        } else {
            return direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
    });
    
    if (rerender) renderNPCs();
}

// Update sort arrows
function updateSortArrows() {
    npcTable.dataset.sortedColumn = currentSort.column;

    document.querySelectorAll('.sortable').forEach(th => {
        const arrow = th.querySelector('.sort-arrow');
        if (arrow) {
            if (th.dataset.sort === currentSort.column) {
                arrow.textContent = currentSort.direction === 'asc' ? ' ▲' : ' ▼';
            } else {
                arrow.textContent = '';
            }
        }
    });
}

// Get MR class for color coding (reversed: low MR = good/green, high MR = bad/red)
function getMRClass(mr) {
    if (mr <= 50) return 'stat-good';   // Low MR = green (good for charm)
    if (mr <= 100) return 'stat-medium'; // Medium MR = yellow
    return 'stat-poor';                  // High MR = red (bad for charm)
}

// Get HP class for color coding
function getHPClass(hp, level) {
    const hpPerLevel = hp / level;
    if (hpPerLevel > 100) return 'stat-good';
    if (hpPerLevel > 60) return 'stat-medium';
    return 'stat-poor';
}

// Show error message
function showError() {
    errorDiv.style.display = 'block';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- NEW HELPER FUNCTIONS & MODAL LOGIC ---

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

const CON_RED = 'Red';
const CON_YELLOW = 'Yellow';
const CON_WHITE = 'White';
const CON_BLUE = 'Blue';
const CON_LIGHTBLUE = 'Light Blue';
const CON_GREEN = 'Green';

const CON_MODIFIERS = {
    [CON_RED]: 1.50,
    [CON_YELLOW]: 1.25,
    [CON_WHITE]: 1.00,
    [CON_BLUE]: 0.90,
    [CON_LIGHTBLUE]: 0.40,
    [CON_GREEN]: 0.00
};

// Calculate effective Magic Resistance with +4 charm-tick level bonus
function calculateEffectiveMR(baseMR, mobLevel, playerLevel) {
    const casterLevel = playerLevel + 4; // tick save bonus
    const diff = mobLevel - casterLevel;
    let tempDiff = diff;
    if (tempDiff < -9) {
        tempDiff = -9;
    }
    
    let levelMod = Math.floor((tempDiff * tempDiff) / 2);
    if (tempDiff < 0) {
        levelMod = -levelMod;
    }
    
    // High-level bump logic matching spells.cpp
    if (casterLevel < 50) {
        const bumpLevel = casterLevel + 4 + Math.floor(casterLevel / 6);
        if (mobLevel >= bumpLevel) {
            levelMod += 70 + casterLevel * 6;
        }
    } else {
        if (casterLevel < 64) {
            if (diff >= 13) {
                levelMod = casterLevel * 5;
            }
        } else {
            if (diff >= 16) {
                levelMod = casterLevel * 5;
            }
        }
    }
    
    const effectiveMR = baseMR + levelMod;
    return Math.max(5, effectiveMR);
}

// Generate the hover text showing MR calculation breakdown
function getMRCalculationHover(baseMR, mobLevel, playerLevel) {
    const casterLevel = playerLevel + 4;
    const diff = mobLevel - casterLevel;
    let tempDiff = diff;
    let capMsg = "";
    if (tempDiff < -9) {
        tempDiff = -9;
        capMsg = " (capped at -9)";
    }
    
    let baseLevelMod = Math.floor((tempDiff * tempDiff) / 2);
    if (tempDiff < 0) {
        baseLevelMod = -baseLevelMod;
    }
    
    let levelMod = baseLevelMod;
    let bumpMsg = "";
    
    if (casterLevel < 50) {
        const bumpLevel = casterLevel + 4 + Math.floor(casterLevel / 6);
        if (mobLevel >= bumpLevel) {
            const bumpVal = 70 + casterLevel * 6;
            levelMod += bumpVal;
            bumpMsg = ` + High-Level Bump: ${bumpVal} (since mob level >= ${bumpLevel})`;
        }
    } else {
        if (casterLevel < 64) {
            if (diff >= 13) {
                levelMod = casterLevel * 5;
                bumpMsg = ` = CasterLevel * 5 = ${casterLevel * 5} (high-level cap, since diff >= 13)`;
            }
        } else {
            if (diff >= 16) {
                levelMod = casterLevel * 5;
                bumpMsg = ` = CasterLevel * 5 = ${casterLevel * 5} (high-level cap, since diff >= 16)`;
            }
        }
    }
    
    const finalMR = Math.max(5, baseMR + levelMod);
    
    let steps = [];
    steps.push(`Caster Level: ${playerLevel} + 4 (tick save bonus) = ${casterLevel}`);
    steps.push(`Mob Level: ${mobLevel}`);
    steps.push(`Level Diff: ${mobLevel} - ${casterLevel} = ${diff}${capMsg}`);
    steps.push(`Level Mod: ${tempDiff < 0 ? '-' : ''}(${Math.abs(tempDiff)}^2 / 2) = ${baseLevelMod}${bumpMsg}`);
    steps.push(`Resist Check: Base MR (${baseMR}) + Level Mod (${levelMod}) = ${baseMR + levelMod}`);
    if (baseMR + levelMod < 5) {
        steps.push(`Floor check: ${baseMR + levelMod} < 5 => Capped at 5`);
    }
    steps.push(`Effective MR = ${finalMR}`);
    
    return steps.join('\n');
}

// Generate the hover text showing XP calculation breakdown
function getXPCalculationHover(mobLevel, playerLevel, npcClass, expansion, zem) {
    const conColor = getLevelCon(playerLevel, mobLevel);
    const conMod = CON_MODIFIERS[conColor] || 1.0;
    
    const mlm = calculateMLM(mobLevel, playerLevel, expansion);
    const baseXP = mobLevel * mobLevel * (zem * 100) * 1.20;
    const finalXP = baseXP * conMod * mlm;
    
    let steps = [];
    steps.push(`Mob Level: ${mobLevel}`);
    steps.push(`Player Level: ${playerLevel}`);
    steps.push(`Zone ZEM: ${zem.toFixed(2)}`);
    steps.push(`Base XP = Lvl^2 * ZEM * 100 * 1.2 = ${mobLevel}^2 * ${(zem * 100).toFixed(0)} * 1.2 = ${Math.round(baseXP).toLocaleString()}`);
    steps.push(`Con Color: ${conColor} (Modifier: ${conMod.toFixed(2)})`);
    steps.push(`Mob Level Modifier (MLM): ${mlm.toFixed(4)}`);
    steps.push(`Final XP = Base XP * ConMod * MLM`);
    steps.push(`Final XP = ${Math.round(baseXP).toLocaleString()} * ${conMod.toFixed(2)} * ${mlm.toFixed(4)} = ${Math.round(finalXP).toLocaleString()}`);
    
    return steps.join('\n');
}

// Get con color using C++ GetLevelCon logic from mob_ai.cpp
function getLevelCon(mylevel, iOtherLevel) {
    const diff = iOtherLevel - mylevel;

    if (diff === 0) return CON_WHITE;
    if (diff >= 1 && diff <= 2) return CON_YELLOW;
    if (diff >= 3) return CON_RED;

    if (mylevel <= 7) {
        if (diff <= -4) return CON_GREEN;
        return CON_BLUE;
    }
    if (mylevel <= 8) {
        if (diff <= -5) return CON_GREEN;
        if (diff <= -4) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    if (mylevel <= 12) {
        if (diff <= -6) return CON_GREEN;
        if (diff <= -4) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    if (mylevel <= 16) {
        if (diff <= -7) return CON_GREEN;
        if (diff <= -5) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    if (mylevel <= 20) {
        if (diff <= -8) return CON_GREEN;
        if (diff <= -6) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    if (mylevel <= 24) {
        if (diff <= -9) return CON_GREEN;
        if (diff <= -7) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    if (mylevel <= 28) {
        if (diff <= -10) return CON_GREEN;
        if (diff <= -8) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    if (mylevel <= 30) {
        if (diff <= -11) return CON_GREEN;
        if (diff <= -9) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    if (mylevel <= 32) {
        if (diff <= -12) return CON_GREEN;
        if (diff <= -9) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    if (mylevel <= 36) {
        if (diff <= -13) return CON_GREEN;
        if (diff <= -10) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    if (mylevel <= 40) {
        if (diff <= -14) return CON_GREEN;
        if (diff <= -11) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    if (mylevel <= 44) {
        if (diff <= -16) return CON_GREEN;
        if (diff <= -12) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    if (mylevel <= 48) {
        if (diff <= -17) return CON_GREEN;
        if (diff <= -13) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    if (mylevel <= 52) {
        if (diff <= -18) return CON_GREEN;
        if (diff <= -14) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    if (mylevel <= 54) {
        if (diff <= -19) return CON_GREEN;
        if (diff <= -15) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    if (mylevel <= 56) {
        if (diff <= -20) return CON_GREEN;
        if (diff <= -15) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    if (mylevel <= 60) {
        if (diff <= -21) return CON_GREEN;
        if (diff <= -16) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    if (mylevel <= 61) {
        if (diff <= -19) return CON_GREEN;
        if (diff <= -14) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    if (mylevel <= 62) {
        if (diff <= -17) return CON_GREEN;
        if (diff <= -12) return CON_LIGHTBLUE;
        return CON_BLUE;
    }
    // mylevel >= 63
    if (diff <= -16) return CON_GREEN;
    if (diff <= -11) return CON_LIGHTBLUE;
    return CON_BLUE;
}

// Calculate Mob Level Modifier (MLM) based on Project Quarm rules (from exp.cpp)
function calculateMLM(mobLevel, playerLevel, expansion) {
    if (mobLevel <= 45 || playerLevel <= 50) {
        return 1.0;
    }

    const isLuclinOrLater = expansion >= 3;
    const min_lvl_diff = isLuclinOrLater ? -16 : -6;
    const max_lvl_diff = isLuclinOrLater ? 16 : 6;
    const floor = isLuclinOrLater ? 1.15 : 1.0;

    const lvl_diff = playerLevel - mobLevel;

    if (lvl_diff > min_lvl_diff && lvl_diff < max_lvl_diff) {
        let mlm = 1.0;
        if (playerLevel > 59) {
            mlm = Math.min(3.0, (260.0 - 13.0 * (playerLevel - mobLevel)) / 100.0);
        } else {
            const x = 60 - playerLevel;
            const mlm_cap = 2.6 - x * 0.16;
            let adj = 0.13 - x * 0.013;
            if (mobLevel > playerLevel) {
                adj /= 2;
            }
            mlm = mlm_cap - (playerLevel - mobLevel) * adj;
        }
        return Math.max(floor, mlm);
    }

    return 1.0;
}

// Calculate experience points for a kill target
function calculateXP(mobLevel, playerLevel, npcClass, expansion, zem) {
    const conColor = getLevelCon(playerLevel, mobLevel);
    if (conColor === CON_GREEN) return 0;

    const baseXP = mobLevel * mobLevel * (zem * 100) * 1.20;
    const conMod = CON_MODIFIERS[conColor] || 1.0;
    const mlm = calculateMLM(mobLevel, playerLevel, expansion);

    return baseXP * conMod * mlm;
}

// Modal: Close
function closeXpModal() {
    xpModal.style.display = 'none';
}

// Modal: Open & Load
async function openXpModal() {
    const zone = zoneSelect.value;
    if (!zone) return;
    
    xpModal.style.display = 'flex';
    modalSearch.value = '';
    modalNpcTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Loading targets...</td></tr>';
    
    try {
        const response = await fetch(`${API_URL}/kill-targets/${zone}`);
        if (!response.ok) throw new Error('Failed to fetch kill targets');
        
        const rawNpcs = await response.json();
        
        // ZEM lookup
        const zoneLower = zone.toLowerCase();
        const zemEntry = zems[zoneLower];
        let zem = 1.0;
        let expansion = 0;
        let zemFound = false;

        if (zemEntry) {
            zem = zemEntry.zem;
            expansion = zemEntry.expansion;
            zemFound = true;
        }
        
        // Toggle alert warning if ZEM not found
        zemWarningAlert.style.display = zemFound ? 'none' : 'block';
        
        // Update header info
        const selectedZoneOption = zoneSelect.options[zoneSelect.selectedIndex];
        const selectedZoneText = selectedZoneOption ? selectedZoneOption.textContent : 'Unknown';
        modalZoneInfo.textContent = `Zone: ${selectedZoneText} | ZEM: ${zem.toFixed(2)}`;
        
        const playerLevel = parseInt(playerLevelSelect.value);
        
        // Process & filter NPCs
        modalNpcs = [];
        rawNpcs.forEach(npc => {
            const minLevel = npc.level;
            const maxLevel = npc.maxlevel > npc.level ? npc.maxlevel : npc.level;
            
            // Check con color at max level first for green con filtering
            const maxCon = getLevelCon(playerLevel, maxLevel);
            if (maxCon === CON_GREEN) {
                return; // Filter out green cons
            }
            
            const minCon = getLevelCon(playerLevel, minLevel);
            
            // HP
            const minHP = npc.hp;
            const maxHP = Math.round(npc.hp / minLevel * maxLevel);
            
            // XP
            const minXP = calculateXP(minLevel, playerLevel, npc.class, expansion, zem);
            const maxXP = calculateXP(maxLevel, playerLevel, npc.class, expansion, zem);
            
            // Averages for Exp/HP
            const avgXP = (minXP + maxXP) / 2;
            const avgHP = (minHP + maxHP) / 2;
            const xphp = avgHP > 0 ? avgXP / avgHP : 0;
            
            // Generate XP calculation hover text for the lowest level in range
            const xp_hover = getXPCalculationHover(minLevel, playerLevel, npc.class, expansion, zem);
            
            modalNpcs.push({
                ...npc,
                minLevel,
                maxLevel,
                minCon,
                maxCon,
                minHP,
                maxHP,
                minXP,
                maxXP,
                xphp,
                xp_hover
            });
        });
        
        // Sort by Exp/HP descending by default
        modalSort = { column: 'xphp', direction: 'desc' };
        sortModalNPCs(modalSort.column, modalSort.direction, false);
        
        // Setup sort handlers
        setupModalSortHandlers();
        
        // Render
        renderModalNPCs();
    } catch (error) {
        console.error('Error loading kill targets:', error);
        modalNpcTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red; padding: 20px;">Error loading data.</td></tr>';
    }
}

// Modal: Setup Sort Handlers
function setupModalSortHandlers() {
    document.querySelectorAll('.modal-sortable').forEach(th => {
        th.style.cursor = 'pointer';
        th.onclick = () => {
            const column = th.dataset.sort;
            const newDirection = (modalSort.column === column && modalSort.direction === 'desc') ? 'asc' : 'desc';
            sortModalNPCs(column, newDirection);
        };
    });
}

// Modal: Sort
function sortModalNPCs(column, direction, rerender = true) {
    modalSort = { column, direction };
    
    modalNpcs.sort((a, b) => {
        let aVal, bVal;
        
        switch(column) {
            case 'name':
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
                break;
            case 'class':
                aVal = NPC_CLASSES[a.class] || 'Unknown';
                bVal = NPC_CLASSES[b.class] || 'Unknown';
                break;
            case 'level':
                aVal = a.minLevel;
                bVal = b.minLevel;
                break;
            case 'hp':
                aVal = (a.minHP + a.maxHP) / 2;
                bVal = (b.minHP + b.maxHP) / 2;
                break;
            case 'xp':
                aVal = (a.minXP + a.maxXP) / 2;
                bVal = (b.minXP + b.maxXP) / 2;
                break;
            case 'xphp':
                aVal = a.xphp;
                bVal = b.xphp;
                break;
            default:
                return 0;
        }
        
        if (typeof aVal === 'string') {
            return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        } else {
            return direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
    });
    
    if (rerender) renderModalNPCs();
}

// Modal: Update Sort Arrows
function updateModalSortArrows() {
    modalNpcTable.dataset.sortedColumn = modalSort.column;

    document.querySelectorAll('.modal-sortable').forEach(th => {
        const arrow = th.querySelector('.sort-arrow');
        if (arrow) {
            if (th.dataset.sort === modalSort.column) {
                arrow.textContent = modalSort.direction === 'asc' ? ' ▲' : ' ▼';
            } else {
                arrow.textContent = '';
            }
        }
    });
}

// Modal: Render List
function renderModalNPCs() {
    modalNpcTbody.innerHTML = '';
    
    const searchTerm = modalSearch.value.toLowerCase().trim();
    
    // Filter by name
    const filtered = modalNpcs.filter(npc => 
        npc.name.toLowerCase().includes(searchTerm)
    );
    
    modalNpcCount.textContent = `${filtered.length} mob${filtered.length !== 1 ? 's' : ''} found`;
    
    updateModalSortArrows();
    
    if (filtered.length === 0) {
        modalNpcTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #666;">No mobs match the search criteria.</td></tr>';
        return;
    }
    
    filtered.forEach(npc => {
        const row = document.createElement('tr');
        
        // HP Display
        const hpDisplay = npc.maxLevel > npc.minLevel
            ? `${npc.minHP.toLocaleString()} - ${npc.maxHP.toLocaleString()}`
            : `${npc.minHP.toLocaleString()}`;
            
        // XP Display
        const minXpVal = Math.round(npc.minXP);
        const maxXpVal = Math.round(npc.maxXP);
        const xpDisplay = npc.maxLevel > npc.minLevel
            ? `${minXpVal.toLocaleString()} - ${maxXpVal.toLocaleString()}`
            : `${minXpVal.toLocaleString()}`;
            
        // Con Color Badges
        const minConClass = getConClass(npc.minCon);
        const maxConClass = getConClass(npc.maxCon);
        
        let levelBadges = '';
        if (npc.maxLevel > npc.minLevel) {
            levelBadges = `<span class="con-badge ${minConClass}">${npc.minLevel}</span> - <span class="con-badge ${maxConClass}">${npc.maxLevel}</span>`;
        } else {
            levelBadges = `<span class="con-badge ${minConClass}">${npc.minLevel}</span>`;
        }
        
        const className = NPC_CLASSES[npc.class] || 'Unknown';
        
        row.innerHTML = `
            <td class="col-name npc-name"><a href="https://www.pqdi.cc/npc/${npc.id}" target="_blank" rel="noopener noreferrer">${escapeHtml(npc.name)}</a></td>
            <td class="col-class">${className}</td>
            <td class="col-level">${levelBadges}</td>
            <td class="col-hp">${hpDisplay}</td>
            <td class="col-xp" title="${escapeHtml(npc.xp_hover)}">${xpDisplay}</td>
            <td class="col-xphp" style="font-family: monospace; font-weight: bold;">${npc.xphp.toFixed(1)}</td>
        `;
        
        modalNpcTbody.appendChild(row);
    });
}

// Convert con color string to CSS class name
function getConClass(conColor) {
    switch (conColor) {
        case CON_RED: return 'con-red';
        case CON_YELLOW: return 'con-yellow';
        case CON_WHITE: return 'con-white';
        case CON_BLUE: return 'con-blue';
        case CON_LIGHTBLUE: return 'con-lightblue';
        case CON_GREEN: return 'con-green';
        default: return 'con-gray';
    }
}

// Start the app
init();

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

// Initialize the app
async function init() {
    try {
        await Promise.all([loadZones(), loadCharmSpells()]);
        setupEventListeners();
    } catch (error) {
        console.error('Initialization error:', error);
        showError();
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
        const defaultSpellName = getDefaultCharmSpellName();
        
        charmSpells.forEach(spell => {
            const option = document.createElement('option');
            option.value = spell.id;
            option.dataset.maxLevel = spell.maxLevel;
            option.textContent = `${spell.name} (Max Level: ${spell.maxLevel})`;
            
            if (spell.name === defaultSpellName) {
                option.selected = true;
            }
            
            charmSpellSelect.appendChild(option);
        });

        updateSearchButton();
    } catch (error) {
        console.error('Error loading charm spells:', error);
        throw error;
    }
}

function getDefaultCharmSpellName() {
    return new Date() >= DEFAULT_CHARM_CHANGE_DATE
        ? DEFAULT_CHARM_SPELL_AFTER
        : DEFAULT_CHARM_SPELL_BEFORE;
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
    charmSpellSelect.addEventListener('change', updateSearchButton);
    searchBtn.addEventListener('click', searchNPCs);
}

// Update search button state
function updateSearchButton() {
    const zoneSelected = zoneSelect.value !== '';
    const spellSelected = charmSpellSelect.value !== '';
    searchBtn.disabled = !(zoneSelected && spellSelected);
}

// Search for NPCs
async function searchNPCs() {
    const zone = zoneSelect.value;
    const spellId = charmSpellSelect.value;
    const selectedOption = charmSpellSelect.options[charmSpellSelect.selectedIndex];
    const maxLevel = selectedOption.dataset.maxLevel;
    
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
    // Store current NPCs for sorting
    currentNpcs = npcs.map(npc => {
        const delay = npc.attack_delay || 30;
        const avgDmg = (npc.mindmg + npc.maxdmg) / 2;
        const dps = parseFloat((avgDmg / delay * 10).toFixed(1));
        return { ...npc, delay, dps };
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
        const mrClass = getMRClass(npc.magic_resist);
        const hpClass = getHPClass(npc.hp, npc.level);
        const levelWarning = npc.exceeds_charm_level ? '⚠️ ' : '';
        const mrWarning = npc.magic_resist > 80 ? '⚠️ ' : '';
        const abilityBadges = renderAbilityBadges(npc.other_abilities || []);
        const statBadges = renderStatBadges(npc, currentAverages);
        
        row.innerHTML = `
            <td class="level-cell col-level">${levelWarning}${npc.level_range}</td>
            <td class="npc-name col-name"><a href="https://www.pqdi.cc/npc/${npc.id}" target="_blank" rel="noopener noreferrer">${escapeHtml(npc.name)}</a></td>
            <td class="col-class">${npc.class_name}</td>
            <td class="col-bodytype">${npc.bodytype_name}</td>
            <td class="col-summon">${npc.has_summon ? '⚠️ Yes' : 'No'}</td>
            <td class="col-hp">${npc.hp.toLocaleString()}</td>
            <td class="col-maxdmg">${npc.maxdmg}</td>
            <td class="col-delay">${npc.delay}</td>
            <td class="col-dps">${npc.dps}</td>
            <td class="col-mr ${mrClass}">${mrWarning}${npc.magic_resist}</td>
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
                aVal = a.hp;
                bVal = b.hp;
                break;
            case 'maxdmg':
                aVal = a.maxdmg;
                bVal = b.maxdmg;
                break;
            case 'delay':
                aVal = a.delay;
                bVal = b.delay;
                break;
            case 'dps':
                aVal = a.dps;
                bVal = b.dps;
                break;
            case 'mr':
                aVal = a.magic_resist;
                bVal = b.magic_resist;
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
        if (th.dataset.sort === currentSort.column) {
            arrow.textContent = currentSort.direction === 'asc' ? ' ▲' : ' ▼';
        } else {
            arrow.textContent = '';
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

// Start the app
init();

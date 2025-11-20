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

// State
let zones = [];
let charmSpells = [];
let currentNpcs = [];
let currentSort = { column: 'dps', direction: 'desc' };

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
        
        charmSpells.forEach(spell => {
            const option = document.createElement('option');
            option.value = spell.id;
            option.dataset.maxLevel = spell.maxLevel;
            option.textContent = `${spell.name} (Max Level: ${spell.maxLevel})`;
            
            // Default to Boltran's Agacerie
            if (spell.name === "Boltran's Agacerie") {
                option.selected = true;
            }
            
            charmSpellSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading charm spells:', error);
        throw error;
    }
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
        
        row.innerHTML = `
            <td class="level-cell">${levelWarning}${npc.level_range}</td>
            <td class="npc-name"><a href="https://www.pqdi.cc/npc/${npc.id}" target="_blank" rel="noopener noreferrer">${escapeHtml(npc.name)}</a></td>
            <td>${npc.class_name}</td>
            <td>${npc.bodytype_name}</td>
            <td>${npc.has_summon ? '⚠️ Yes' : 'No'}</td>
            <td>${npc.hp.toLocaleString()}</td>
            <td>${npc.maxdmg}</td>
            <td>${npc.delay}</td>
            <td>${npc.dps}</td>
            <td class="${mrClass}">${mrWarning}${npc.magic_resist}</td>
        `;
        
        npcTbody.appendChild(row);
    });
    
    resultsDiv.style.display = 'block';
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

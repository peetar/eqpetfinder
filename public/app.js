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
        
        zones.forEach(zone => {
            const option = document.createElement('option');
            option.value = zone.short_name;
            option.textContent = zone.long_name;
            zoneSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading zones:', error);
        throw error;
    }
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
    // Clear existing rows
    npcTbody.innerHTML = '';
    
    // Update count
    npcCount.textContent = `${npcs.length} NPC${npcs.length !== 1 ? 's' : ''} found`;
    
    // Add rows
    npcs.forEach(npc => {
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
            <td class="${mrClass}">${mrWarning}${npc.magic_resist}</td>
        `;
        
        npcTbody.appendChild(row);
    });
    
    resultsDiv.style.display = 'block';
}

// Get MR class for color coding
function getMRClass(mr) {
    if (mr <= 50) return 'stat-poor';
    if (mr <= 100) return 'stat-medium';
    return 'stat-good';
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

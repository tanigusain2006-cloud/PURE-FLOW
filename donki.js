/**
 * js/donki.js - NASA DONKI Space Weather Integration
 * Fetches real-time solar flare, SEP, and CME data from NASA API
 * Provides space weather dashboard functionality for PureFlow
 */

// ========== CONFIGURATION ==========
const DONKI_BASE = 'https://api.nasa.gov/DONKI';
const NASA_API_KEY = 'DEMO_KEY';  // User can replace with real API key
const POLL_INTERVAL_MS = 300000;  // 5 minutes

// ========== HISTORICAL STORMS DATABASE ==========
const HISTORICAL_STORMS = {
  halloween2003: {
    id: 'halloween-2003',
    class: 'X17.2',
    date: '2003-10-28',
    peakFluxPfu: 29000,
    label: 'Halloween 2003 — X17.2',
    description: 'Largest recorded SEP event of the modern era. Would have been lethal to unshielded crew.',
    radiationMultiplier: 18.5,
    fullDescription: 'The Halloween solar storms of 2003 were a series of powerful solar flares and coronal mass ejections that occurred in late October 2003. The X17.2 flare caused widespread radio blackouts and auroras as far south as Texas and Florida.'
  },
  apollo1972: {
    id: 'apollo-1972',
    class: 'X-class',
    date: '1972-08-04',
    peakFluxPfu: 50000,
    label: 'August 1972 — Apollo Gap Storm',
    description: 'Occurred between Apollo 16 and 17. Would have been fatal to astronauts on EVA.',
    radiationMultiplier: 24.0,
    fullDescription: 'This massive solar storm erupted between the Apollo 16 and 17 missions. If astronauts had been on a lunar mission during this event, they would have received a lethal radiation dose within hours of the storm peak.'
  },
  carrington: {
    id: 'carrington-class',
    class: 'X45+ (est.)',
    date: '1859-09-01',
    peakFluxPfu: 200000,
    label: 'Carrington Class Simulation',
    description: 'Worst recorded space weather event in history. Estimated equivalent.',
    radiationMultiplier: 85.0,
    fullDescription: 'The Carrington Event of 1859 is the most intense geomagnetic storm on record. Telegraph systems worldwide failed, and auroras were seen as far south as Cuba and Mexico. A modern Carrington-class event would cause catastrophic damage to power grids and satellites.'
  }
};

// ========== UTILITY FUNCTIONS ==========

/**
 * Format ISO date to human readable
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date string
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Unknown date';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Get date string for N days ago in YYYY-MM-DD format
 * @param {number} daysAgo - Number of days to subtract
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getDateString(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

/**
 * Determine event severity based on flare class or flux
 * @param {Object} event - Event object from API
 * @returns {string} Severity level
 */
function getEventSeverity(event) {
  // For flares
  if (event.classType) {
    const classLetter = event.classType.charAt(0);
    if (classLetter === 'X') return 'extreme';
    if (classLetter === 'M') return 'high';
    if (classLetter === 'C') return 'moderate';
    return 'low';
  }
  
  // For SEP events
  if (event.peakFlux) {
    const flux = event.peakFlux;
    if (flux > 10000) return 'extreme';
    if (flux > 1000) return 'high';
    if (flux > 100) return 'moderate';
    return 'low';
  }
  
  // For CME events
  if (event.speed) {
    const speed = event.speed;
    if (speed > 2000) return 'extreme';
    if (speed > 1000) return 'high';
    if (speed > 500) return 'moderate';
    return 'low';
  }
  
  return 'low';
}

/**
 * Create an alert card DOM element for an event
 * @param {Object} event - Event data from API
 * @param {number} index - Index for staggered animation
 * @returns {HTMLElement} Alert card element
 */
function createAlertCard(event, index = 0) {
  const card = document.createElement('div');
  card.className = 'alert-card';
  card.style.animation = `alert-slide-in 0.3s ease forwards`;
  card.style.animationDelay = `${index * 0.05}s`;
  card.style.opacity = '0';
  
  const severity = getEventSeverity(event);
  
  // Add severity-based styling
  if (severity === 'extreme') {
    card.classList.add('card-danger');
  } else if (severity === 'high') {
    card.classList.add('card-gold');
  }
  
  // Determine event type and build content
  let icon = '☀️';
  let title = '';
  let details = '';
  
  if (event.classType) {
    // Solar Flare
    icon = '🔥';
    title = `SOLAR FLARE ${event.classType}`;
    details = `
      <div class="alert-details">
        <strong>Peak Time:</strong> ${formatDate(event.peakTime)}<br>
        <strong>Region:</strong> ${event.activeRegionNum || 'Unknown'}<br>
        <strong>Source Location:</strong> ${event.sourceLocation || 'N/A'}
      </div>
    `;
  } else if (event.peakFlux) {
    // SEP Event
    icon = '⚡';
    title = `SOLAR ENERGETIC PARTICLE EVENT`;
    const fluxValue = event.peakFlux;
    details = `
      <div class="alert-details">
        <strong>Peak Flux:</strong> ${fluxValue.toLocaleString()} pfu<br>
        <strong>Threshold Crossing:</strong> ${formatDate(event.startTime)}<br>
        <strong>Intensity:</strong> ${fluxValue > 1000 ? 'SEVERE' : fluxValue > 100 ? 'HIGH' : 'MODERATE'}
      </div>
    `;
  } else if (event.speed) {
    // CME Event
    icon = '🌊';
    title = `CORONAL MASS EJECTION`;
    details = `
      <div class="alert-details">
        <strong>Speed:</strong> ${event.speed} km/s<br>
        <strong>Time:</strong> ${formatDate(event.startTime)}<br>
        <strong>Type:</strong> ${event.type || 'Partial Halo'}
      </div>
    `;
  } else {
    // Generic event
    title = 'SOLAR EVENT DETECTED';
    details = `
      <div class="alert-details">
        <strong>Time:</strong> ${formatDate(event.startTime)}<br>
        <strong>Status:</strong> Active
      </div>
    `;
  }
  
  card.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
      <span style="font-size: 1.5rem;">${icon}</span>
      <div class="alert-class">${title}</div>
    </div>
    ${details}
  `;
  
  return card;
}

/**
 * Render alerts to the DONKI feed container
 * @param {Array} events - Array of space weather events
 */
function renderAlerts(events) {
  const container = document.getElementById('alerts-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!events || events.length === 0) {
    container.innerHTML = `
      <div class="alert-card" style="border-left-color: var(--mint);">
        <div class="alert-class">✅ No Significant Events</div>
        <div class="alert-details">No solar flares, SEPs, or CMEs detected in the past 7 days. Quiet space weather conditions.</div>
      </div>
    `;
    return;
  }
  
  // Display up to 10 most recent events
  const recentEvents = events.slice(0, 10);
  recentEvents.forEach((event, idx) => {
    const card = createAlertCard(event, idx);
    container.appendChild(card);
  });
  
  if (events.length > 10) {
    const moreInfo = document.createElement('div');
    moreInfo.className = 'alert-card';
    moreInfo.style.borderLeftColor = 'var(--muted)';
    moreInfo.style.opacity = '0.7';
    moreInfo.innerHTML = `
      <div class="alert-details" style="text-align: center;">
        +${events.length - 10} additional events in the period
      </div>
    `;
    container.appendChild(moreInfo);
  }
}

// ========== API FETCH FUNCTIONS ==========

/**
 * Fetch recent solar flares from DONKI API
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} Array of flare events
 */
async function fetchRecentFlares(days = 7) {
  const endDate = getDateString(0);
  const startDate = getDateString(days);
  const url = `${DONKI_BASE}/FLR?startDate=${startDate}&endDate=${endDate}&api_key=${NASA_API_KEY}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching solar flares:', error);
    return [];
  }
}

/**
 * Fetch recent Solar Energetic Particle events from DONKI API
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} Array of SEP events
 */
async function fetchRecentSEPs(days = 7) {
  const endDate = getDateString(0);
  const startDate = getDateString(days);
  const url = `${DONKI_BASE}/SEP?startDate=${startDate}&endDate=${endDate}&api_key=${NASA_API_KEY}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching SEP events:', error);
    return [];
  }
}

/**
 * Fetch recent Coronal Mass Ejections from DONKI API
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} Array of CME events
 */
async function fetchRecentCMEs(days = 7) {
  const endDate = getDateString(0);
  const startDate = getDateString(days);
  const url = `${DONKI_BASE}/CME?startDate=${startDate}&endDate=${endDate}&api_key=${NASA_API_KEY}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching CME events:', error);
    return [];
  }
}

/**
 * Generate demo data when API fails or returns empty
 * @returns {Array} Demo space weather events
 */
function getDemoEvents() {
  const now = new Date();
  return [
    {
      classType: 'M3.2',
      peakTime: new Date(now - 2 * 86400000).toISOString(),
      activeRegionNum: 'AR3926',
      sourceLocation: 'N15E45',
      startTime: new Date(now - 2 * 86400000).toISOString()
    },
    {
      classType: 'C7.8',
      peakTime: new Date(now - 5 * 86400000).toISOString(),
      activeRegionNum: 'AR3918',
      sourceLocation: 'S22W10',
      startTime: new Date(now - 5 * 86400000).toISOString()
    },
    {
      peakFlux: 245,
      startTime: new Date(now - 3 * 86400000).toISOString(),
      eventType: 'SEP'
    }
  ];
}

/**
 * Load live feed from all DONKI endpoints
 * Combines flares, SEPs, and CMEs into unified event list
 */
async function loadLiveFeed() {
  const donkiStatus = document.getElementById('donki-status');
  const lastUpdated = document.getElementById('last-updated');
  
  if (donkiStatus) {
    donkiStatus.innerHTML = '<span class="badge-live">● FETCHING DATA...</span>';
  }
  
  try {
    // Fetch all three data sources in parallel
    const [flares, seps, cmes] = await Promise.all([
      fetchRecentFlares(7),
      fetchRecentSEPs(7),
      fetchRecentCMEs(7)
    ]);
    
    // Combine all events
    const allEvents = [...flares, ...seps, ...cmes];
    
    // Sort by date (most recent first)
    allEvents.sort((a, b) => {
      const dateA = a.peakTime || a.startTime;
      const dateB = b.peakTime || b.startTime;
      return new Date(dateB) - new Date(dateA);
    });
    
    // Update UI
    if (donkiStatus) {
      const eventCount = allEvents.length;
      donkiStatus.innerHTML = `<span class="badge-connected">● CONNECTED TO NASA DONKI</span>`;
      if (lastUpdated) {
        lastUpdated.innerHTML = `Last update: ${new Date().toLocaleTimeString()} | ${eventCount} events detected`;
        lastUpdated.classList.add('connected-pulse');
      }
    }
    
    // Render alerts (use demo if empty but show message)
    if (allEvents.length === 0) {
      // Show quiet period message
      const container = document.getElementById('alerts-container');
      if (container) {
        container.innerHTML = `
          <div class="alert-card" style="border-left-color: var(--mint);">
            <div class="alert-class">✅ SPACE WEATHER NOMINAL</div>
            <div class="alert-details">No active solar events in the past 7 days. Radiation levels: background.</div>
          </div>
        `;
      }
    } else {
      renderAlerts(allEvents);
    }
    
    // Store latest severe event for simulation
    const severeEvents = allEvents.filter(e => getEventSeverity(e) === 'extreme' || getEventSeverity(e) === 'high');
    if (severeEvents.length > 0) {
      window.latestSevereEvent = severeEvents[0];
    } else if (allEvents.length > 0) {
      window.latestSevereEvent = allEvents[0];
    }
    
  } catch (error) {
    console.error('Error loading DONKI feed:', error);
    
    if (donkiStatus) {
      donkiStatus.innerHTML = `<span class="badge-warning">⚠️ DONKI API LIMITED — DEMO MODE ACTIVE</span>`;
      if (lastUpdated) {
        lastUpdated.innerHTML = `Last update: ${new Date().toLocaleTimeString()} (demo data)`;
      }
    }
    
    // Show demo data
    const demoEvents = getDemoEvents();
    renderAlerts(demoEvents);
    window.latestSevereEvent = demoEvents[0];
  }
}

/**
 * Simulate a historical storm event
 * @param {string} stormKey - Key in HISTORICAL_STORMS object
 */
function simulateHistoricalStorm(stormKey) {
  const storm = HISTORICAL_STORMS[stormKey];
  if (!storm) {
    console.error('Unknown storm key:', stormKey);
    return;
  }
  
  // Show notification
  if (typeof window.showNotification === 'function') {
    window.showNotification(`⚠️ SIMULATING: ${storm.label}`, 'warning', 4000);
  }
  
  // Create a storm event object
  const stormEvent = {
    ...storm,
    isHistorical: true,
    startTime: storm.date,
    severity: 'extreme',
    description: storm.description
  };
  
  // Add a dramatic alert card to the feed
  const container = document.getElementById('alerts-container');
  if (container) {
    const historicalCard = document.createElement('div');
    historicalCard.className = 'alert-card card-danger';
    historicalCard.style.animation = 'alert-slide-in 0.3s ease forwards';
    historicalCard.style.marginTop = '1rem';
    historicalCard.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
        <span style="font-size: 2rem;">🌋</span>
        <div class="alert-class" style="font-size: 1.2rem;">HISTORICAL EVENT: ${storm.label}</div>
      </div>
      <div class="alert-details">
        <strong>Date:</strong> ${storm.date}<br>
        <strong>Class:</strong> ${storm.class}<br>
        <strong>Peak Flux:</strong> ${storm.peakFluxPfu.toLocaleString()} pfu<br>
        <strong>Impact:</strong> ${storm.description}
      </div>
    `;
    container.prepend(historicalCard);
  }
  
  // Call app handler
  if (typeof window.handleStormImpact === 'function') {
    window.handleStormImpact(stormEvent);
  }
  
  // Smooth scroll to habitat builder
  if (typeof window.smoothScrollTo === 'function') {
    setTimeout(() => window.smoothScrollTo('#habitat-builder'), 500);
  }
}

/**
 * Simulate current live solar impact on habitat
 * Uses the most severe event from the latest feed
 */
function simulateLiveStormOnHabitat() {
  let event = window.latestSevereEvent;
  
  if (!event) {
    // Create default moderate event
    event = {
      classType: 'M5.0',
      peakTime: new Date().toISOString(),
      label: 'Live M5.0 Solar Flare',
      description: 'Moderate solar flare detected. Radiation levels elevated.',
      radiationMultiplier: 3.5,
      startTime: new Date().toISOString()
    };
  }
  
  const severity = getEventSeverity(event);
  const eventName = event.classType || 'Solar Particle Event';
  
  if (typeof window.showNotification === 'function') {
    window.showNotification(`⚡ SIMULATING IMPACT: ${eventName}`, severity === 'extreme' ? 'danger' : 'warning', 4000);
  }
  
  // Add alert card for the simulation
  const container = document.getElementById('alerts-container');
  if (container) {
    const impactCard = createAlertCard(event, 0);
    impactCard.style.marginTop = '0.5rem';
    impactCard.style.borderLeft = `4px solid var(--crimson)`;
    container.prepend(impactCard);
  }
  
  // Create full event object for app handler
  const impactEvent = {
    ...event,
    label: eventName,
    description: `Live ${eventName} event impacting habitat`,
    radiationMultiplier: severity === 'extreme' ? 12 : severity === 'high' ? 6 : 2.5
  };
  
  if (typeof window.handleStormImpact === 'function') {
    window.handleStormImpact(impactEvent);
  }
  
  if (typeof window.smoothScrollTo === 'function') {
    setTimeout(() => window.smoothScrollTo('#habitat-builder'), 500);
  }
}

/**
 * Start polling DONKI API at regular intervals
 * Sets up countdown timer for next update
 */
function startPolling() {
  // Initial load
  loadLiveFeed();
  
  // Set up periodic polling
  setInterval(() => {
    loadLiveFeed();
  }, POLL_INTERVAL_MS);
  
  // Update countdown timer every second
  let nextUpdateTime = Date.now() + POLL_INTERVAL_MS;
  
  function updateCountdown() {
    const now = Date.now();
    const remaining = Math.max(0, nextUpdateTime - now);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    const countdownElement = document.getElementById('update-countdown');
    if (countdownElement) {
      countdownElement.textContent = `Next update in ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    if (remaining <= 0) {
      nextUpdateTime = Date.now() + POLL_INTERVAL_MS;
    }
    
    requestAnimationFrame(updateCountdown);
  }
  
  // Create countdown element if it doesn't exist
  const donkiStatus = document.getElementById('donki-status');
  if (donkiStatus && !document.getElementById('update-countdown')) {
    const countdownSpan = document.createElement('span');
    countdownSpan.id = 'update-countdown';
    countdownSpan.style.marginLeft = '1rem';
    countdownSpan.style.fontSize = '0.75rem';
    countdownSpan.style.color = 'var(--muted)';
    donkiStatus.appendChild(countdownSpan);
  }
  
  updateCountdown();
}

// ========== INITIALIZATION ==========
function initDonkiModule() {
  console.log('DONKI module initializing...');
  
  // Start polling for data
  startPolling();
  
  // Wire up historical storm buttons
  const stormBtns = document.querySelectorAll('.hist-storm-btn, [data-storm]');
  stormBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const stormKey = btn.getAttribute('data-storm');
      if (stormKey && HISTORICAL_STORMS[stormKey]) {
        simulateHistoricalStorm(stormKey);
      } else if (stormKey === 'halloween') {
        simulateHistoricalStorm('halloween2003');
      } else if (stormKey === 'apollo') {
        simulateHistoricalStorm('apollo1972');
      } else if (stormKey === 'carrington') {
        simulateHistoricalStorm('carrington');
      }
    });
  });
  
  // Wire up simulate impact button
  const simulateBtn = document.getElementById('simulate-impact-btn');
  if (simulateBtn) {
    simulateBtn.addEventListener('click', () => {
      simulateLiveStormOnHabitat();
    });
  }
}

// Export functions for use in other modules
window.donki = {
  fetchRecentFlares,
  fetchRecentSEPs,
  fetchRecentCMEs,
  loadLiveFeed,
  simulateHistoricalStorm,
  simulateLiveStormOnHabitat,
  HISTORICAL_STORMS
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDonkiModule);
} else {
  initDonkiModule();
}
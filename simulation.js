/**
 * js/simulation.js - PureFlow Habitat Calculation Engine
 * Pure math functions for habitat simulation
 * No external dependencies
 */

// ========== MODULE CATALOG (Source of Truth) ==========
const MODULE_CATALOG = {
  crew_quarters: {
    name: 'Crew Quarters',
    id: 'crew_quarters',
    icon: '🛏️',
    massKg: 1200,
    powerDrawW: 850,
    volumeM3: 32,
    radiationShieldingGcm2: 8.0,
    category: 'habitation',
    perCrew: true
  },
  eclss_bay: {
    name: 'ECLSS Bay',
    id: 'eclss_bay',
    icon: '🌬️',
    massKg: 3200,
    powerDrawW: 2400,
    volumeM3: 24,
    radiationShieldingGcm2: 7.5,
    o2GenerationRateKgDay: 0.84,
    co2RemovalEfficiency: 0.95,
    waterRecoveryRate: 0.93,
    category: 'life_support'
  },
  greenhouse: {
    name: 'Greenhouse',
    id: 'greenhouse',
    icon: '🌿',
    massKg: 1800,
    powerDrawW: 1200,
    volumeM3: 42,
    radiationShieldingGcm2: 6.0,
    waterConsumptionLDay: 8,
    co2ConsumptionKgDay: 1.2,
    o2ProductionKgDay: 0.88,
    areaM2: 12,
    category: 'life_support'
  },
  storm_shelter: {
    name: 'Storm Shelter',
    id: 'storm_shelter',
    icon: '🛡️',
    massKg: 2800,
    powerDrawW: 120,
    volumeM3: 18,
    radiationShieldingGcm2: 45.0,
    category: 'safety'
  },
  science_lab: {
    name: 'Science Lab',
    id: 'science_lab',
    icon: '🔬',
    massKg: 1500,
    powerDrawW: 1800,
    volumeM3: 28,
    radiationShieldingGcm2: 6.0,
    category: 'science'
  },
  airlock: {
    name: 'Airlock',
    id: 'airlock',
    icon: '🚪',
    massKg: 890,
    powerDrawW: 340,
    volumeM3: 6,
    radiationShieldingGcm2: 5.0,
    category: 'access'
  }
};

// ========== DESTINATION ENVIRONMENT DATA ==========
const DESTINATIONS = {
  moon: {
    name: 'Lunar Surface',
    gcr_dose_msv_yr: 380,
    sep_risk_multiplier: 1.0,
    solar_constant_w_m2: 1361,
    dust_storm_risk: 0,
    temp_min_c: -170,
    temp_max_c: 130,
    gravity_g: 0.165
  },
  mars: {
    name: 'Mars Surface',
    gcr_dose_msv_yr: 230,
    sep_risk_multiplier: 0.44,
    solar_constant_w_m2: 591,
    dust_storm_risk: 0.35,
    temp_min_c: -125,
    temp_max_c: 20,
    gravity_g: 0.376
  },
  deep_space: {
    name: 'Deep Space',
    gcr_dose_msv_yr: 680,
    sep_risk_multiplier: 0.9,
    solar_constant_w_m2: 200,
    dust_storm_risk: 0,
    temp_min_c: -270,
    temp_max_c: -270,
    gravity_g: 0
  }
};

// ========== SIMULATION STATE ==========
let currentModules = [];
let currentCrewSize = 4;
let currentDestination = 'mars';
let currentDurationDays = 500;
let advancedECLSS = false;
let greenhouseIntegration = false;
let isruActive = false;
let activeStormEvent = null;

// ========== CALCULATION FUNCTIONS ==========

/**
 * Calculate mass budget including structure, modules, and consumables
 * @param {Array} modules - List of module objects
 * @param {number} crewSize - Number of crew members
 * @param {number} durationDays - Mission duration in days
 * @returns {Object} Mass budget breakdown
 */
function calculateMassBudget(modules, crewSize, durationDays) {
  let modulesMassKg = 0;
  
  modules.forEach(moduleId => {
    const module = MODULE_CATALOG[moduleId];
    if (module) {
      modulesMassKg += module.massKg;
    }
  });
  
  // Consumables: 2.5 kg per person per day (food + basic supplies)
  const consumablesMassKg = crewSize * durationDays * 2.5;
  
  // Water initial load: 3 kg per person per day
  // Adjust for water recovery if ECLSS present
  const hasECLSS = modules.includes('eclss_bay');
  const waterRecoveryRate = hasECLSS ? 0.93 : 0.3;
  const waterMassKg = crewSize * 3.0 * durationDays * (1 - waterRecoveryRate);
  
  const totalMassKg = modulesMassKg + consumablesMassKg + waterMassKg;
  
  return {
    modulesMassKg,
    consumablesMassKg,
    waterMassKg,
    totalMassKg
  };
}

/**
 * Calculate power balance between generation and consumption
 * @param {Array} modules - List of module objects
 * @param {string} destination - Destination key
 * @param {number} solarPanelAreaM2 - Solar panel area in square meters
 * @returns {Object} Power balance details
 */
function calculatePowerBalance(modules, destination, solarPanelAreaM2 = 40) {
  let consumptionW = 0;
  
  modules.forEach(moduleId => {
    const module = MODULE_CATALOG[moduleId];
    if (module) {
      consumptionW += module.powerDrawW;
    }
  });
  
  // Base life support power for crew (500W per person)
  consumptionW += currentCrewSize * 500;
  
  // Solar power generation
  const destData = DESTINATIONS[destination] || DESTINATIONS.mars;
  const solarConstant = destData.solar_constant_w_m2;
  const efficiency = 0.29;
  const generationW = solarConstant * solarPanelAreaM2 * efficiency;
  
  const balanceW = generationW - consumptionW;
  const surplus = balanceW > 0;
  
  return {
    generationW: Math.round(generationW),
    consumptionW: Math.round(consumptionW),
    balanceW: Math.round(balanceW),
    surplus
  };
}

/**
 * Calculate ECLSS (Environmental Control and Life Support) metrics
 * @param {Array} modules - List of module objects
 * @param {number} crewSize - Number of crew members
 * @param {boolean} advancedECLSS - Advanced systems active
 * @param {boolean} greenhouseActive - Greenhouse integration active
 * @returns {Object} ECLSS performance metrics
 */
function calculateECLSS(modules, crewSize, advancedECLSS, greenhouseActive) {
  const hasECLSS = modules.includes('eclss_bay');
  const hasGreenhouse = modules.includes('greenhouse') && greenhouseActive;
  
  // Base closure rates
  let waterClosure = hasECLSS ? 0.90 : 0.40;
  let airClosure = hasECLSS ? 0.88 : 0.35;
  
  if (advancedECLSS) {
    waterClosure += 0.06;
    airClosure += 0.08;
  }
  
  if (hasGreenhouse) {
    waterClosure += 0.03;
    airClosure += 0.07;
  }
  
  if (isruActive) {
    waterClosure += 0.05;
    airClosure += 0.04;
  }
  
  waterClosure = Math.min(0.98, waterClosure);
  airClosure = Math.min(0.97, airClosure);
  
  const closurePercent = Math.round(((waterClosure + airClosure) / 2) * 100);
  
  // CO2 and O2 calculations
  const co2ProductionKgDay = crewSize * 1.04;
  const co2RemovalRate = hasECLSS ? 0.95 : 0.4;
  const co2RemovedKgDay = co2ProductionKgDay * co2RemovalRate;
  
  // CO2 partial pressure simulation (typical spacecraft: 3-5 mmHg)
  let co2PressureMmhg = 3.5;
  if (!hasECLSS) {
    co2PressureMmhg = 5.2;
  } else if (airClosure < 0.7) {
    co2PressureMmhg = 4.5;
  }
  
  // O2 sufficiency check
  const o2RequiredKgDay = crewSize * 0.84;
  let o2ProducedKgDay = 0;
  
  if (hasECLSS) {
    o2ProducedKgDay += o2RequiredKgDay * 0.95;
  }
  if (hasGreenhouse) {
    const greenhouseModule = MODULE_CATALOG.greenhouse;
    o2ProducedKgDay += greenhouseModule.o2ProductionKgDay;
  }
  
  const o2Sufficient = o2ProducedKgDay >= o2RequiredKgDay * 0.95;
  
  // Water calculations
  const waterRequiredLDay = crewSize * 3.0;
  let waterRecoveredLDay = waterRequiredLDay * waterClosure;
  const waterDailyDeficitL = Math.max(0, waterRequiredLDay - waterRecoveredLDay);
  
  return {
    closurePercent,
    co2PressureMmhg: co2PressureMmhg.toFixed(1),
    o2Sufficient,
    waterDailyDeficitL: Math.round(waterDailyDeficitL),
    waterClosure: Math.round(waterClosure * 100),
    airClosure: Math.round(airClosure * 100)
  };
}

/**
 * Calculate radiation dose based on modules and destination
 * @param {Array} modules - List of module objects
 * @param {string} destination - Destination key
 * @param {number} stormMultiplier - Additional radiation from solar storm
 * @returns {Object} Radiation dose metrics
 */
function calculateRadiationDose(modules, destination, stormMultiplier = 1.0) {
  const destData = DESTINATIONS[destination];
  const baseDoseMsvYr = destData.gcr_dose_msv_yr;
  
  // Calculate average shielding from modules (weighted by volume)
  let totalShielding = 0;
  let totalVolume = 0;
  
  modules.forEach(moduleId => {
    const module = MODULE_CATALOG[moduleId];
    if (module && module.radiationShieldingGcm2) {
      totalShielding += module.radiationShieldingGcm2 * module.volumeM3;
      totalVolume += module.volumeM3;
    }
  });
  
  const avgShielding = totalVolume > 0 ? totalShielding / totalVolume : 2.0;
  
  // Radiation reduction from shielding (exponential decay model)
  // Higher shielding = lower dose, with diminishing returns
  const reductionFactor = Math.exp(-0.045 * avgShielding);
  let annualDoseMsv = baseDoseMsvYr * reductionFactor;
  
  // Apply storm multiplier if active
  annualDoseMsv *= stormMultiplier;
  
  // Add storm shelter special bonus
  if (modules.includes('storm_shelter')) {
    annualDoseMsv *= 0.65;
  }
  
  // Apply destination-specific risk
  annualDoseMsv *= destData.sep_risk_multiplier;
  
  annualDoseMsv = Math.round(annualDoseMsv * 10) / 10;
  
  // NASA career limit: 600 mSv total
  const careerLimitDays = Math.floor(600 / (annualDoseMsv / 365));
  const percentOfLimit = Math.min(100, Math.round((annualDoseMsv / 600) * 100));
  
  return {
    annualDoseMsv,
    careerLimitDays,
    percentOfLimit,
    avgShieldingGcm2: avgShielding.toFixed(1)
  };
}

/**
 * Calculate maximum survival days without resupply
 * @param {Array} modules - List of module objects
 * @param {number} crewSize - Number of crew members
 * @param {string} destination - Destination key
 * @returns {number} Maximum survival days
 */
function calculateMaxSurvivalDays(modules, crewSize, destination) {
  const massBudget = calculateMassBudget(modules, crewSize, 365);
  const powerBalance = calculatePowerBalance(modules, destination);
  const eclss = calculateECLSS(modules, crewSize, advancedECLSS, greenhouseIntegration);
  
  // Determine limiting factor
  let maxDays = 1000; // Theoretical maximum
  
  // Consumables limit (mass-based)
  const consumableLimit = Math.floor(massBudget.consumablesMassKg / (crewSize * 2.5));
  maxDays = Math.min(maxDays, consumableLimit);
  
  // Power limit (if deficit)
  if (powerBalance.balanceW < 0) {
    const deficitW = Math.abs(powerBalance.balanceW);
    const batteryCapacity = 100000; // 100 kWh battery
    const powerLimit = Math.floor(batteryCapacity / deficitW);
    maxDays = Math.min(maxDays, powerLimit);
  }
  
  // Water limit
  if (eclss.waterDailyDeficitL > 0) {
    const waterReserve = crewSize * 3 * 30; // 30 days reserve
    const waterLimit = Math.floor(waterReserve / eclss.waterDailyDeficitL);
    maxDays = Math.min(maxDays, waterLimit);
  }
  
  // Radiation limit (career limit)
  const radiation = calculateRadiationDose(modules, destination);
  const radiationLimit = Math.min(3650, radiation.careerLimitDays);
  maxDays = Math.min(maxDays, radiationLimit);
  
  return Math.max(30, maxDays);
}

/**
 * Calculate survivability score and failure modes
 * @param {Object} habitatState - Current habitat configuration
 * @param {Object} missionParams - Mission parameters
 * @param {Object} stormEvent - Optional active storm event
 * @returns {Object} Score, failure modes, and metrics
 */
function calculateSurvivability(habitatState, missionParams, stormEvent = null) {
  // Extract state
  const modules = habitatState.modules || currentModules;
  const crewSize = missionParams.crewSize || currentCrewSize;
  const destination = missionParams.destination || currentDestination;
  const durationDays = missionParams.durationDays || currentDurationDays;
  
  const stormMultiplier = (stormEvent && stormEvent.radiationMultiplier) ? stormEvent.radiationMultiplier : 1.0;
  const hasStormShelter = modules.includes('storm_shelter');
  
  // Calculate all metrics
  const massBudget = calculateMassBudget(modules, crewSize, durationDays);
  const powerBalance = calculatePowerBalance(modules, destination);
  const eclss = calculateECLSS(modules, crewSize, advancedECLSS, greenhouseIntegration);
  const radiation = calculateRadiationDose(modules, destination, stormMultiplier);
  const maxSurvivalDays = calculateMaxSurvivalDays(modules, crewSize, destination);
  
  // Calculate sub-scores (0-100)
  
  // Power score
  let powerScore = 100;
  if (powerBalance.balanceW < 0) {
    const deficitW = Math.abs(powerBalance.balanceW);
    powerScore = Math.max(0, 100 - (deficitW / 20));
  } else if (powerBalance.balanceW < 500) {
    powerScore = 70 + (powerBalance.balanceW / 20);
  }
  powerScore = Math.min(100, Math.max(0, powerScore));
  
  // ECLSS score
  let eclssScore = eclss.closurePercent;
  if (eclss.co2PressureMmhg > 5.3) {
    eclssScore -= 20;
  }
  if (!eclss.o2Sufficient) {
    eclssScore -= 15;
  }
  eclssScore = Math.min(100, Math.max(0, eclssScore));
  
  // Radiation score (100 - % of career limit)
  let radiationScore = 100 - radiation.percentOfLimit;
  if (stormMultiplier > 2.0) {
    radiationScore -= 30;
  }
  radiationScore = Math.min(100, Math.max(0, radiationScore));
  
  // Mass score (based on 20000 kg optimal)
  let massScore = 100;
  if (massBudget.totalMassKg > 20000) {
    massScore = Math.max(0, 100 - ((massBudget.totalMassKg - 20000) / 1000));
  }
  massScore = Math.min(100, Math.max(0, massScore));
  
  // Shelter score
  let shelterScore = hasStormShelter ? 100 : 40;
  if (stormEvent && !hasStormShelter) {
    shelterScore = 0;
  }
  
  // Duration feasibility score
  let durationScore = 100;
  if (durationDays > maxSurvivalDays) {
    durationScore = Math.max(0, 100 - ((durationDays - maxSurvivalDays) / maxSurvivalDays * 100));
  }
  durationScore = Math.min(100, Math.max(0, durationScore));
  
  // Weighted composite score
  const score = (
    powerScore * 0.20 +
    eclssScore * 0.25 +
    radiationScore * 0.25 +
    massScore * 0.10 +
    shelterScore * 0.12 +
    durationScore * 0.08
  );
  
  const finalScore = Math.round(score);
  
  // Failure mode detection
  const failureModes = [];
  
  if (radiationScore < 40) {
    failureModes.push({
      title: '☢️ Excessive Radiation Exposure',
      detail: `Annual dose: ${radiation.annualDoseMsv} mSv exceeds safe limits.`,
      severity: 'critical'
    });
  }
  
  if (powerScore < 30) {
    failureModes.push({
      title: '⚡ Critical Power Deficit',
      detail: `Power deficit: ${Math.abs(powerBalance.balanceW)}W. ECLSS at risk of failure.`,
      severity: 'critical'
    });
  }
  
  if (eclssScore < 50) {
    failureModes.push({
      title: '🌬️ ECLSS Instability',
      detail: `CO₂ pressure: ${eclss.co2PressureMmhg} mmHg. Life support degrading.`,
      severity: 'warning'
    });
  }
  
  if (stormEvent && !hasStormShelter) {
    failureModes.push({
      title: '🛡️ NO STORM SHELTER',
      detail: `Current solar storm would be fatal to unshielded crew.`,
      severity: 'critical'
    });
  }
  
  if (massScore < 20) {
    failureModes.push({
      title: '🚀 Launch Mass Exceeds Limit',
      detail: `Total mass: ${Math.round(massBudget.totalMassKg / 1000)}t exceeds feasible threshold.`,
      severity: 'warning'
    });
  }
  
  if (durationScore < 50) {
    failureModes.push({
      title: '⏱️ Insufficient Consumables',
      detail: `Maximum survival: ${maxSurvivalDays} days < mission duration.`,
      severity: 'critical'
    });
  }
  
  if (!modules.includes('eclss_bay') && crewSize > 2) {
    failureModes.push({
      title: '⚠️ No ECLSS Bay',
      detail: 'Missing primary life support system for crew >2.',
      severity: 'warning'
    });
  }
  
  // Return comprehensive result
  return {
    score: finalScore,
    failureModes,
    subScores: {
      power: Math.round(powerScore),
      eclss: Math.round(eclssScore),
      radiation: Math.round(radiationScore),
      mass: Math.round(massScore),
      shelter: Math.round(shelterScore),
      duration: Math.round(durationScore)
    },
    metrics: {
      totalMassKg: Math.round(massBudget.totalMassKg),
      powerBalanceW: powerBalance.balanceW,
      eclssClosure: eclss.closurePercent,
      radiationDoseMsvYr: radiation.annualDoseMsv,
      maxSurvivalDays,
      hasStormShelter
    }
  };
}

/**
 * Add module to current configuration and recalculate
 * @param {string} moduleId - Module identifier from catalog
 * @returns {Object} Updated simulation results
 */
function addModule(moduleId) {
  if (!currentModules.includes(moduleId) && MODULE_CATALOG[moduleId]) {
    currentModules.push(moduleId);
    return recalculateSimulation();
  }
  return null;
}

/**
 * Remove module from current configuration
 * @param {string} moduleId - Module identifier to remove
 * @returns {Object} Updated simulation results
 */
function removeModule(moduleId) {
  const index = currentModules.indexOf(moduleId);
  if (index > -1) {
    currentModules.splice(index, 1);
    return recalculateSimulation();
  }
  return null;
}

/**
 * Recalculate all simulation metrics
 * @param {boolean} includeStorm - Include active storm event in calculation
 * @returns {Object} Complete simulation state
 */
function recalculateSimulation(includeStorm = true) {
  const habitatState = {
    modules: currentModules,
    crewSize: currentCrewSize,
    destination: currentDestination,
    durationDays: currentDurationDays
  };
  
  const missionParams = {
    crewSize: currentCrewSize,
    destination: currentDestination,
    durationDays: currentDurationDays
  };
  
  const storm = includeStorm && activeStormEvent ? activeStormEvent : null;
  
  const result = calculateSurvivability(habitatState, missionParams, storm);
  
  // Update global state
  window.PureFlow = window.PureFlow || {};
  window.PureFlow.habitat = {
    modules: currentModules,
    totalMassKg: result.metrics.totalMassKg,
    powerBalanceW: result.metrics.powerBalanceW,
    eclssClosure: result.metrics.eclssClosure,
    radiationDoseMsvYr: result.metrics.radiationDoseMsvYr
  };
  window.PureFlow.simulation = {
    survivabilityScore: result.score,
    failureModes: result.failureModes,
    stormActive: activeStormEvent !== null,
    currentEvent: activeStormEvent
  };
  
  return result;
}

/**
 * Set active storm event
 * @param {Object} stormEvent - Storm event data
 */
function setStormEvent(stormEvent) {
  activeStormEvent = stormEvent;
  return recalculateSimulation(true);
}

/**
 * Clear active storm event
 */
function clearStormEvent() {
  activeStormEvent = null;
  return recalculateSimulation(false);
}

/**
 * Update mission parameters
 * @param {Object} params - Mission parameters to update
 */
function updateMissionParams(params) {
  if (params.crewSize !== undefined) currentCrewSize = params.crewSize;
  if (params.destination !== undefined) currentDestination = params.destination;
  if (params.durationDays !== undefined) currentDurationDays = params.durationDays;
  return recalculateSimulation();
}

/**
 * Update ECLSS toggles
 * @param {Object} toggles - Toggle states
 */
function updateECLSSToggles(toggles) {
  if (toggles.advancedECLSS !== undefined) advancedECLSS = toggles.advancedECLSS;
  if (toggles.greenhouseIntegration !== undefined) greenhouseIntegration = toggles.greenhouseIntegration;
  if (toggles.isruActive !== undefined) isruActive = toggles.isruActive;
  return recalculateSimulation();
}

/**
 * Initialize habitat builder UI listeners
 */
function initHabitatBuilder() {
  const moduleCards = document.querySelectorAll('.module-card');
  const advToggle = document.getElementById('adv-eclss');
  const ghToggle = document.getElementById('greenhouse-integration');
  const isruToggle = document.getElementById('isru-toggle');
  
  moduleCards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const moduleId = card.getAttribute('data-module');
      if (moduleId) {
        const moduleKey = moduleId === 'crew' ? 'crew_quarters' :
                         moduleId === 'eclss' ? 'eclss_bay' :
                         moduleId === 'greenhouse' ? 'greenhouse' :
                         moduleId === 'storm' ? 'storm_shelter' :
                         moduleId === 'science' ? 'science_lab' :
                         moduleId === 'airlock' ? 'airlock' : null;
        
        if (moduleKey && !currentModules.includes(moduleKey)) {
          addModule(moduleKey);
          
          // Visual feedback
          card.style.transform = 'scale(0.98)';
          setTimeout(() => { card.style.transform = ''; }, 200);
          
          if (typeof window.showNotification === 'function') {
            window.showNotification(`${MODULE_CATALOG[moduleKey].name} added to habitat`, 'success', 1500);
          }
          
          // Update UI metrics via app
          if (typeof window.updateAllMetrics === 'function') {
            setTimeout(() => window.updateAllMetrics(), 50);
          }
        } else if (currentModules.includes(moduleKey)) {
          if (typeof window.showNotification === 'function') {
            window.showNotification(`Module already installed`, 'info', 1000);
          }
        }
      }
    });
  });
  
  // Toggle listeners
  if (advToggle) {
    advToggle.addEventListener('change', () => {
      updateECLSSToggles({ advancedECLSS: advToggle.checked });
      if (typeof window.updateAllMetrics === 'function') window.updateAllMetrics();
    });
  }
  
  if (ghToggle) {
    ghToggle.addEventListener('change', () => {
      updateECLSSToggles({ greenhouseIntegration: ghToggle.checked });
      if (typeof window.updateAllMetrics === 'function') window.updateAllMetrics();
    });
  }
  
  if (isruToggle) {
    isruToggle.addEventListener('change', () => {
      updateECLSSToggles({ isruActive: isruToggle.checked });
      if (typeof window.updateAllMetrics === 'function') window.updateAllMetrics();
    });
  }
}

// ========== EXPORTS ==========
const simulationAPI = {
  MODULE_CATALOG,
  DESTINATIONS,
  calculateMassBudget,
  calculatePowerBalance,
  calculateECLSS,
  calculateRadiationDose,
  calculateMaxSurvivalDays,
  calculateSurvivability,
  addModule,
  removeModule,
  recalculateSimulation,
  setStormEvent,
  clearStormEvent,
  updateMissionParams,
  updateECLSSToggles,
  initHabitatBuilder,
  getCurrentModules: () => [...currentModules],
  getCurrentCrewSize: () => currentCrewSize,
  getCurrentDestination: () => currentDestination,
  getAdvancedECLSS: () => advancedECLSS,
  getGreenhouseIntegration: () => greenhouseIntegration,
  getIsruActive: () => isruActive,
  getActiveStorm: () => activeStormEvent
};

// Attach to window for global access
window.simulation = simulationAPI;
window.calculateSurvivability = calculateSurvivability;

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initHabitatBuilder();
  });
} else {
  initHabitatBuilder();
}
/**
 * js/app.js - PureFlow Main Controller
 * Vanilla JS, ES6+, no frameworks
 * Handles state, UI initialization, event coordination
 */

// ========== STATE OBJECT ==========
const PureFlow = {
  mission: {
    destination: 'mars',    // 'moon' | 'mars' | 'deep_space'
    crewSize: 4,
    durationDays: 500,
  },
  habitat: {
    modules: [],            // array of placed module objects
    totalMassKg: 0,
    powerBalanceW: 0,
    eclssClosure: 0,        // percentage 0-100
    radiationDoseMsvYr: 0,
  },
  simulation: {
    survivabilityScore: 0,
    failureModes: [],
    stormActive: false,
    currentEvent: null,
  },
  ui: {
    activeNavItem: 'mission-setup',
    toastQueue: [],
  }
};

// ========== UTILITY FUNCTIONS ==========

/**
 * Smooth scroll to element by selector
 * @param {string} selector - CSS selector of target element
 */
function smoothScrollTo(selector) {
  const element = document.querySelector(selector);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Easing function for animations
 * @param {number} t - Progress (0 to 1)
 * @returns {number} - Eased value
 */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animate number counting from start to end value
 * @param {HTMLElement} el - Element to update
 * @param {number} from - Starting value
 * @param {number} to - Ending value
 * @param {number} duration - Animation duration in ms
 * @param {boolean} isFloat - Whether to show decimal places
 */
function animateNumber(el, from, to, duration = 800, isFloat = false) {
  if (!el) return;
  
  const startTime = performance.now();
  const startValue = from;
  const endValue = to;
  const delta = endValue - startValue;
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    let progress = Math.min(1, elapsed / duration);
    progress = easeOutCubic(progress);
    
    let currentValue = startValue + (delta * progress);
    
    if (isFloat) {
      el.textContent = currentValue.toFixed(1);
    } else {
      el.textContent = Math.round(currentValue);
    }
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = isFloat ? endValue.toFixed(1) : Math.round(endValue);
    }
  }
  
  requestAnimationFrame(update);
}

/**
 * Get color class based on score value
 * @param {number} score - Value between 0-100
 * @returns {string} - CSS class name
 */
function getScoreColorClass(score) {
  if (score < 40) return 'danger';
  if (score < 70) return 'warning';
  return 'safe';
}

/**
 * Draw the survivability gauge SVG
 * @param {number} score - Survivability score 0-100
 */
function drawGauge(score) {
  const gaugePath = document.getElementById('gauge-progress');
  const gaugeText = document.getElementById('gauge-text');
  const scoreNumber = document.querySelector('.score-number');
  
  if (!gaugePath) return;
  
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  
  gaugePath.style.strokeDasharray = circumference;
  gaugePath.style.strokeDashoffset = offset;
  
  // Update color based on score
  if (score < 40) {
    gaugePath.setAttribute('stroke', 'var(--crimson)');
    gaugePath.classList.add('gauge-danger');
    gaugePath.classList.remove('gauge-warning', 'gauge-safe');
  } else if (score < 70) {
    gaugePath.setAttribute('stroke', 'var(--gold)');
    gaugePath.classList.add('gauge-warning');
    gaugePath.classList.remove('gauge-danger', 'gauge-safe');
  } else {
    gaugePath.setAttribute('stroke', 'var(--mint)');
    gaugePath.classList.add('gauge-safe');
    gaugePath.classList.remove('gauge-danger', 'gauge-warning');
  }
  
  // Update text displays
  if (gaugeText) gaugeText.textContent = `${Math.round(score)}%`;
  if (scoreNumber) {
    animateNumber(scoreNumber, 
      parseInt(scoreNumber.textContent) || 0, 
      score, 
      800, 
      false
    );
  }
}

/**
 * Show toast notification
 * @param {string} message - Notification message
 * @param {string} type - 'info', 'warning', 'danger', 'success'
 * @param {number} duration - Display duration in ms
 */
function showNotification(message, type = 'info', duration = 4000) {
  const toastContainer = document.getElementById('toast-container') || (() => {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;
    document.body.appendChild(container);
    return container;
  })();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Color mapping
  const colors = {
    info: 'var(--accent)',
    warning: 'var(--gold)',
    danger: 'var(--crimson)',
    success: 'var(--mint)'
  };
  
  toast.style.cssText = `
    background: var(--glass);
    border-left: 4px solid ${colors[type]};
    border-radius: var(--radius-md);
    padding: 12px 20px;
    color: var(--white);
    font-size: 0.875rem;
    font-family: var(--font-mono);
    box-shadow: var(--shadow-card);
    backdrop-filter: blur(10px);
    animation: slideInRight 0.3s ease forwards;
    max-width: 320px;
  `;
  
  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <span>${type === 'danger' ? '⚠️' : type === 'success' ? '✓' : type === 'warning' ? '⚡' : 'ℹ️'}</span>
      <span>${message}</span>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Update failure modes list in UI
 * @param {Array} modes - Array of failure mode objects
 */
function updateFailureModes(modes) {
  const container = document.getElementById('failure-modes');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!modes || modes.length === 0) {
    const successCard = document.createElement('div');
    successCard.className = 'failure-card';
    successCard.style.borderLeftColor = 'var(--mint)';
    successCard.innerHTML = `
      <div class="failure-title">✅ All Systems Nominal</div>
      <div class="failure-detail">No critical failures detected</div>
    `;
    container.appendChild(successCard);
    return;
  }
  
  modes.forEach((mode, index) => {
    const card = document.createElement('div');
    card.className = 'failure-card';
    card.style.animation = `alert-slide-in 0.3s ease forwards`;
    card.style.animationDelay = `${index * 0.1}s`;
    card.style.opacity = '0';
    
    const severityColor = mode.severity === 'critical' ? 'var(--crimson)' : 
                          mode.severity === 'warning' ? 'var(--gold)' : 'var(--accent)';
    card.style.borderLeftColor = severityColor;
    
    card.innerHTML = `
      <div class="failure-title">${mode.title}</div>
      <div class="failure-detail">${mode.detail}</div>
    `;
    container.appendChild(card);
  });
}

/**
 * Update all metrics in UI from state
 */
function updateAllMetrics() {
  // Update metric displays
  const survivabilityEl = document.getElementById('survivability-score');
  if (survivabilityEl) {
    const currentVal = parseInt(survivabilityEl.textContent) || 0;
    animateNumber(survivabilityEl, currentVal, PureFlow.simulation.survivabilityScore, 600, false);
    const colorClass = getScoreColorClass(PureFlow.simulation.survivabilityScore);
    survivabilityEl.className = `metric-value ${colorClass}`;
  }
  
  // Mass budget
  const massEl = document.getElementById('mass-budget');
  if (massEl) {
    const massText = `${PureFlow.habitat.totalMassKg} kg / 8000 kg`;
    massEl.innerHTML = massText;
  }
  
  // Power balance
  const powerEl = document.getElementById('power-balance');
  if (powerEl) {
    animateNumber(powerEl, 
      parseFloat(powerEl.textContent) || 0, 
      PureFlow.habitat.powerBalanceW, 
      500, 
      true
    );
    const powerClass = PureFlow.habitat.powerBalanceW < 0 ? 'danger' : 'safe';
    powerEl.className = `metric-value ${powerClass}`;
  }
  
  // ECLSS closure
  const eclssEl = document.getElementById('eclss-closure');
  if (eclssEl) {
    animateNumber(eclssEl,
      parseInt(eclssEl.textContent) || 0,
      PureFlow.habitat.eclssClosure,
      600,
      false
    );
  }
  
  // Radiation dose
  const radiationEl = document.getElementById('radiation-dose');
  if (radiationEl) {
    animateNumber(radiationEl,
      parseInt(radiationEl.textContent) || 0,
      PureFlow.habitat.radiationDoseMsvYr,
      600,
      false
    );
    const radClass = PureFlow.habitat.radiationDoseMsvYr > 150 ? 'danger' : 
                     PureFlow.habitat.radiationDoseMsvYr > 80 ? 'warning' : 'safe';
    radiationEl.className = `metric-value ${radClass}`;
  }
  
  // Mission duration possible
  const durationPossibleEl = document.getElementById('duration-possible');
  if (durationPossibleEl) {
    const possible = Math.min(
      PureFlow.mission.durationDays,
      Math.floor(PureFlow.mission.durationDays * (PureFlow.simulation.survivabilityScore / 100))
    );
    animateNumber(durationPossibleEl,
      parseInt(durationPossibleEl.textContent) || 0,
      possible,
      600,
      false
    );
  }
  
  // Draw gauge
  drawGauge(PureFlow.simulation.survivabilityScore);
  
  // Update failure modes
  updateFailureModes(PureFlow.simulation.failureModes);
}

/**
 * Recalculate simulation by calling external simulation module
 */
function recalculateSimulation() {
  // Check if simulation module is loaded
  if (typeof window.calculateSurvivability === 'function') {
    const result = window.calculateSurvivability(PureFlow);
    PureFlow.simulation.survivabilityScore = result.score;
    PureFlow.simulation.failureModes = result.failureModes || [];
    PureFlow.habitat = { ...PureFlow.habitat, ...result.habitatMetrics };
    updateAllMetrics();
  } else {
    // Fallback calculation
    const baseScore = 65;
    const massPenalty = Math.max(0, (PureFlow.habitat.totalMassKg - 5000) / 200);
    const powerBonus = PureFlow.habitat.powerBalanceW > 0 ? 15 : -20;
    const radiationPenalty = Math.max(0, PureFlow.habitat.radiationDoseMsvYr / 10);
    let score = baseScore - massPenalty + powerBonus - radiationPenalty + (PureFlow.habitat.eclssClosure / 4);
    score = Math.min(99, Math.max(15, Math.floor(score)));
    
    PureFlow.simulation.survivabilityScore = score;
    PureFlow.simulation.failureModes = [];
    
    if (PureFlow.habitat.powerBalanceW < 0) {
      PureFlow.simulation.failureModes.push({
        title: '⚠️ Power Deficit',
        detail: `Power balance: ${PureFlow.habitat.powerBalanceW.toFixed(1)} kW. Critical systems may fail.`,
        severity: 'critical'
      });
    }
    if (PureFlow.habitat.radiationDoseMsvYr > 200) {
      PureFlow.simulation.failureModes.push({
        title: '☢️ Extreme Radiation',
        detail: `Annual dose: ${PureFlow.habitat.radiationDoseMsvYr} mSv. Crew survival at risk.`,
        severity: 'critical'
      });
    }
    if (PureFlow.habitat.eclssClosure < 50) {
      PureFlow.simulation.failureModes.push({
        title: '🌬️ ECLSS Instability',
        detail: `Closure rate: ${PureFlow.habitat.eclssClosure}%. Life support may fail.`,
        severity: 'warning'
      });
    }
    
    updateAllMetrics();
  }
}

/**
 * Handle solar storm impact from DONKI module
 * @param {Object} event - Storm event data
 */
function handleStormImpact(event) {
  const habitatBuilder = document.getElementById('habitat-builder');
  if (habitatBuilder) {
    habitatBuilder.classList.add('storm-active');
    
    // Apply radiation penalty
    PureFlow.habitat.radiationDoseMsvYr += 85;
    PureFlow.simulation.stormActive = true;
    PureFlow.simulation.currentEvent = event;
    
    showNotification(
      `SOLAR STORM IMPACT! Radiation levels spiked to ${PureFlow.habitat.radiationDoseMsvYr} mSv/yr`,
      'danger',
      6000
    );
    
    recalculateSimulation();
    
    setTimeout(() => {
      habitatBuilder.classList.remove('storm-active');
      PureFlow.simulation.stormActive = false;
      showNotification('Storm subsiding. Habitat systems recovering.', 'info', 4000);
    }, 8000);
  }
}

// ========== INITIALIZATION FUNCTIONS ==========

/**
 * Initialize mission setup UI
 */
function initMissionSetup() {
  // Destination card selection
  const destCards = document.querySelectorAll('.dest-card');
  const radioInputs = document.querySelectorAll('input[name="destination"]');
  
  destCards.forEach((card, index) => {
    card.addEventListener('click', () => {
      const radio = radioInputs[index];
      if (radio) {
        radio.checked = true;
        PureFlow.mission.destination = radio.value;
        
        // Update selected class
        destCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        
        recalculateSimulation();
      }
    });
  });
  
  // Crew size slider
  const crewSlider = document.getElementById('crew-slider');
  const crewValue = document.getElementById('crew-value');
  if (crewSlider && crewValue) {
    crewSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      crewValue.textContent = val;
      PureFlow.mission.crewSize = val;
      recalculateSimulation();
    });
  }
  
  // Mission duration input
  const durationInput = document.getElementById('mission-days');
  const durationValue = document.getElementById('duration-value');
  if (durationInput && durationValue) {
    durationInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      durationValue.textContent = val;
      PureFlow.mission.durationDays = val;
      recalculateSimulation();
    });
  }
  
  // Begin Design button
  const beginBtn = document.getElementById('begin-design-btn');
  if (beginBtn) {
    beginBtn.addEventListener('click', () => {
      smoothScrollTo('#habitat-builder');
      showNotification('Mission parameters locked. Begin habitat configuration.', 'success', 3000);
    });
  }
}

/**
 * Initialize habitat builder UI
 */
function initHabitatBuilder() {
  // Listen for module drop events (handled by simulation.js)
  const container = document.getElementById('three-canvas-container');
  if (container) {
    container.addEventListener('moduleAdded', (e) => {
      if (e.detail && e.detail.module) {
        PureFlow.habitat.modules.push(e.detail.module);
        recalculateSimulation();
        showNotification(`${e.detail.module.name} added to habitat`, 'success', 2000);
      }
    });
  }
}

/**
 * Initialize scroll spy for navigation
 */
function initScrollSpy() {
  const sections = document.querySelectorAll('.section');
  const navLinks = document.querySelectorAll('.nav-links a');
  
  function updateActiveNav() {
    let current = '';
    const scrollPos = window.scrollY + 150;
    
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionBottom = sectionTop + section.offsetHeight;
      if (scrollPos >= sectionTop && scrollPos < sectionBottom) {
        current = section.getAttribute('id');
      }
    });
    
    navLinks.forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      if (href && href === `#${current}`) {
        link.classList.add('active');
        link.style.color = 'var(--accent)';
      } else if (link.style) {
        link.style.color = '';
      }
    });
  }
  
  window.addEventListener('scroll', updateActiveNav);
  updateActiveNav();
}

/**
 * Initialize scroll reveal animations
 */
function initScrollReveal() {
  const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  
  revealElements.forEach(el => observer.observe(el));
}

/**
 * Initialize DONKI feed integration
 */
function initDonkiFeed() {
  // Check if donki module is loaded
  if (typeof window.initDonkiFeed === 'function') {
    window.initDonkiFeed(PureFlow, handleStormImpact);
  } else {
    console.log('DONKI module not loaded, using fallback');
    const alertsContainer = document.getElementById('alerts-container');
    if (alertsContainer) {
      alertsContainer.innerHTML = `
        <div class="alert-card">
          <div class="alert-class">STANDBY MODE</div>
          <div class="alert-details">DONKI feed simulation active. Use storm buttons below.</div>
        </div>
      `;
    }
  }
}

/**
 * Initialize toggle switches for life support
 */
function initLifeSupportToggles() {
  const advEclss = document.getElementById('adv-eclss');
  const greenhouseInt = document.getElementById('greenhouse-integration');
  const isruToggle = document.getElementById('isru-toggle');
  
  const toggles = [advEclss, greenhouseInt, isruToggle];
  toggles.forEach(toggle => {
    if (toggle) {
      toggle.addEventListener('change', () => {
        recalculateSimulation();
        showNotification('ECLSS configuration updated', 'info', 2000);
      });
    }
  });
}

/**
 * Initialize export functionality
 */
function initExport() {
  const exportBtn = document.getElementById('export-report-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const report = {
        timestamp: new Date().toISOString(),
        mission: PureFlow.mission,
        habitat: {
          totalMassKg: PureFlow.habitat.totalMassKg,
          powerBalanceW: PureFlow.habitat.powerBalanceW,
          eclssClosure: PureFlow.habitat.eclssClosure,
          radiationDoseMsvYr: PureFlow.habitat.radiationDoseMsvYr,
        },
        simulation: {
          survivabilityScore: PureFlow.simulation.survivabilityScore,
          failureModes: PureFlow.simulation.failureModes,
        }
      };
      
      const reportStr = JSON.stringify(report, null, 2);
      const blob = new Blob([reportStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pureflow_mission_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      showNotification('Mission report exported successfully', 'success', 3000);
    });
  }
}

/**
 * Initialize navigation and CTA buttons
 */
function initNavigation() {
  const launchBtn = document.getElementById('launch-mission-architect');
  const solarFeedBtn = document.getElementById('view-solar-feed');
  
  if (launchBtn) {
    launchBtn.addEventListener('click', () => smoothScrollTo('#mission-setup'));
  }
  if (solarFeedBtn) {
    solarFeedBtn.addEventListener('click', () => smoothScrollTo('#donki-feed'));
  }
  
  // Nav link smooth scroll
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('href');
      if (target) {
        smoothScrollTo(target);
      }
    });
  });
}

/**
 * Initialize application - called on DOMContentLoaded
 */
function initApp() {
  console.log('PureFlow initializing...');
  
  initNavigation();
  initMissionSetup();
  initHabitatBuilder();
  initScrollSpy();
  initScrollReveal();
  initDonkiFeed();
  initLifeSupportToggles();
  initExport();
  
  // Initial recalculation
  setTimeout(() => {
    recalculateSimulation();
    showNotification('PureFlow online. Mission ready.', 'success', 3000);
  }, 500);
}

// ========== EXPOSE GLOBALLY ==========
window.PureFlow = PureFlow;
window.smoothScrollTo = smoothScrollTo;
window.showNotification = showNotification;
window.updateAllMetrics = updateAllMetrics;
window.recalculateSimulation = recalculateSimulation;
window.handleStormImpact = handleStormImpact;
window.drawGauge = drawGauge;

// ========== INITIALIZE ON DOM READY ==========
document.addEventListener('DOMContentLoaded', initApp);

// ========== ADD CSS FOR TOAST ANIMATIONS ==========
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(100px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  @keyframes slideOutRight {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100px);
    }
  }
  .nav-links a.active {
    color: var(--accent) !important;
    text-shadow: 0 0 8px rgba(0, 194, 255, 0.5);
  }
`;
document.head.appendChild(style);
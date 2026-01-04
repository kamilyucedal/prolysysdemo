import React, { useState, useEffect } from 'react';
import { Sun, Zap, Droplet, Wind, AlertTriangle, Activity, TrendingUp, Thermometer, Gauge, Battery, Cloud, MapPin, Calendar, Settings } from 'lucide-react';

// Real-world solar data by location (Annual average DNI in kWh/m²/day)
const SOLAR_DATA = {
  'Riyadh, Saudi Arabia': { dni: 6.8, lat: 24.7, lon: 46.7, tz: 3 },
  'Phoenix, USA': { dni: 7.2, lat: 33.4, lon: -112.1, tz: -7 },
  'Seville, Spain': { dni: 5.9, lat: 37.4, lon: -5.9, tz: 1 },
  'Dubai, UAE': { dni: 6.5, lat: 25.3, lon: 55.3, tz: 4 },
  'Las Vegas, USA': { dni: 7.5, lat: 36.2, lon: -115.1, tz: -8 },
  'Alice Springs, Australia': { dni: 7.3, lat: -23.7, lon: 133.9, tz: 9.5 },
  'Almeria, Spain': { dni: 6.4, lat: 36.8, lon: -2.4, tz: 1 },
  'Cairo, Egypt': { dni: 6.2, lat: 30.0, lon: 31.2, tz: 2 },
  'Atacama, Chile': { dni: 8.5, lat: -23.6, lon: -70.4, tz: -4 },
  'Ouarzazate, Morocco': { dni: 6.7, lat: 30.9, lon: -6.9, tz: 0 },
  'Tucson, USA': { dni: 7.0, lat: 32.2, lon: -110.9, tz: -7 },
  'Jodhpur, India': { dni: 6.3, lat: 26.3, lon: 73.0, tz: 5.5 },
};

// Plastic types with real pyrolysis characteristics
const PLASTIC_TYPES = {
  'HDPE': {
    name: 'High-Density Polyethylene',
    h2_yield: 168, // mmol/g - catalytic
    carbon_yield: 0.25,
    oil_yield: 0.15,
    gas_yield: 0.10,
    optimal_temp: 850,
    color: '#3b82f6',
    description: 'Bottles, containers',
  },
  'LDPE': {
    name: 'Low-Density Polyethylene',
    h2_yield: 175, // Higher than HDPE
    carbon_yield: 0.22,
    oil_yield: 0.18,
    gas_yield: 0.12,
    optimal_temp: 850,
    color: '#06b6d4',
    description: 'Bags, films',
  },
  'PP': {
    name: 'Polypropylene',
    h2_yield: 165,
    carbon_yield: 0.26,
    oil_yield: 0.16,
    gas_yield: 0.11,
    optimal_temp: 850,
    color: '#8b5cf6',
    description: 'Containers, textiles',
  },
  'PS': {
    name: 'Polystyrene',
    h2_yield: 95, // Lower H2, high aromatics
    carbon_yield: 0.48, // Much higher carbon
    oil_yield: 0.20, // Styrene-rich
    gas_yield: 0.08,
    optimal_temp: 900,
    color: '#ec4899',
    description: 'Foam, packaging',
  },
  'Mixed': {
    name: 'Mixed Plastics',
    h2_yield: 150,
    carbon_yield: 0.30,
    oil_yield: 0.17,
    gas_yield: 0.10,
    optimal_temp: 850,
    color: '#f59e0b',
    description: 'Municipal waste',
  },
};

const CONSTANTS = {
  HELIOSTAT_AREA: 115,
  HELIOSTAT_EFFICIENCY: 0.68,
  RECEIVER_EFFICIENCY: 0.88,
  SALT_TEMP_HOT: 565,
  SALT_TEMP_COLD: 290,
  SALT_HEAT_CAPACITY: 1.55,
  SALT_DENSITY: 1800,
  HEAT_LOSS_PER_HOUR: 0.02,
  PYROLYSIS_ENERGY: 450,
  HELIOSTAT_COUNT: 2127,
  REACTOR_CAPACITY: 500,
  STORAGE_TANK_VOLUME: 12000,
};

const SPEED_OPTIONS = {
  'Real-time (1 day = 24 hours)': 1,
  'Fast (1 day = 2 hours)': 12,
  'Very Fast (1 day = 30 min)': 48,
  'Ultra Fast (1 day = 20 min)': 72,
  'Extreme (1 day = 10 min)': 144,
};

const CSPPyrolysisSimulation = () => {
  // Location and settings
  const [selectedLocation, setSelectedLocation] = useState('Riyadh, Saudi Arabia');
  const [selectedPlastic, setSelectedPlastic] = useState('HDPE');
  const [selectedSpeed, setSelectedSpeed] = useState('Ultra Fast (1 day = 20 min)');
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 15)); // Jan 15, 2026
  
  // Simulation state
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [currentHour, setCurrentHour] = useState(6);
  const [currentMinute, setCurrentMinute] = useState(0);
  
  // Weather state
  const [cloudCover, setCloudCover] = useState(0); // 0-100%
  const [windSpeed, setWindSpeed] = useState(0); // m/s
  
  // System state
  const [heliostats, setHeliostats] = useState({
    operational: CONSTANTS.HELIOSTAT_COUNT,
    maintenance: 0,
    cleaning_needed: 0,
    faulty: 0
  });
  
  const [reactorTemp, setReactorTemp] = useState(290);
  const [saltHotTemp, setSaltHotTemp] = useState(420);
  const [saltColdTemp, setSaltColdTemp] = useState(290);
  const [pyrolysisActive, setPyrolysisActive] = useState(false);
  
  const [production, setProduction] = useState({
    hydrogen: 0,
    carbon: 0,
    wax: 0,
    waste: 0,
    totalPlasticProcessed: 0,
  });
  
  const [dailyStats, setDailyStats] = useState({
    energyCollected: 0,
    plasticProcessed: 0,
    hydrogenProduced: 0,
    carbonProduced: 0,
    heatLoss: 0,
  });

  // Get current location data
  const locationData = SOLAR_DATA[selectedLocation];
  const plasticData = PLASTIC_TYPES[selectedPlastic];
  // TIME_MULTIPLIER calculated inside loop for reactivity

  // Enhanced sun calculation with seasonal variation
  const calculateSunParameters = (hour, minute, dayOfYear) => {
    const hourDecimal = (hour || 0) + (minute || 0) / 60;
    
    // Sunrise/sunset times vary by season and latitude
    const seasonalOffset = Math.sin(((dayOfYear || 1) - 81) / 365 * 2 * Math.PI) * 1.5; // ±1.5 hours
    const latitudeFactor = Math.abs(locationData?.lat || 0) / 90;
    
    const sunrise = 6 - seasonalOffset * latitudeFactor;
    const sunset = 18 + seasonalOffset * latitudeFactor;
    
    if (hourDecimal < sunrise || hourDecimal > sunset) {
      return { elevation: 0, dni: 0, isDaytime: false };
    }
    
    // Calculate elevation
    const dayLength = sunset - sunrise;
    const normalizedHour = (hourDecimal - sunrise) / dayLength;
    const baseElevation = Math.sin(normalizedHour * Math.PI) * 70;
    
    // Latitude correction (lower latitudes = higher sun)
    const latitudeCorrection = 1 - (Math.abs(locationData?.lat || 0) / 90) * 0.3;
    const elevation = baseElevation * latitudeCorrection;
    
    // Calculate DNI based on location's annual average
    const baseDNI = (locationData?.dni || 6.0) * 1000 / 8; // Convert kWh/m²/day to W/m² average
    const timeOfDayFactor = Math.sin(normalizedHour * Math.PI);
    
    // Seasonal variation
    const seasonalFactor = 1 + Math.sin((dayOfYear - 81) / 365 * 2 * Math.PI) * 0.3;
    
    // Cloud effect
    const cloudFactor = 1 - (cloudCover / 100) * 0.7;
    
    const dni = baseDNI * timeOfDayFactor * seasonalFactor * cloudFactor * 1.4;
    
    return { 
      elevation, 
      dni: Math.max(0, dni), 
      isDaytime: true,
      sunrise,
      sunset
    };
  };

  // Thermal power calculation
  const calculateThermalPower = (dni) => {
    const activeHeliostats = heliostats.operational;
    
    // Wind reduces efficiency
    const windEffect = windSpeed > 10 ? 0.95 : 1.0;
    
    const totalArea = activeHeliostats * CONSTANTS.HELIOSTAT_AREA;
    const opticalPower = totalArea * dni * CONSTANTS.HELIOSTAT_EFFICIENCY * windEffect;
    const thermalPower = opticalPower * CONSTANTS.RECEIVER_EFFICIENCY;
    return thermalPower / 1e6;
  };

  // Pyrolysis calculation with selected plastic type
  const processPyrolysis = (thermalPowerMW, deltaTime) => {
    const requiredPowerPerKg = CONSTANTS.PYROLYSIS_ENERGY / 3600;
    const maxPlasticRate = (thermalPowerMW * 1000) / requiredPowerPerKg;
    const actualRate = Math.min(maxPlasticRate, CONSTANTS.REACTOR_CAPACITY);
    
    const plasticProcessed = actualRate * (deltaTime / 3600);
    
    // Use selected plastic characteristics
    const h2_mmol = plasticProcessed * 1000 * plasticData.h2_yield;
    const h2_kg = (h2_mmol * 2.016) / 1e6;
    const carbon_kg = plasticProcessed * plasticData.carbon_yield;
    const wax_kg = plasticProcessed * plasticData.oil_yield;
    const waste_kg = plasticProcessed * plasticData.gas_yield;
    
    return {
      plastic: plasticProcessed,
      hydrogen: h2_kg,
      carbon: carbon_kg,
      wax: wax_kg,
      waste: waste_kg,
      rate: actualRate
    };
  };

  // Random weather events
  const updateWeather = () => {
    // Random cloud formation
    if (Math.random() < 0.05) { // 5% chance each update
      setCloudCover(prev => Math.min(100, prev + Math.random() * 30));
    } else if (cloudCover > 0) {
      setCloudCover(prev => Math.max(0, prev - Math.random() * 15));
    }
    
    // Random wind gusts
    if (Math.random() < 0.1) {
      setWindSpeed(Math.random() * 15);
    } else {
      setWindSpeed(prev => Math.max(0, prev * 0.9));
    }
  };

  // Main simulation loop
  useEffect(() => {
    if (!isRunning) return;
    
    const interval = setInterval(() => {
      setTime(t => t + 1);
      
      // Get current speed multiplier from selected speed
      const speedMultiplier = SPEED_OPTIONS[selectedSpeed] || 72;
      const minuteIncrement = speedMultiplier;
      const newMinute = (currentMinute || 0) + minuteIncrement;
      let newHour = currentHour;
      let finalMinute = newMinute;
      
      if (newMinute >= 60) {
        newHour = currentHour + Math.floor(newMinute / 60);
        finalMinute = newMinute % 60;
      }
      
      // Day rollover
      if (newHour >= 24) {
        newHour = newHour % 24;
        setCurrentDate(prev => new Date(prev.getTime() + 86400000));
        
        // Reset daily stats
        setDailyStats({
          energyCollected: 0,
          plasticProcessed: 0,
          hydrogenProduced: 0,
          carbonProduced: 0,
          heatLoss: 0,
        });
      }
      
      setCurrentHour(newHour);
      setCurrentMinute(finalMinute);
      
      // Weather updates
      if (time % 6 === 0) { // Every 6 seconds
        updateWeather();
      }
      
      // Day of year for seasonal calculation
      const dayOfYear = Math.floor((currentDate - new Date(currentDate.getFullYear(), 0, 0)) / 86400000);
      
      // Sun parameters
      const { elevation, dni, isDaytime } = calculateSunParameters(newHour, finalMinute, dayOfYear);
      
      // Thermal power
      const thermalPower = calculateThermalPower(dni);
      
      // Reactor temperature dynamics
      setReactorTemp(prev => {
        if (thermalPower > 5 && isDaytime) {
          const heating = Math.min(2 * speedMultiplier / 10, thermalPower / 10);
          return Math.min(prev + heating, plasticData.optimal_temp);
        } else {
          return Math.max(prev - 0.5 * speedMultiplier / 10, CONSTANTS.SALT_TEMP_COLD);
        }
      });
      
      // Salt temperatures
      setSaltHotTemp(prev => {
        if (thermalPower > 3 && isDaytime) {
          return Math.min(prev + 0.8 * speedMultiplier / 10, CONSTANTS.SALT_TEMP_HOT);
        } else {
          return Math.max(prev - CONSTANTS.HEAT_LOSS_PER_HOUR * speedMultiplier / 60, CONSTANTS.SALT_TEMP_COLD);
        }
      });
      
      // Pyrolysis
      const minTemp = plasticData.optimal_temp - 200;
      const pyrolysisReady = reactorTemp > minTemp;
      setPyrolysisActive(pyrolysisReady);
      
      if (pyrolysisReady && thermalPower > 2) {
        const products = processPyrolysis(thermalPower, 60 * speedMultiplier);
        
        setProduction(prev => ({
          hydrogen: prev.hydrogen + products.hydrogen,
          carbon: prev.carbon + products.carbon,
          wax: prev.wax + products.wax,
          waste: prev.waste + products.waste,
          totalPlasticProcessed: prev.totalPlasticProcessed + products.plastic
        }));
        
        setDailyStats(prev => ({
          ...prev,
          energyCollected: prev.energyCollected + (thermalPower * speedMultiplier / 60),
          plasticProcessed: prev.plasticProcessed + products.plastic,
          hydrogenProduced: prev.hydrogenProduced + products.hydrogen,
          carbonProduced: prev.carbonProduced + products.carbon,
        }));
      }
      
      // Heat loss
      setDailyStats(prev => ({
        ...prev,
        heatLoss: prev.heatLoss + (CONSTANTS.HEAT_LOSS_PER_HOUR * (saltHotTemp - 20) * 0.01 * speedMultiplier / 60)
      }));
      
      // Random heliostat issues
      if (Math.random() < 0.0001 * speedMultiplier) {
        setHeliostats(prev => ({
          ...prev,
          operational: prev.operational - 1,
          faulty: prev.faulty + 1
        }));
      }
      
      if (Math.random() < 0.001 * speedMultiplier) {
        setHeliostats(prev => ({
          ...prev,
          cleaning_needed: Math.min(prev.cleaning_needed + 1, prev.operational * 0.1)
        }));
      }
      
    }, 100);
    
    return () => clearInterval(interval);
  }, [isRunning, time, currentHour, currentMinute, reactorTemp, saltHotTemp, cloudCover, windSpeed, currentDate, selectedPlastic, selectedSpeed]);
  
  const dayOfYear = Math.floor((currentDate - new Date(currentDate.getFullYear(), 0, 0)) / 86400000);
  const { elevation, dni, isDaytime, sunrise, sunset } = calculateSunParameters(currentHour + currentMinute/60, 0, dayOfYear);
  const thermalPower = calculateThermalPower(dni);
  
  // Tank levels
  const h2TankLevel = Math.min((production.hydrogen / 100) * 100, 100);
  const carbonTankLevel = Math.min((production.carbon / 500) * 100, 100);
  
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #2d1b3d 100%)',
      color: '#e0e6ed',
      fontFamily: '"Rajdhani", "Roboto Condensed", sans-serif',
      padding: '2rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background effects */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 20% 80%, rgba(255,136,0,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(0,180,255,0.06) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />
      
      {/* Header with controls */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: 700,
              margin: 0,
              background: 'linear-gradient(90deg, #ff8800, #ffb347)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '2px',
              textTransform: 'uppercase'
            }}>
              CSP Plastic Pyrolysis Plant
            </h1>
            <p style={{ margin: '0.5rem 0 0 0', color: '#8b95a5', fontSize: '0.95rem' }}>
              Concentrated Solar Power & Hydrogen Production - Real-time Simulation
            </p>
          </div>
          
          {/* Settings panel */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'flex-start'
          }}>
            {/* Speed selector */}
            <div style={{
              background: 'rgba(15,23,42,0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.8rem', color: '#8b95a5', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={14} />
                Simulation Speed
              </div>
              <select
                value={selectedSpeed}
                onChange={(e) => setSelectedSpeed(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: '#e0e6ed',
                  padding: '0.5rem',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  width: '200px'
                }}
              >
                {Object.keys(SPEED_OPTIONS).map(speed => (
                  <option key={speed} value={speed}>{speed}</option>
                ))}
              </select>
              <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>
                {SPEED_OPTIONS[selectedSpeed]}x real-time
              </div>
            </div>
            
            {/* Location selector */}
            <div style={{
              background: 'rgba(15,23,42,0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.8rem', color: '#8b95a5', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={14} />
                Location
              </div>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: '#e0e6ed',
                  padding: '0.5rem',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  width: '200px'
                }}
              >
                {Object.keys(SOLAR_DATA).map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
              <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>
                DNI: {locationData.dni} kWh/m²/day
              </div>
            </div>
            
            {/* Plastic type selector */}
            <div style={{
              background: 'rgba(15,23,42,0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.8rem', color: '#8b95a5', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={14} />
                Plastic Type
              </div>
              <select
                value={selectedPlastic}
                onChange={(e) => setSelectedPlastic(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: '#e0e6ed',
                  padding: '0.5rem',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  width: '200px'
                }}
              >
                {Object.keys(PLASTIC_TYPES).map(type => (
                  <option key={type} value={type}>
                    {type} - {PLASTIC_TYPES[type].name}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>
                {plasticData.description}
              </div>
            </div>
            
            {/* Date and time */}
            <div style={{
              background: 'rgba(255,136,0,0.1)',
              border: '2px solid rgba(255,136,0,0.3)',
              borderRadius: '12px',
              padding: '1rem',
              minWidth: '180px'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#8b95a5', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={14} />
                {currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ff8800' }}>
                {String(currentHour || 0).padStart(2, '0')}:{String(Math.floor(currentMinute || 0)).padStart(2, '0')}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#8b95a5', marginTop: '0.25rem' }}>
                {isDaytime ? `☀️ Day (${(sunrise || 6).toFixed(1)}-${(sunset || 18).toFixed(1)})` : '🌙 Night'}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Top metrics */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: '1rem', 
        marginBottom: '2rem',
        position: 'relative',
        zIndex: 1
      }}>
        <MetricCard 
          icon={<Sun size={24} />}
          title="DNI"
          value={dni.toFixed(0)}
          unit="W/m²"
          color="#ff8800"
          subtitle={`Elevation: ${elevation.toFixed(1)}°`}
        />
        <MetricCard 
          icon={cloudCover > 30 ? <Cloud size={24} /> : <Sun size={24} />}
          title="Weather"
          value={cloudCover.toFixed(0)}
          unit="% clouds"
          color={cloudCover > 50 ? "#6b7280" : "#fbbf24"}
          subtitle={`Wind: ${windSpeed.toFixed(1)} m/s`}
        />
        <MetricCard 
          icon={<Zap size={24} />}
          title="Thermal Power"
          value={thermalPower.toFixed(2)}
          unit="MW"
          color="#00b4ff"
          subtitle={`${heliostats.operational} heliostats active`}
        />
        <MetricCard 
          icon={<Thermometer size={24} />}
          title="Reactor Temp"
          value={reactorTemp.toFixed(0)}
          unit="°C"
          color={reactorTemp > plasticData.optimal_temp - 200 ? "#4ade80" : "#fbbf24"}
          subtitle={pyrolysisActive ? "Pyrolysis Active" : "Heating..."}
        />
        <MetricCard 
          icon={<Activity size={24} />}
          title="H₂ Production"
          value={production.hydrogen.toFixed(2)}
          unit="kg"
          color="#10b981"
          subtitle={`Today: ${dailyStats.hydrogenProduced.toFixed(2)} kg`}
        />
      </div>
      
      {/* Main grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1.2fr 1fr 1fr', 
        gap: '1.5rem',
        position: 'relative',
        zIndex: 1
      }}>
        
        {/* Heliostat field */}
        <div style={{
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <h3 style={{ 
            margin: '0 0 1.5rem 0', 
            fontSize: '1.2rem', 
            color: '#ff8800',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Sun size={20} />
            Heliostat Field
          </h3>
          
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            border: '1px solid rgba(255,136,0,0.2)'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(20, 1fr)',
              gap: '3px',
              marginBottom: '1rem'
            }}>
              {Array.from({ length: 200 }).map((_, i) => {
                const isOperational = i < (heliostats.operational / CONSTANTS.HELIOSTAT_COUNT) * 200;
                const needsCleaning = Math.random() < (heliostats.cleaning_needed / CONSTANTS.HELIOSTAT_COUNT);
                const isFaulty = i >= (heliostats.operational / CONSTANTS.HELIOSTAT_COUNT) * 200;
                
                let color = 'rgba(255,136,0,0.8)';
                if (isFaulty) color = 'rgba(239,68,68,0.6)';
                else if (needsCleaning) color = 'rgba(251,191,36,0.6)';
                else if (dni < 200) color = 'rgba(255,136,0,0.3)';
                
                return (
                  <div
                    key={i}
                    style={{
                      width: '100%',
                      paddingBottom: '100%',
                      background: color,
                      borderRadius: '2px',
                      transition: 'all 0.3s',
                      boxShadow: isOperational && dni > 500 ? '0 0 4px rgba(255,136,0,0.6)' : 'none'
                    }}
                  />
                );
              })}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#8b95a5', textAlign: 'center' }}>
              {CONSTANTS.HELIOSTAT_COUNT} Heliostat Mirrors ({(CONSTANTS.HELIOSTAT_COUNT * CONSTANTS.HELIOSTAT_AREA / 10000).toFixed(1)} hectares)
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <StatBox label="Operational" value={heliostats.operational} color="#4ade80" />
            <StatBox label="Maintenance" value={heliostats.maintenance} color="#fbbf24" />
            <StatBox label="Needs Cleaning" value={heliostats.cleaning_needed} color="#fb923c" />
            <StatBox label="Faulty" value={heliostats.faulty} color="#ef4444" />
          </div>
          
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#8b95a5', marginBottom: '0.5rem' }}>
              Field Efficiency: {((heliostats.operational / CONSTANTS.HELIOSTAT_COUNT) * 100).toFixed(1)}%
            </div>
            <div style={{
              height: '8px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${(heliostats.operational / CONSTANTS.HELIOSTAT_COUNT) * 100}%`,
                background: 'linear-gradient(90deg, #ff8800, #ffb347)',
                transition: 'width 0.5s'
              }} />
            </div>
          </div>
        </div>
        
        {/* Thermal system */}
        <div style={{
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <h3 style={{ 
            margin: '0 0 1.5rem 0', 
            fontSize: '1.2rem', 
            color: '#00b4ff',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Droplet size={20} />
            Thermal Transfer System
          </h3>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#8b95a5', marginBottom: '0.5rem' }}>
              Hot Tank (Solar Salt)
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              padding: '1rem',
              border: `2px solid ${saltHotTemp > 500 ? 'rgba(239,68,68,0.5)' : 'rgba(255,136,0,0.3)'}`,
              position: 'relative',
              height: '120px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '70%',
                background: `linear-gradient(180deg, 
                  rgba(255,136,0,0.3) 0%, 
                  rgba(255,136,0,0.6) 50%, 
                  rgba(255,68,0,0.8) 100%)`,
                borderRadius: '0 0 6px 6px',
                animation: 'liquidWave 3s ease-in-out infinite'
              }} />
              <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#ff8800' }}>
                  {saltHotTemp.toFixed(0)}°C
                </div>
                <div style={{ fontSize: '0.75rem', color: '#8b95a5' }}>
                  Max: {CONSTANTS.SALT_TEMP_HOT}°C
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#8b95a5', marginBottom: '0.5rem' }}>
              Cold Tank
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              padding: '1rem',
              border: '2px solid rgba(59,130,246,0.3)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>
                {saltColdTemp.toFixed(0)}°C
              </div>
              <div style={{ fontSize: '0.75rem', color: '#8b95a5' }}>
                Crystallization: {CONSTANTS.SALT_TEMP_COLD}°C
              </div>
            </div>
          </div>
          
          <div style={{
            background: 'rgba(0,180,255,0.1)',
            border: '1px solid rgba(0,180,255,0.3)',
            borderRadius: '8px',
            padding: '1rem'
          }}>
            <div style={{ fontSize: '0.85rem', color: '#8b95a5', marginBottom: '0.5rem' }}>
              Heat Transfer Rate
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#00b4ff' }}>
              {((saltHotTemp - saltColdTemp) * CONSTANTS.SALT_HEAT_CAPACITY * 10).toFixed(1)} kW
            </div>
          </div>
        </div>
        
        {/* Reactor */}
        <div style={{
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <h3 style={{ 
            margin: '0 0 1.5rem 0', 
            fontSize: '1.2rem', 
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Activity size={20} />
            Pyrolysis Reactor
          </h3>
          
          {/* Plastic type indicator */}
          <div style={{
            background: `${plasticData.color}20`,
            border: `2px solid ${plasticData.color}50`,
            borderRadius: '8px',
            padding: '0.75rem',
            marginBottom: '1rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.85rem', color: plasticData.color, fontWeight: 600 }}>
              {selectedPlastic} - {plasticData.name}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#8b95a5', marginTop: '0.25rem' }}>
              H₂: {plasticData.h2_yield} mmol/g | Optimal: {plasticData.optimal_temp}°C
            </div>
          </div>
          
          <div style={{
            background: pyrolysisActive ? 'rgba(16,185,129,0.1)' : 'rgba(251,191,36,0.1)',
            border: `2px solid ${pyrolysisActive ? 'rgba(16,185,129,0.3)' : 'rgba(251,191,36,0.3)'}`,
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '0.9rem', 
              color: pyrolysisActive ? '#10b981' : '#fbbf24',
              fontWeight: 600,
              marginBottom: '0.5rem'
            }}>
              {pyrolysisActive ? '✓ PROCESS ACTIVE' : '⏸ HEATING'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#8b95a5' }}>
              Reactor: {reactorTemp.toFixed(0)}°C / {plasticData.optimal_temp}°C
            </div>
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#8b95a5', marginBottom: '0.5rem' }}>
              Plastic Processing Rate
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              padding: '1rem',
              border: '1px solid rgba(16,185,129,0.3)'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
                {pyrolysisActive ? 
                  ((thermalPower * 1000) / (CONSTANTS.PYROLYSIS_ENERGY / 3600)).toFixed(1) : 
                  '0.0'
                } kg/h
              </div>
              <div style={{ fontSize: '0.75rem', color: '#8b95a5', marginTop: '0.25rem' }}>
                Capacity: {CONSTANTS.REACTOR_CAPACITY} kg/h
              </div>
            </div>
          </div>
          
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '8px',
            padding: '0.75rem',
            marginBottom: '0.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '0.85rem', color: '#8b95a5' }}>Total Processed:</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#e0e6ed' }}>
              {production.totalPlasticProcessed.toFixed(1)} kg
            </span>
          </div>
        </div>
      </div>
      
      {/* Product tanks */}
      <div style={{
        marginTop: '1.5rem',
        background: 'rgba(15,23,42,0.6)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        position: 'relative',
        zIndex: 1
      }}>
        <h3 style={{ 
          margin: '0 0 1.5rem 0', 
          fontSize: '1.2rem', 
          color: '#c084fc',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Battery size={20} />
          Product Collection Tanks
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <ProductTank
            name="Hydrogen (H₂)"
            amount={production.hydrogen}
            unit="kg"
            capacity={100}
            color="#10b981"
            level={h2TankLevel}
          />
          
          <ProductTank
            name="Solid Carbon"
            amount={production.carbon}
            unit="kg"
            capacity={500}
            color="#64748b"
            level={carbonTankLevel}
          />
          
          <ProductTank
            name="Wax/Oil"
            amount={production.wax}
            unit="kg"
            capacity={200}
            color="#f59e0b"
            level={Math.min((production.wax / 200) * 100, 100)}
          />
          
          <ProductTank
            name="By-products"
            amount={production.waste}
            unit="kg"
            capacity={100}
            color="#6b7280"
            level={Math.min((production.waste / 100) * 100, 100)}
          />
        </div>
      </div>
      
      {/* Daily report */}
      <div style={{
        marginTop: '1.5rem',
        background: 'rgba(15,23,42,0.6)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        position: 'relative',
        zIndex: 1
      }}>
        <h3 style={{ 
          margin: '0 0 1.5rem 0', 
          fontSize: '1.2rem', 
          color: '#fbbf24',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <TrendingUp size={20} />
          Daily Performance Report
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
          <DailyMetric 
            label="Energy Collected" 
            value={dailyStats.energyCollected.toFixed(2)} 
            unit="MWh" 
            color="#ff8800"
          />
          <DailyMetric 
            label="Plastic Processed" 
            value={dailyStats.plasticProcessed.toFixed(1)} 
            unit="kg" 
            color="#00b4ff"
          />
          <DailyMetric 
            label="Hydrogen Produced" 
            value={dailyStats.hydrogenProduced.toFixed(2)} 
            unit="kg" 
            color="#10b981"
          />
          <DailyMetric 
            label="Carbon Produced" 
            value={dailyStats.carbonProduced.toFixed(1)} 
            unit="kg" 
            color="#64748b"
          />
          <DailyMetric 
            label="Heat Loss" 
            value={dailyStats.heatLoss.toFixed(3)} 
            unit="MWh" 
            color="#ef4444"
          />
        </div>
      </div>
      
      {/* Controls */}
      <div style={{
        marginTop: '1.5rem',
        display: 'flex',
        justifyContent: 'center',
        gap: '1rem',
        position: 'relative',
        zIndex: 1
      }}>
        <button
          onClick={() => setIsRunning(!isRunning)}
          style={{
            background: isRunning ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
            border: `2px solid ${isRunning ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.5)'}`,
            color: isRunning ? '#ef4444' : '#10b981',
            padding: '0.75rem 2rem',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
        >
          {isRunning ? 'STOP' : 'START'}
        </button>
        
        <button
          onClick={() => {
            setTime(0);
            setCurrentHour(6);
            setCurrentMinute(0);
            setReactorTemp(290);
            setSaltHotTemp(420);
            setSaltColdTemp(290);
            setCloudCover(0);
            setWindSpeed(0);
            setProduction({
              hydrogen: 0,
              carbon: 0,
              wax: 0,
              waste: 0,
              totalPlasticProcessed: 0
            });
            setDailyStats({
              energyCollected: 0,
              plasticProcessed: 0,
              hydrogenProduced: 0,
              carbonProduced: 0,
              heatLoss: 0
            });
          }}
          style={{
            background: 'rgba(59,130,246,0.2)',
            border: '2px solid rgba(59,130,246,0.5)',
            color: '#3b82f6',
            padding: '0.75rem 2rem',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
        >
          RESET
        </button>
      </div>
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&display=swap');
        
        @keyframes liquidWave {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        
        select:focus {
          outline: none;
          border-color: rgba(255,136,0,0.5);
        }
      `}</style>
    </div>
  );
};

// Helper components
const MetricCard = ({ icon, title, value, unit, color, subtitle }) => (
  <div style={{
    background: 'rgba(15,23,42,0.6)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '1.25rem',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
      <div style={{ color }}>{icon}</div>
      <div style={{ fontSize: '0.85rem', color: '#8b95a5', fontWeight: 600 }}>
        {title}
      </div>
    </div>
    <div style={{ fontSize: '2rem', fontWeight: 700, color, marginBottom: '0.25rem' }}>
      {value}
      <span style={{ fontSize: '1rem', marginLeft: '0.25rem', color: '#8b95a5' }}>{unit}</span>
    </div>
    {subtitle && (
      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
        {subtitle}
      </div>
    )}
  </div>
);

const StatBox = ({ label, value, color }) => (
  <div style={{
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '0.75rem',
    textAlign: 'center'
  }}>
    <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>
      {value}
    </div>
    <div style={{ fontSize: '0.75rem', color: '#8b95a5', marginTop: '0.25rem' }}>
      {label}
    </div>
  </div>
);

const ProductTank = ({ name, amount, unit, capacity, color, level }) => (
  <div style={{
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '1rem',
    position: 'relative',
    overflow: 'hidden'
  }}>
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: `${level}%`,
      background: `linear-gradient(180deg, ${color}20 0%, ${color}40 100%)`,
      transition: 'height 0.5s',
      borderRadius: '0 0 12px 12px'
    }} />
    
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ fontSize: '0.85rem', color: '#8b95a5', marginBottom: '0.5rem' }}>
        {name}
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color, marginBottom: '0.25rem' }}>
        {amount.toFixed(2)}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#8b95a5' }}>
        {unit} / {capacity} {unit}
      </div>
      <div style={{ fontSize: '0.75rem', color, marginTop: '0.5rem' }}>
        {level.toFixed(1)}% full
      </div>
      
      {level >= 95 && (
        <div style={{
          marginTop: '0.5rem',
          background: 'rgba(239,68,68,0.2)',
          border: '1px solid rgba(239,68,68,0.5)',
          borderRadius: '4px',
          padding: '0.25rem 0.5rem',
          fontSize: '0.7rem',
          color: '#ef4444',
          textAlign: 'center'
        }}>
          ⚠ ROLL-OUT REQUIRED
        </div>
      )}
    </div>
  </div>
);

const DailyMetric = ({ label, value, unit, color }) => (
  <div style={{
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '1rem',
    textAlign: 'center'
  }}>
    <div style={{ fontSize: '0.8rem', color: '#8b95a5', marginBottom: '0.5rem' }}>
      {label}
    </div>
    <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>
      {value}
    </div>
    <div style={{ fontSize: '0.75rem', color: '#8b95a5', marginTop: '0.25rem' }}>
      {unit}
    </div>
  </div>
);

export default CSPPyrolysisSimulation;

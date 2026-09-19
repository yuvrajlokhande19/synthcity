/**
 * ================================================================================
 * PROJECT SYNTHCITY: FRONTEND CONFIGURATION & WATERMARK-FREE MAP TILES (2026 STANDARD)
 * ================================================================================
 */

window.SYNTH_CONFIG = {
  // Local C2 Engine Backend Endpoint (Zero Firebase Dependency)
  API_BASE_URL: "http://localhost:8000",

  // CARTO & ESRI Watermark-Free Licensed Tile Layers (2026 Key Integrated)
  MAP_TILES: {
    voyager: "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_3nqq_1_a586e19e0c11eefc021be78b",
    osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    realistic: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    dark: "https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=cb1_3nqq_1_a586e19e0c11eefc021be78b",
    esri: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    subdomains: ['a', 'b', 'c', 'd'],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a> &copy; Esri'
  },

  // Nagpur Map Coordinates
  NAGPUR_COORDINATES: {
    lat: 21.1458,
    lng: 79.0882,
    zoom: 12
  },

  // Telegram Credentials Summary
  TELEGRAM: {
    WORKER_1_NAME: "U (Worker 1)",
    WORKER_2_NAME: "Ritesh Alone (Worker 2 Admin)",
    CITIZEN_Z2_NAME: "Dhynendra Gaurkar (Citizen Z2)"
  },

  // 3 Distinct Zone Boundaries & Visual Styling
  ZONES: {
    zone1: {
      id: "zone1",
      name: "Zone 1: Neer-Krishi",
      subtitle: "Kamptee Regional & Hydro-Agri Node",
      color: "#0284c7", // Cyan / Teal
      borderColor: "#0369a1",
      fillOpacity: 0.22,
      center: [21.2225, 79.1994],
      docUrl: "https://docs.google.com/document/d/11UXOyAbyGhIhegMV2bNhZy0SYJNiy0t4zuEl9QHnTt8/edit?usp=sharing",
      bounds: [
        [21.1850, 79.1400],
        [21.2600, 79.1400],
        [21.2600, 79.2600],
        [21.1850, 79.2600]
      ]
    },
    zone2: {
      id: "zone2",
      name: "Zone 2: Nagari-Tantra",
      subtitle: "Urban Core Logistics & Infrastructure Node",
      color: "#d97706", // Amber / Gold
      borderColor: "#b45309",
      fillOpacity: 0.22,
      center: [21.1458, 79.0882],
      docUrl: "https://docs.google.com/document/d/1fo2hnkz4z6FVvRXOviorWFdYwLkAru8YojvmTenBIFY/edit?usp=sharing",
      bounds: [
        [21.1150, 79.0400],
        [21.1850, 79.0400],
        [21.1850, 79.1400],
        [21.1150, 79.1400]
      ]
    },
    zone3: {
      id: "zone3",
      name: "Zone 3: Swasthya-Raksha",
      subtitle: "South-West & Industrial Health Node",
      color: "#7c3aed", // Purple
      borderColor: "#6d28d9",
      fillOpacity: 0.22,
      center: [21.0500, 79.0100],
      docUrl: "https://docs.google.com/document/d/1aE1sAMZj84afL4GTStQ6vTMMGrY8rpNfP-t_1TFAS6I/edit?usp=sharing",
      bounds: [
        [20.9000, 78.9200],
        [21.1150, 78.9200],
        [21.1150, 79.0800],
        [20.9000, 79.0800]
      ]
    }
  }
};

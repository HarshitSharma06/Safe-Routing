# SafeRoute AI – Disaster Evacuation Route Optimisation System

> **B.Tech Disaster Management Project**  
> AI-Powered Dynamic Evacuation Route Optimisation using the A\* Search Algorithm

---

## 📌 Project Overview

SafeRoute AI is an interactive web-based prototype that helps people find the **safest evacuation route** during disasters such as **floods**, **fires**, and **earthquakes**. It visualises a real Delhi road network on an interactive OpenStreetMap, applies real pathfinding intelligence using the **A\* algorithm**, and dynamically recalculates routes when roads are blocked or conditions change.

---

## 🗂️ Project Files

```
SafeRoute-AI/
├── index.html   – Main HTML structure and UI layout
├── style.css    – Complete styling (dark-blue + emergency-orange theme)
├── data.js      – REAL dataset: Delhi landmarks (lat/lng) + road corridors + hazard scores
├── script.js    – A* algorithm, Leaflet map logic, simulation
├── server.js    – Optional tiny static server (node server.js)
└── README.md    – This file
```

---

## ▶️ How to Run

1. Download or clone the project folder.
2. **Double-click** `index.html` to open it in any modern browser (Chrome, Firefox, Edge).
3. No server, no installation, no API keys required.
4. The map uses **Leaflet + OpenStreetMap tiles**, so an internet connection is needed for the map tiles and the real road shapes (OSRM routing). Without internet the A* logic still runs on straight-line roads.
5. Optional: run `node server.js` and open http://localhost:5500 if you prefer a local server.

---

## 🌆 Real Dataset – Delhi (data.js)

Nodes are real Delhi places (e.g. Connaught Place, ITO, Rajghat, Kashmere Gate) and shelters (Jawaharlal Nehru Stadium, DU North Campus, Delhi Ridge). Road shape and distance come from OpenStreetMap routing (OSRM) at runtime and are cached in the browser. Hazard scores (danger 1-10, risk type) are an educational estimate based on proximity to the Yamuna floodplain, not official NDMA/DDMA data. To use another city, edit `data.js` only.

## 🌆 Original node table (names below are the old fictional labels; ids A-F, I1-I4, S1-S3 are unchanged)

The application uses a **simulated city** with the following nodes:

| Node ID | Location Name         | Type        |
|---------|-----------------------|-------------|
| A       | Downtown Market       | Start zone  |
| B       | Riverside Colony      | Start zone (flood-prone) |
| C       | North Hills           | Start zone (elevated) |
| D       | East Junction         | Start zone  |
| E       | West Suburb           | Start zone  |
| F       | Central Park Area     | Start zone  |
| I1–I4   | Road Intersections    | Junctions   |
| **S1**  | City Emergency Shelter| **Shelter** |
| **S2**  | North Relief Camp     | **Shelter** |
| **S3**  | Hilltop Safe Zone     | **Shelter** |

The network has **20 road segments** with varying distances (0.6–1.5 km) and base danger scores (1–10).

---

## 🧠 A\* Algorithm Explained

A\* (pronounced "A-Star") is an **intelligent graph search algorithm** used in GPS navigation, robotics, and games to find the optimal path between two points.

### How It Works (Step by Step)

```
Start → [Open Set] → Expand lowest f(n) → Check neighbours → Reach Goal
```

1. **Initialise** – Place the starting node in the *Open Set* with `f = 0`.
2. **Select** – Pick the node with the **lowest `f` value** from the Open Set.
3. **Goal check** – If the selected node is the destination, **reconstruct and return the path**.
4. **Expand** – For each neighbouring road segment:
   - Calculate `g(neighbour) = g(current) + edge_cost`
   - Calculate `f(neighbour) = g(neighbour) + h(neighbour, goal)`
   - Add to Open Set if this path is better than any previously known path.
5. **Repeat** until the goal is found or the Open Set is empty (no path exists).

### Cost Formula

```
f(n) = g(n) + h(n)
```

| Term | Meaning | Details |
|------|---------|---------|
| `g(n)` | Cost from start to node *n* | Travel distance + danger penalty |
| `h(n)` | Estimated cost from *n* to goal | Straight-line (Euclidean) distance |
| Danger Penalty | Risk multiplier | `base_danger × disaster_multiplier × (danger_level / 5)` |
| **Edge cost** | Total road cost | `distance + danger_penalty × 2.0` |

### Disaster Multipliers

| Road Risk Type | Flood | Fire | Earthquake |
|----------------|-------|------|------------|
| Flood roads    | ×3.5  | ×1.0 | ×1.2 |
| Fire roads     | ×1.0  | ×3.5 | ×1.0 |
| Earthquake roads | ×1.0 | ×1.0 | ×3.5 |
| All-risk roads | ×2.0  | ×2.0 | ×2.5 |
| None           | ×1.0  | ×1.0 | ×1.0 |

**Blocked roads** receive infinite cost and are **completely excluded** from route selection.

---

## 🎨 Map Colour Guide

| Colour | Meaning |
|--------|---------|
| 🟢 Green | Safe road (low danger) |
| 🟡 Orange/Amber | Moderate danger road |
| 🔴 Red | Blocked or highly dangerous road |
| 🔵 Blue | Recommended evacuation route |
| 🟠 Orange dot | Starting location |
| 🟢 Green circle | Safe shelter |

---

## 🕹️ Feature Guide

### Controls
| Control | What It Does |
|---------|-------------|
| **Disaster Type** | Changes which roads become more dangerous |
| **Danger Level Slider** | Amplifies all danger scores (1=low, 10=extreme) |
| **Starting Location** | Sets evacuation origin (6 locations available) |
| **Target Shelter** | Sets evacuation destination (3 shelters) |
| **Find Safest Route** | Runs A\* and draws the optimal blue route |
| **Simulate Road Blockage** | Randomly blocks a road and recalculates route |
| **Run Demo Scenario** | Automated flood simulation with step-by-step changes |
| **Reset Simulation** | Clears all blocks and resets to default state |
| **Click any road on map** | Opens a popup to manually block/unblock that road |

---

## 🎬 Demonstration Sequence (For Your Teacher)

Use this sequence to present the project clearly:

### Step 1 – Introduction
> "This is SafeRoute AI. It uses the A\* pathfinding algorithm to find the safest evacuation route during disasters. The map shows our fictional city with 20 roads connecting 13 locations."

### Step 2 – Normal Route
> "First I'll select Downtown Market as the start and City Emergency Shelter as the destination, then click 'Find Safest Route'."
- Select: Start = **Downtown Market (A)**, Destination = **City Emergency Shelter (S1)**
- Click: **Find Safest Route**
- Show: The blue route appears. Point out the green roads it uses.

### Step 3 – Disaster Simulation
> "Now let's simulate a flood. You can see the road colours change — flood-prone roads near the river turn red or orange."
- Change: Disaster Type = **Flood**
- Move slider to: Danger Level = **8**
- Show: Roads near Riverside Colony turn orange/red.

### Step 4 – Road Blockage
> "During a flood, riverside roads get blocked. I'll click this road to block it."
- Click on: **Low Bridge Road (R4)** on the map → click **Block This Road**
- Also block: **Shelter Route 1 (R14)**
- Show: The route immediately recalculates to avoid flooded areas.

### Step 5 – No Route Scenario
> "If we block too many roads, the algorithm will warn us that no safe route exists."
- Click: **Simulate Road Blockage** several times to block most S1 routes
- Show: The red warning panel appears.

### Step 6 – Alternative Shelter
> "In that case, we select a different shelter."
- Change: Destination = **North Relief Camp (S2)**
- Click: **Find Safest Route**
- Show: A new blue route appears going north through safer roads.

### Step 7 – One-Click Demo
> "Finally, let me show you the automated demo that runs all these steps at once."
- Click: **Reset Simulation**
- Click: **Run Demo Scenario**
- Show: Watch the automated flood scenario unfold step by step.

---

## ⚠️ Limitations of This Prototype

1. **Real map, estimated hazards** – Locations, roads and distances are real (OpenStreetMap), but danger scores are estimates and there is no live disaster or traffic data.
2. **No machine learning** – The "AI" is algorithmic (A\* search), not a trained ML model. This is accurate terminology.
3. **No real-time updates** – Road conditions are set manually or via the demo; there is no live sensor integration.
4. **Static heuristic** – The heuristic uses simple straight-line distance. In a real system, it would use actual road geometry and real-time sensor data.
5. **No backend** – All processing happens client-side in the browser; the only external calls are map tiles and the public OSRM routing server.
6. **Not for actual emergencies** – This is a student prototype for educational purposes only.

---

## 🛠️ Technologies Used

| Technology | Purpose |
|-----------|---------|
| HTML5 | Structure and semantic markup |
| CSS3 | Responsive styling, animations, glassmorphism effects |
| JavaScript (ES6+) | A\* algorithm, graph logic, event handling |
| Leaflet + OpenStreetMap | Real interactive map |
| OSRM (public demo server) | Real road geometry and distances |
| Google Fonts (Inter, JetBrains Mono) | Typography |

---

## 👨‍💻 Code Structure

```
script.js
├── Section 1  – CITY NODE DEFINITIONS (13 nodes with lat/lng)
├── Section 2  – ROAD EDGE DEFINITIONS (20 edges with distance/danger)
├── Section 3  – DISASTER DANGER MULTIPLIERS
├── Section 4  – APPLICATION STATE (central state object)
├── Section 5  – GRAPH BUILDER (adjacency list)
├── Section 6  – A* PATHFINDING ALGORITHM
├── Section 7  – SVG MAP INITIALISATION + POPUPS
├── Section 8  – MAP DRAWING FUNCTIONS
├── Section 9  – ROUTE FINDING & UI UPDATE
├── Section 10 – ROAD BLOCK SIMULATION
├── Section 11 – RESET
├── Section 12 – DEMO SCENARIO
└── Section 13 – UI HELPERS & EVENT LISTENERS
```

---

## 📚 References

- A\* Search Algorithm – Hart, Nilsson & Raphael (1968)
- NDMA India – National Disaster Management Authority guidelines

---

*SafeRoute AI – Built for educational purposes as a B.Tech Disaster Management project.*

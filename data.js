/**
 * SafeRoute AI – data.js  (real-world dataset: Delhi, India)
 * Loaded as a plain script so the project also works from file:// (no fetch of JSON needed).
 *
 * nodes : real Delhi landmarks / junctions / candidate shelters with lat-lng
 *         (coordinates are approximate, within a few hundred metres).
 * roads : real road corridors between those places. Road SHAPE and DISTANCE are
 *         fetched live from OpenStreetMap routing (OSRM) in script.js; if offline,
 *         a straight line and 1.3 x straight-line distance are used.
 * hazard: danger (1-10) + risk type is a qualitative score based on proximity to the
 *         Yamuna floodplain (e.g. the July 2023 flood hit Yamuna Bazaar, Rajghat, ITO),
 *         dense old-city fire risk and bridges/flyovers. It is an educational estimate,
 *         NOT official NDMA/DDMA data – replace with official data for real use.
 */
window.CITY_DATA = {
  meta: { city: 'Delhi, India', center: [28.635, 77.225], zoom: 12 },
  nodes: {
    A:  { id: 'A',  name: 'Connaught Place',            lat: 28.6315, lng: 77.2167, type: 'start' },
    B:  { id: 'B',  name: 'Yamuna Bazaar (Riverside)',   lat: 28.6625, lng: 77.2385, type: 'start' },
    C:  { id: 'C',  name: 'Kashmere Gate ISBT',          lat: 28.6675, lng: 77.2284, type: 'start' },
    D:  { id: 'D',  name: 'Laxmi Nagar (East Delhi)',    lat: 28.6304, lng: 77.2773, type: 'start' },
    E:  { id: 'E',  name: 'Karol Bagh',                  lat: 28.6519, lng: 77.1905, type: 'start' },
    F:  { id: 'F',  name: 'India Gate',                  lat: 28.6129, lng: 77.2295, type: 'start' },
    I1: { id: 'I1', name: 'ITO Junction',                lat: 28.6289, lng: 77.2406, type: 'junction' },
    I2: { id: 'I2', name: 'Rajghat',                     lat: 28.6414, lng: 77.2490, type: 'junction' },
    I3: { id: 'I3', name: 'Old Delhi Railway Station',   lat: 28.6612, lng: 77.2278, type: 'junction' },
    I4: { id: 'I4', name: 'Patel Chowk',                 lat: 28.6228, lng: 77.2139, type: 'junction' },
    S1: { id: 'S1', name: 'Jawaharlal Nehru Stadium',    lat: 28.5829, lng: 77.2336, type: 'shelter' },
    S2: { id: 'S2', name: 'Delhi University North Campus', lat: 28.6879, lng: 77.2110, type: 'shelter' },
    S3: { id: 'S3', name: 'Delhi Ridge (Hindu Rao)',     lat: 28.6765, lng: 77.2090, type: 'shelter' },
  },
  roads: [
    { id: 'R1',  from: 'A',  to: 'I1', danger: 2, risk: 'none',       label: 'Tilak Marg' },
    { id: 'R2',  from: 'A',  to: 'F',  danger: 3, risk: 'fire',       label: 'Janpath / Rajpath' },
    { id: 'R3',  from: 'B',  to: 'I2', danger: 8, risk: 'flood',      label: 'Ring Road (Yamuna bank)' },
    { id: 'R4',  from: 'B',  to: 'I1', danger: 6, risk: 'flood',      label: 'Ring Road – ITO link' },
    { id: 'R5',  from: 'C',  to: 'I3', danger: 1, risk: 'none',       label: 'Lothian Road' },
    { id: 'R6',  from: 'C',  to: 'S3', danger: 2, risk: 'earthquake', label: 'Ridge Road' },
    { id: 'R7',  from: 'D',  to: 'I2', danger: 4, risk: 'earthquake', label: 'Vikas Marg – Yamuna bridge' },
    { id: 'R8',  from: 'D',  to: 'I1', danger: 3, risk: 'none',       label: 'Vikas Marg – ITO' },
    { id: 'R9',  from: 'E',  to: 'I4', danger: 2, risk: 'none',       label: 'Rani Jhansi / Panchkuian Rd' },
    { id: 'R10', from: 'E',  to: 'F',  danger: 3, risk: 'fire',       label: 'Rajendra Prasad Rd' },
    { id: 'R11', from: 'F',  to: 'I1', danger: 2, risk: 'none',       label: 'Bhagwan Das Rd / Mathura Rd' },
    { id: 'R12', from: 'F',  to: 'I3', danger: 3, risk: 'none',       label: 'Netaji Subhash Marg' },
    { id: 'R13', from: 'I1', to: 'I2', danger: 5, risk: 'flood',      label: 'Bahadur Shah Zafar Marg' },
    { id: 'R14', from: 'I1', to: 'S1', danger: 2, risk: 'none',       label: 'Mathura Road' },
    { id: 'R15', from: 'I2', to: 'S1', danger: 7, risk: 'flood',      label: 'Ring Road (Yamuna floodplain)' },
    { id: 'R16', from: 'I3', to: 'S2', danger: 1, risk: 'none',       label: 'GT Road / Mall Road' },
    { id: 'R17', from: 'I3', to: 'S3', danger: 3, risk: 'earthquake', label: 'Sabzi Mandi – Ridge Road' },
    { id: 'R18', from: 'I4', to: 'S1', danger: 2, risk: 'none',       label: 'Lodhi Road / Aurobindo Marg' },
    { id: 'R19', from: 'I4', to: 'I1', danger: 3, risk: 'fire',       label: 'Barakhamba / Bahadur Shah Zafar' },
    { id: 'R20', from: 'S2', to: 'C',  danger: 1, risk: 'none',       label: 'Chhatra Marg / Ring Road North' },
  ],
};

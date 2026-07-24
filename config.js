// ============================================================
// Rockford Historic Industrial Property Survey Map — config
// ============================================================

const CONFIG = {
  // Mapbox public access token (pk...). Free tier: 50,000 map loads/month.
  MAPBOX_TOKEN: "pk.eyJ1IjoibWljaGFlbC1zbWl0aCIsImEiOiJjbXJ5NTExMWkwNWlrMzFwcWtvdTRqZHVkIn0.ICZG_Gxqk4tqm9VByqLyZg",

  // Mapbox style: "Light" keeps the basemap muted/gray so the brand-green
  // TIF/OZ/RERZ overlays and parcel symbology stay legible on top of it.
  MAPBOX_STYLE: "mapbox://styles/mapbox/light-v11",

  // Initial map view — centered on Rockford, IL industrial corridor
  INITIAL_CENTER: [-89.0940, 42.2650],
  INITIAL_ZOOM: 12.4,

  // Data files (already reprojected to WGS84 / EPSG:4326)
  DATA: {
    parcels: "data/parcels.geojson",
    centroids: "data/parcel_centroids.geojson",
    footprints: "data/footprints.geojson",
    tif: "data/tif.geojson",
    oz: "data/oz.geojson",
    rerz: "data/rerz.geojson",
  },

  // Base URL used to build shareable per-property links (?p=slug)
  SHARE_BASE_URL: window.location.origin + window.location.pathname,
};

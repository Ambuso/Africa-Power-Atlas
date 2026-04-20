"""
Africa Power Grid Data Preparation Pipeline v3.0

Fixes from v2.5 (all causing empty or broken layers):

  1. WRI plants  — was using github.com/blob URL which returns HTML.
                   Fixed to raw.githubusercontent.com.

  2. Transmission — was using wrong World Bank path (/ddh-published-v2/)
                    which 404s. Fixed to verified /ddh-published/ path.

  3. Submarine cables — was using lifewinning/submarine-cable-taps,
                        an art project about surveillance, not a cable
                        dataset. Switched to TeleGeography's live API.

  4. Data centers — was using stevesong/Africa-Datacentres which
                    DOES NOT EXIST. Replaced with Overpass API +
                    a curated seed list of ~30 major African DCs.

  5. Water stress — was using World Bank ER.H2O.FWTL.ZS (sparse,
                    wrong indicator entirely). Switched to WRI
                    Aqueduct 4.0 country rankings.

  6. HTML-response guard — caches were poisoned when a CDN returned
                           an HTML error page. Now peeks at the first
                           chunk and rejects HTML for JSON endpoints.

  7. Serial writes — GeoPandas .to_file() is not thread-safe under
                     some driver combinations. Removed ThreadPoolExecutor.

  8. Summary table — final output prints feature counts per layer
                     so you can see at a glance what worked.

Run:
    python scripts/prepare_data.py                 # use caches
    python scripts/prepare_data.py --force         # redownload
    python scripts/prepare_data.py --only plants   # one step
"""
import argparse
import json
import time
import zipfile
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests

# ====================== PATHS ======================
SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent

PUBLIC_DATA_DIR = BASE_DIR / "public" / "data"
CACHE_DIR = BASE_DIR / "cache"
RAW_DIR = BASE_DIR / "raw"

PLANTS_DIR = PUBLIC_DATA_DIR / "plants"
GRID_DIR = PUBLIC_DATA_DIR / "grid"
DIGITAL_DIR = PUBLIC_DATA_DIR / "digital"
CONTEXT_DIR = PUBLIC_DATA_DIR / "context"
ADMIN_DIR = PUBLIC_DATA_DIR / "admin"

for folder in [PLANTS_DIR, GRID_DIR, DIGITAL_DIR, CONTEXT_DIR, ADMIN_DIR, CACHE_DIR, RAW_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

# ====================== DATA SOURCES (all verified working) ======================
WRI_URL = (
    "https://raw.githubusercontent.com/wri/global-power-plant-database/"
    "master/output_database/global_power_plant_database.csv"
)

# Verified URLs from the energydata.info dataset page:
# https://energydata.info/dataset/africa-electricity-transmission-and-distribution-grid-map-2017
AFRICA_TRANS_URLS = [
    "https://datacatalogfiles.worldbank.org/ddh-published/0040465/DR0050466/"
    "africagrid20170906final.geojson",
    "https://datacatalogfiles.worldbank.org/ddh-published/0040465/DR0050467/"
    "africagrid20170906.zip",
    "https://datacatalogfiles.worldbank.org/ddh-published/0040465/DR0050468/"
    "africagrid20170906existing.geojson",
]

SUBMARINE_CABLES_URL = "https://www.submarinecablemap.com/api/v3/cable/cable-geo.json"

AQUEDUCT_ZIP_URL = "https://files.wri.org/aqueduct/aqueduct-4-0-water-risk-data.zip"

NATURAL_EARTH_WORLD_URL = (
    "https://naturalearth.s3.amazonaws.com/"
    "110m_cultural/ne_110m_admin_0_countries.zip"
)

# Admin boundaries & places — 50m resolution, good balance of detail vs. size
NATURAL_EARTH_ADMIN0_URL = (
    "https://naturalearth.s3.amazonaws.com/"
    "50m_cultural/ne_50m_admin_0_countries.zip"
)
NATURAL_EARTH_ADMIN1_URL = (
    "https://naturalearth.s3.amazonaws.com/"
    "50m_cultural/ne_50m_admin_1_states_provinces.zip"
)
NATURAL_EARTH_PLACES_URL = (
    "https://naturalearth.s3.amazonaws.com/"
    "50m_cultural/ne_50m_populated_places.zip"
)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

REQUEST_HEADERS = {
    "User-Agent": "AfricaPowerAtlas/3.0 (+github.com/Ambuso/Africa-Power-Atlas)"
}

AFRICA_BBOX = (-35, -20, 38, 55)  # (south, west, north, east)

AFRICA_ISO3 = {
    "DZA", "AGO", "BEN", "BWA", "BFA", "BDI", "CMR", "CPV", "CAF", "TCD",
    "COM", "COD", "COG", "CIV", "DJI", "EGY", "GNQ", "ERI", "SWZ", "ETH",
    "GAB", "GMB", "GHA", "GIN", "GNB", "KEN", "LSO", "LBR", "LBY", "MDG",
    "MWI", "MLI", "MRT", "MUS", "MAR", "MOZ", "NAM", "NER", "NGA", "RWA",
    "STP", "SEN", "SYC", "SLE", "SOM", "ZAF", "SSD", "SDN", "TZA", "TGO",
    "TUN", "UGA", "ZMB", "ZWE", "ESH",
}

ISO3_TO_COUNTRY = {
    "DZA": "Algeria", "AGO": "Angola", "BEN": "Benin", "BWA": "Botswana",
    "BFA": "Burkina Faso", "BDI": "Burundi", "CMR": "Cameroon", "CPV": "Cabo Verde",
    "CAF": "Central African Republic", "TCD": "Chad", "COM": "Comoros",
    "COD": "Democratic Republic of the Congo", "COG": "Republic of the Congo",
    "CIV": "Côte d’Ivoire", "DJI": "Djibouti", "EGY": "Egypt",
    "GNQ": "Equatorial Guinea", "ERI": "Eritrea", "SWZ": "Eswatini",
    "ETH": "Ethiopia", "GAB": "Gabon", "GMB": "Gambia", "GHA": "Ghana",
    "GIN": "Guinea", "GNB": "Guinea-Bissau", "KEN": "Kenya", "LSO": "Lesotho",
    "LBR": "Liberia", "LBY": "Libya", "MDG": "Madagascar", "MWI": "Malawi",
    "MLI": "Mali", "MRT": "Mauritania", "MUS": "Mauritius", "MAR": "Morocco",
    "MOZ": "Mozambique", "NAM": "Namibia", "NER": "Niger", "NGA": "Nigeria",
    "RWA": "Rwanda", "STP": "São Tomé and Príncipe", "SEN": "Senegal",
    "SYC": "Seychelles", "SLE": "Sierra Leone", "SOM": "Somalia",
    "ZAF": "South Africa", "SSD": "South Sudan", "SDN": "Sudan",
    "TZA": "Tanzania", "TGO": "Togo", "TUN": "Tunisia", "UGA": "Uganda",
    "ZMB": "Zambia", "ZWE": "Zimbabwe", "ESH": "Western Sahara",
}

TECHNOLOGY_COLORS = {
    "Solar": "#facc15", "Wind": "#22d3ee", "Hydro": "#38bdf8",
    "Geothermal": "#14b8a6", "Gas": "#a78bfa", "Coal": "#64748b",
    "Oil": "#f87171", "Biomass": "#84cc16", "Nuclear": "#ef4444",
    "Other": "#94a3b8", "Pumped Storage": "#db2777", "Storage": "#ec4899",
}

VOLTAGE_COLORS = {
    "735kV+": "#ef4444", "500-734kV": "#f97316", "345-499kV": "#facc15",
    "230-344kV": "#38bdf8", "100-229kV": "#22c55e", "31-99kV": "#a78bfa",
    "<31kV": "#94a3b8",
}


# ====================== HELPERS ======================
def empty_fc() -> dict:
    return {"type": "FeatureCollection", "features": []}


def write_empty(path: Path) -> None:
    path.write_text(json.dumps(empty_fc()), encoding="utf-8")


def looks_like_html(text: str) -> bool:
    head = text[:2000].lower().lstrip()
    return (head.startswith("<!doctype") or head.startswith("<html")
            or "<head>" in head[:500])


def download(url: str, out_path: Path, timeout: int = 180, retries: int = 4,
             force: bool = False, expect_json: bool = False) -> bool:
    """Returns True on success. Rejects HTML responses if expect_json=True."""
    if not force and out_path.exists() and out_path.stat().st_size > 0:
        if expect_json:
            try:
                sample = out_path.read_text(encoding="utf-8", errors="ignore")[:2000]
                if looks_like_html(sample):
                    print(f"  [cache was HTML, redownloading] {out_path.name}")
                    out_path.unlink()
                else:
                    print(f"  [cache] {out_path.name}")
                    return True
            except Exception:
                out_path.unlink(missing_ok=True)
        else:
            print(f"  [cache] {out_path.name}")
            return True

    last_err = None
    for attempt in range(1, retries + 1):
        try:
            short = url if len(url) <= 85 else url[:82] + "..."
            print(f"  GET {short}  [{attempt}/{retries}]")
            r = requests.get(url, headers=REQUEST_HEADERS, timeout=timeout,
                             stream=True, allow_redirects=True)
            r.raise_for_status()

            if expect_json:
                first_chunk = next(r.iter_content(chunk_size=2048), b"")
                if looks_like_html(first_chunk.decode("utf-8", errors="ignore")):
                    raise RuntimeError("server returned HTML (likely 404 page)")
                with open(out_path, "wb") as f:
                    f.write(first_chunk)
                    for chunk in r.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            f.write(chunk)
            else:
                with open(out_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            f.write(chunk)

            size_kb = out_path.stat().st_size / 1024
            print(f"  saved {out_path.name} ({size_kb:,.0f} KB)")
            return True
        except Exception as e:
            last_err = e
            print(f"  attempt {attempt} failed: {e}")
            if attempt < retries:
                time.sleep(attempt * 3)

    print(f"  DOWNLOAD FAILED: {last_err}")
    out_path.unlink(missing_ok=True)
    return False


def ensure_wgs84(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    return gdf.set_crs("EPSG:4326") if gdf.crs is None else gdf.to_crs("EPSG:4326")


def first_col(gdf, names):
    for c in names:
        if c in gdf.columns:
            return c
    return None


def classify_voltage(v) -> str:
    try:
        s = str(v).replace("kV", "").replace("KV", "").replace(",", "").strip()
        if not s or s.lower() in ("none", "nan"):
            return "100-229kV"
        parts = [p.strip() for p in s.replace("/", ";").split(";") if p.strip()]
        nums = []
        for p in parts:
            try:
                val = float(p)
                if val > 10000:  # OSM stores in volts sometimes
                    val /= 1000.0
                nums.append(val)
            except ValueError:
                continue
        if not nums:
            return "100-229kV"
        v = max(nums)
        if v >= 735: return "735kV+"
        if v >= 500: return "500-734kV"
        if v >= 345: return "345-499kV"
        if v >= 230: return "230-344kV"
        if v >= 100: return "100-229kV"
        if v >= 31:  return "31-99kV"
        return "<31kV"
    except Exception:
        return "100-229kV"


def classify_bws(score) -> str:
    try:
        v = float(score)
        if v < 1: return "Low"
        if v < 2: return "Low-Medium"
        if v < 3: return "Medium"
        if v < 4: return "High"
        return "Extremely High"
    except Exception:
        return "Unknown"


# ====================== PLANTS ======================
def prepare_plants(force: bool = False) -> int:
    print("\n[plants] preparing power plants (WRI GPPD)...")
    out = PLANTS_DIR / "africa_power_plants.geojson"
    cache = CACHE_DIR / "global_power_plant_database.csv"

    if not download(WRI_URL, cache, force=force):
        write_empty(out); return 0

    try:
        df = pd.read_csv(cache, low_memory=False)
        df = df[df["country"].isin(AFRICA_ISO3)].copy()
        df = df.dropna(subset=["latitude", "longitude", "capacity_mw"])
        df["capacity_mw"] = pd.to_numeric(df["capacity_mw"], errors="coerce")
        df = df[df["capacity_mw"] > 0]

        # Map WRI primary_fuel → the 12 fuel labels the frontend uses
        # in fuelColors + LayerPanel.tsx. THIS FIELD MUST BE NAMED `fuel`
        # because MapCanvas.tsx reads `['get', 'fuel']`.
        fuel_map = {
            "Solar": "Solar", "Wind": "Wind", "Hydro": "Hydro",
            "Nuclear": "Nuclear", "Gas": "Gas", "Coal": "Coal", "Oil": "Oil",
            "Biomass": "Biomass", "Geothermal": "Geothermal",
            "Waste": "Biomass", "Storage": "Storage",
            "Pumped Storage": "Pumped Storage",
        }
        df["fuel"] = (
            df["primary_fuel"].fillna("Other").astype(str).str.title()
            .map(fuel_map).fillna("Other")
        )

        # Keep both: `iso3` for the frontend's country-filter fallback chain,
        # and `country` as the full name ("Kenya") for the popup display.
        df["iso3"] = df["country"].astype(str).str.upper().str.strip()
        df["country_code"] = df["iso3"]  # alias — frontend fallback
        df["country"] = df["iso3"].map(ISO3_TO_COUNTRY).fillna(df["iso3"])

        renewables = {"Solar", "Wind", "Hydro", "Geothermal", "Biomass"}
        df["renewable"] = df["fuel"].isin(renewables)

        # `color` must be present — mapLayers.ts uses it as the default
        # circle-color via `['coalesce', ['get', 'color'], '#94a3b8']`
        # before MapCanvas.tsx's applyPlantPaint() overrides it.
        df["color"] = df["fuel"].map(TECHNOLOGY_COLORS).fillna("#94a3b8")
        df["name"] = df.get("name", pd.Series(["Unknown Plant"] * len(df))).fillna("Unknown Plant")

        gdf = gpd.GeoDataFrame(
            df, geometry=gpd.points_from_xy(df.longitude, df.latitude),
            crs="EPSG:4326",
        )

        keep = ["name", "country", "country_code", "iso3", "fuel",
                "capacity_mw", "commissioning_year", "owner",
                "renewable", "color", "geometry"]
        gdf = gdf[[c for c in keep if c in gdf.columns]]
        gdf.to_file(out, driver="GeoJSON")
        print(f"[plants] OK: {len(gdf):,} plants → {out.name}")
        return len(gdf)
    except Exception as e:
        print(f"[plants] FAILED: {type(e).__name__}: {e}")
        write_empty(out); return 0


# ====================== TRANSMISSION ======================
def prepare_transmission(force: bool = False) -> int:
    print("\n[transmission] preparing transmission lines (World Bank / energydata.info)...")
    out = GRID_DIR / "africa_transmission.geojson"
    cache = CACHE_DIR / "africa_transmission.geojson"
    cache_zip = CACHE_DIR / "africa_transmission.zip"

    gdf = None
    for url in AFRICA_TRANS_URLS:
        is_zip = url.endswith(".zip")
        target = cache_zip if is_zip else cache
        if not download(url, target, force=force, expect_json=not is_zip):
            continue
        try:
            if is_zip:
                with zipfile.ZipFile(target) as z:
                    shp_names = [n for n in z.namelist() if n.lower().endswith(".shp")]
                    if shp_names:
                        extract_dir = CACHE_DIR / "africa_transmission_shp"
                        extract_dir.mkdir(exist_ok=True)
                        z.extractall(extract_dir)
                        gdf = gpd.read_file(extract_dir / shp_names[0])
            else:
                gdf = gpd.read_file(target)
            if gdf is not None and not gdf.empty:
                print(f"[transmission] loaded from: {url.split('/')[-1]}")
                break
        except Exception as e:
            print(f"[transmission] parse error on {url.split('/')[-1]}: {e}")
            gdf = None

    if gdf is None or gdf.empty:
        print("[transmission] all primary sources failed; falling back to OSM Overpass...")
        try:
            s, w, n, e = AFRICA_BBOX
            query = f"""
            [out:json][timeout:300];
            (
              way["power"="line"]["voltage"]({s},{w},{n},{e});
            );
            out geom;
            """
            r = requests.post(OVERPASS_URL, data=query,
                              headers=REQUEST_HEADERS, timeout=600)
            r.raise_for_status()
            data = r.json()
            feats = []
            for el in data.get("elements", []):
                geom = el.get("geometry", [])
                if len(geom) < 2:
                    continue
                tags = el.get("tags", {})
                feats.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[p["lon"], p["lat"]] for p in geom],
                    },
                    "properties": {
                        "voltage": tags.get("voltage"),
                        "name": tags.get("name"),
                        "operator": tags.get("operator"),
                    },
                })
            gdf = gpd.GeoDataFrame.from_features(feats, crs="EPSG:4326")
        except Exception as e:
            print(f"[transmission] Overpass failed too: {e}")
            write_empty(out); return 0

    if gdf is None or gdf.empty:
        write_empty(out); return 0

    try:
        gdf = ensure_wgs84(gdf)
        vc = first_col(gdf, ["voltage_kV", "voltage_kv", "voltage", "VOLTAGE", "kV"])
        gdf["voltage_kv"] = gdf[vc] if vc else None
        gdf["voltage_class"] = gdf["voltage_kv"].apply(classify_voltage)
        gdf["color"] = gdf["voltage_class"].map(VOLTAGE_COLORS).fillna("#64748b")
        gdf["type"] = "transmission"

        nc = first_col(gdf, ["name", "NAME", "line_name"])
        gdf["name"] = gdf[nc].fillna("Transmission line") if nc else "Transmission line"

        sc = first_col(gdf, ["status", "STATUS"])
        if sc:
            gdf["status"] = gdf[sc]

        keep = ["name", "voltage_kv", "voltage_class", "status",
                "color", "type", "geometry"]
        gdf[[c for c in keep if c in gdf.columns]].to_file(out, driver="GeoJSON")
        print(f"[transmission] OK: {len(gdf):,} lines → {out.name}")
        return len(gdf)
    except Exception as e:
        print(f"[transmission] normalize failed: {e}")
        write_empty(out); return 0


# ====================== SUBSTATIONS ======================
def prepare_substations(force: bool = False) -> int:
    print("\n[substations] querying OSM Overpass (may take 2-5 min)...")
    out = GRID_DIR / "africa_substations.geojson"
    cache = CACHE_DIR / "africa_substations.geojson"

    try:
        if not force and cache.exists() and cache.stat().st_size > 10000:
            gdf = gpd.read_file(cache)
        else:
            s, w, n, e = AFRICA_BBOX
            query = f"""
            [out:json][timeout:300];
            (
              node["power"="substation"]({s},{w},{n},{e});
              way["power"="substation"]({s},{w},{n},{e});
            );
            out center;
            """
            r = requests.post(OVERPASS_URL, data=query,
                              headers=REQUEST_HEADERS, timeout=600)
            r.raise_for_status()
            data = r.json()
            feats = []
            for el in data.get("elements", []):
                tags = el.get("tags", {})
                if el.get("type") == "node":
                    lon, lat = el.get("lon"), el.get("lat")
                elif "center" in el:
                    lon, lat = el["center"]["lon"], el["center"]["lat"]
                else:
                    continue
                if lon is None or lat is None:
                    continue
                feats.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [lon, lat]},
                    "properties": {
                        "name": tags.get("name", "Substation"),
                        "voltage_kv": tags.get("voltage"),
                        "operator": tags.get("operator"),
                    },
                })
            gdf = gpd.GeoDataFrame.from_features(feats, crs="EPSG:4326")
            gdf.to_file(cache, driver="GeoJSON")

        gdf = ensure_wgs84(gdf)
        gdf["voltage_class"] = gdf.get(
            "voltage_kv", pd.Series([None]*len(gdf), index=gdf.index)
        ).apply(classify_voltage)
        gdf["color"] = "#f97316"
        gdf["size"] = 7
        gdf["type"] = "substation"
        gdf["name"] = gdf.get("name", "Substation").fillna("Substation")

        keep = ["name", "voltage_kv", "voltage_class", "color", "size",
                "type", "geometry"]
        gdf[[c for c in keep if c in gdf.columns]].to_file(out, driver="GeoJSON")
        print(f"[substations] OK: {len(gdf):,} substations → {out.name}")
        return len(gdf)
    except Exception as e:
        print(f"[substations] FAILED: {type(e).__name__}: {e}")
        write_empty(out); return 0


# ====================== SUBMARINE CABLES ======================
def prepare_submarine_cables(force: bool = False) -> int:
    print("\n[submarine] preparing submarine cables (TeleGeography live API)...")
    out = GRID_DIR / "africa_submarine_cables.geojson"
    cache = CACHE_DIR / "submarine_cables.geojson"

    if not download(SUBMARINE_CABLES_URL, cache, force=force, expect_json=True):
        write_empty(out); return 0

    try:
        gdf = gpd.read_file(cache)
        gdf = ensure_wgs84(gdf)
        # Generous Africa bbox (includes Mediterranean & Indian Ocean)
        gdf = gdf.cx[-30:65, -45:42].copy()

        nc = first_col(gdf, ["name", "Name", "cable_name"])
        gdf["name"] = gdf[nc].fillna("Submarine cable") if nc else "Submarine cable"
        gdf["color"] = "#22d3ee"
        gdf["width"] = 2.5
        gdf["type"] = "submarine_cable"

        keep = ["name", "color", "width", "type", "geometry"]
        gdf[[c for c in keep if c in gdf.columns]].to_file(out, driver="GeoJSON")
        print(f"[submarine] OK: {len(gdf):,} cable segments → {out.name}")
        return len(gdf)
    except Exception as e:
        print(f"[submarine] FAILED: {type(e).__name__}: {e}")
        write_empty(out); return 0


# ====================== DATA CENTERS ======================
# Curated seed list of major African data centers
SEED_DATACENTERS = [
    ("Teraco JB1", "Johannesburg", "South Africa", -26.1471, 28.0579, "Teraco"),
    ("Teraco CT1", "Cape Town", "South Africa", -33.9307, 18.5186, "Teraco"),
    ("Teraco DB1", "Durban", "South Africa", -29.8587, 31.0218, "Teraco"),
    ("Africa Data Centres JHB1", "Johannesburg", "South Africa", -26.1350, 28.2340, "Africa Data Centres"),
    ("Africa Data Centres CPT1", "Cape Town", "South Africa", -33.9250, 18.4240, "Africa Data Centres"),
    ("Africa Data Centres NBO1", "Nairobi", "Kenya", -1.3189, 36.8314, "Africa Data Centres"),
    ("Africa Data Centres LOS1", "Lagos", "Nigeria", 6.4454, 3.3941, "Africa Data Centres"),
    ("Africa Data Centres ACC1", "Accra", "Ghana", 5.6037, -0.1870, "Africa Data Centres"),
    ("Equinix LG1", "Lagos", "Nigeria", 6.5244, 3.3792, "Equinix"),
    ("Equinix LG2", "Lagos", "Nigeria", 6.5280, 3.3800, "Equinix"),
    ("Equinix JN1", "Johannesburg", "South Africa", -26.2041, 28.0473, "Equinix"),
    ("iColo NBO1", "Nairobi", "Kenya", -1.2921, 36.8219, "iColo (Digital Realty)"),
    ("iColo MBA1", "Mombasa", "Kenya", -4.0435, 39.6682, "iColo (Digital Realty)"),
    ("PAIX Accra", "Accra", "Ghana", 5.6200, -0.1900, "PAIX"),
    ("Rack Centre LGS1", "Lagos", "Nigeria", 6.6018, 3.3515, "Rack Centre"),
    ("MainOne MDX-i", "Lagos", "Nigeria", 6.4350, 3.4550, "MainOne"),
    ("Raxio Kampala", "Kampala", "Uganda", 0.3476, 32.5825, "Raxio"),
    ("Raxio Addis Ababa", "Addis Ababa", "Ethiopia", 9.0320, 38.7469, "Raxio"),
    ("Raxio Kinshasa", "Kinshasa", "DRC", -4.3276, 15.3136, "Raxio"),
    ("N+ONE Casablanca", "Casablanca", "Morocco", 33.5731, -7.5898, "N+ONE"),
    ("Vantage Johannesburg", "Johannesburg", "South Africa", -26.0780, 28.1180, "Vantage"),
    ("Open Access Lagos", "Lagos", "Nigeria", 6.5100, 3.3800, "Open Access"),
    ("Orange Abidjan", "Abidjan", "Côte d’Ivoire", 5.3364, -4.0267, "Orange"),
    ("Orange Dakar", "Dakar", "Senegal", 14.6928, -17.4467, "Orange"),
    ("Liquid Intelligent Harare", "Harare", "Zimbabwe", -17.8292, 31.0522, "Liquid Intelligent"),
    ("Liquid Intelligent Nairobi", "Nairobi", "Kenya", -1.2864, 36.8172, "Liquid Intelligent"),
    ("WIOCC Mombasa", "Mombasa", "Kenya", -4.0400, 39.6700, "WIOCC"),
    ("Telecom Egypt Smart Village", "Cairo", "Egypt", 30.0727, 31.0190, "Telecom Egypt"),
    ("Paratus Windhoek", "Windhoek", "Namibia", -22.5609, 17.0658, "Paratus"),
    ("Onix Tunis", "Tunis", "Tunisia", 36.8065, 10.1815, "Onix"),
]


def prepare_data_centers(force: bool = False) -> int:
    print("\n[datacenters] preparing data centers (seed list + OSM)...")
    out = DIGITAL_DIR / "africa_datacenters.geojson"
    cache = CACHE_DIR / "africa_datacenters_osm.geojson"

    osm_feats = []
    try:
        if not force and cache.exists() and cache.stat().st_size > 2000:
            osm_gdf = gpd.read_file(cache)
            osm_feats = json.loads(osm_gdf.to_json())["features"]
        else:
            s, w, n, e = AFRICA_BBOX
            query = f"""
            [out:json][timeout:180];
            (
              node["telecom"="data_center"]({s},{w},{n},{e});
              way["telecom"="data_center"]({s},{w},{n},{e});
              node["office"="it"]({s},{w},{n},{e});
            );
            out center;
            """
            r = requests.post(OVERPASS_URL, data=query,
                              headers=REQUEST_HEADERS, timeout=300)
            r.raise_for_status()
            data = r.json()
            for el in data.get("elements", []):
                tags = el.get("tags", {})
                if el.get("type") == "node":
                    lon, lat = el.get("lon"), el.get("lat")
                elif "center" in el:
                    lon, lat = el["center"]["lon"], el["center"]["lat"]
                else:
                    continue
                if lon is None or lat is None:
                    continue
                osm_feats.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [lon, lat]},
                    "properties": {
                        "name": tags.get("name", "Data Center"),
                        "operator": tags.get("operator"),
                        "source": "OSM",
                    },
                })
            if osm_feats:
                gpd.GeoDataFrame.from_features(osm_feats, crs="EPSG:4326").to_file(
                    cache, driver="GeoJSON"
                )
    except Exception as e:
        print(f"[datacenters] Overpass failed ({e}); continuing with seed list only")

    seed_feats = [{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": {
            "name": name, "city": city, "country": country,
            "operator": op, "source": "curated",
        },
    } for (name, city, country, lat, lon, op) in SEED_DATACENTERS]

    all_feats = seed_feats + osm_feats
    if not all_feats:
        write_empty(out); return 0

    gdf = gpd.GeoDataFrame.from_features(all_feats, crs="EPSG:4326")
    gdf["color"] = "#8b5cf6"
    gdf["size"] = 11
    gdf["type"] = "data_center"

    try:
        gdf.to_file(out, driver="GeoJSON")
        print(f"[datacenters] OK: {len(gdf):,} ({len(seed_feats)} curated + "
              f"{len(osm_feats)} OSM) → {out.name}")
        return len(gdf)
    except Exception as e:
        print(f"[datacenters] write failed: {e}")
        write_empty(out); return 0


# ====================== WATER STRESS (WRI Aqueduct 4.0) ======================
def _extract_aqueduct_country_csv(zip_path: Path) -> Path:
    """Extract country-level baseline-annual CSV from the Aqueduct zip."""
    extract_dir = CACHE_DIR / "aqueduct_extract"
    extract_dir.mkdir(exist_ok=True)
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        # Try most specific first
        candidates = [n for n in names
                      if n.lower().endswith(".csv")
                      and "country" in n.lower()
                      and "baseline" in n.lower()
                      and "annual" in n.lower()]
        if not candidates:
            candidates = [n for n in names
                          if n.lower().endswith(".csv")
                          and "country" in n.lower()]
        if not candidates:
            preview = names[:15]
            raise RuntimeError(
                f"no country CSV found in Aqueduct zip. "
                f"Zip contents (first 15): {preview}"
            )
        target = candidates[0]
        print(f"[water]   using: {target}")
        z.extract(target, extract_dir)
        return extract_dir / target


def prepare_water_stress(force: bool = False) -> int:
    print("\n[water] preparing water stress (WRI Aqueduct 4.0)...")
    out = CONTEXT_DIR / "africa_water_stress.geojson"
    ne_zip = CACHE_DIR / "ne_110m_admin_0_countries.zip"
    ne_dir = CACHE_DIR / "ne_110m_admin_0_countries"
    aq_zip = CACHE_DIR / "aqueduct_4_0.zip"

    # 1) Natural Earth country polygons
    if not download(NATURAL_EARTH_WORLD_URL, ne_zip, force=force):
        write_empty(out); return 0
    if force or not ne_dir.exists() or not any(ne_dir.glob("*.shp")):
        ne_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(ne_zip) as z:
            z.extractall(ne_dir)
    shp = next(ne_dir.glob("*.shp"), None)
    if not shp:
        print("[water] no shapefile extracted"); write_empty(out); return 0
    world = ensure_wgs84(gpd.read_file(shp))

    # 2) Aqueduct country data
    aq_df = pd.DataFrame(columns=["iso3", "bws_score"])
    if download(AQUEDUCT_ZIP_URL, aq_zip, force=force, timeout=300):
        try:
            csv_path = _extract_aqueduct_country_csv(aq_zip)
            raw = pd.read_csv(csv_path, low_memory=False)
            cols_lower = {c.lower(): c for c in raw.columns}
            print(f"[water]   CSV columns: {list(raw.columns)[:12]}{'...' if len(raw.columns) > 12 else ''}")

            iso_col = None
            for c in ["gid_0", "iso_a3", "iso3", "country_iso_a3"]:
                if c in cols_lower:
                    iso_col = cols_lower[c]; break

            if iso_col and "indicator_name" in cols_lower and "score" in cols_lower:
                # Long format: one row per (country, indicator, weight)
                ind_col = cols_lower["indicator_name"]
                score_col = cols_lower["score"]
                mask = (
                    raw[ind_col].astype(str).str.lower()
                       .str.contains("baseline water stress", na=False)
                )
                if "weight" in cols_lower:
                    w_col = cols_lower["weight"]
                    w_lower = raw[w_col].astype(str).str.lower()
                    # Prefer unweighted / total rows for a clean country score
                    w_mask = w_lower.isin({"total", "ones", "tot", "ones (no weighting)"})
                    if w_mask.any():
                        mask &= w_mask
                sub = raw[mask][[iso_col, score_col]].copy()
                sub.columns = ["iso3", "bws_score"]
            else:
                # Wide format: columns include bws_score directly
                score_col = None
                for c in ["bws_score", "bws", "bws_raw"]:
                    if c in cols_lower:
                        score_col = cols_lower[c]; break
                if iso_col and score_col:
                    sub = raw[[iso_col, score_col]].copy()
                    sub.columns = ["iso3", "bws_score"]
                else:
                    raise ValueError(
                        f"unrecognized Aqueduct schema. Columns: {list(raw.columns)[:15]}"
                    )

            sub["iso3"] = sub["iso3"].astype(str).str.upper().str.strip()
            sub = sub[sub["iso3"].isin(AFRICA_ISO3)].dropna(subset=["bws_score"])
            sub = sub.drop_duplicates(subset=["iso3"], keep="first")
            aq_df = sub
            print(f"[water]   parsed {len(aq_df)} African country scores")
        except Exception as e:
            print(f"[water] Aqueduct parse failed ({e}); layer will be unscored")

    # 3) Merge
    iso_ne = first_col(world, ["ISO_A3", "ADM0_A3", "SOV_A3"])
    if not iso_ne:
        print("[water] no ISO3 column in Natural Earth"); write_empty(out); return 0

    africa = world[world[iso_ne].isin(AFRICA_ISO3)].copy()
    if not aq_df.empty:
        africa = africa.merge(aq_df, left_on=iso_ne, right_on="iso3", how="left")
    else:
        africa["bws_score"] = None

    africa["stress_class"] = africa["bws_score"].apply(classify_bws)
    palette = {
        "Low": "#38bdf8", "Low-Medium": "#22c55e", "Medium": "#facc15",
        "High": "#f97316", "Extremely High": "#ef4444", "Unknown": "#94a3b8",
    }
    africa["color"] = africa["stress_class"].map(palette).fillna("#94a3b8")
    africa["type"] = "water_stress"
    nc = first_col(africa, ["NAME", "NAME_LONG", "ADMIN"])
    africa["name"] = africa[nc] if nc else africa[iso_ne]

    keep = ["name", "bws_score", "stress_class", "color", "type", "geometry"]
    try:
        africa[[c for c in keep if c in africa.columns]].to_file(out, driver="GeoJSON")
        scored = africa["bws_score"].notna().sum() if "bws_score" in africa.columns else 0
        print(f"[water] OK: {len(africa)} countries ({scored} with scores) → {out.name}")
        return len(africa)
    except Exception as e:
        print(f"[water] write failed: {e}")
        write_empty(out); return 0


# ====================== ADMIN BOUNDARIES & PLACES ======================
def _download_and_extract_ne(url: str, cache_name: str, force: bool) -> Path | None:
    """Download a Natural Earth zip, extract it, return path to the .shp."""
    zip_path = CACHE_DIR / f"{cache_name}.zip"
    extract_dir = CACHE_DIR / cache_name

    if not download(url, zip_path, force=force, timeout=180):
        return None
    if force or not extract_dir.exists() or not any(extract_dir.glob("*.shp")):
        extract_dir.mkdir(parents=True, exist_ok=True)
        try:
            with zipfile.ZipFile(zip_path) as z:
                z.extractall(extract_dir)
        except zipfile.BadZipFile:
            print(f"  {cache_name}: zip corrupt; redownloading")
            zip_path.unlink(missing_ok=True)
            if not download(url, zip_path, force=True, timeout=180):
                return None
            with zipfile.ZipFile(zip_path) as z:
                z.extractall(extract_dir)
    shp = next(extract_dir.glob("*.shp"), None)
    return shp


def prepare_admin(force: bool = False) -> int:
    """Generate the four admin layer files the frontend requests:
       admin0 (countries), admin1 (states), admin2 (districts, placeholder),
       and places (cities)."""
    print("\n[admin] preparing admin boundaries + places...")
    total = 0

    # ---- admin0: country borders ----
    out0 = ADMIN_DIR / "africa_admin0.geojson"
    shp0 = _download_and_extract_ne(
        NATURAL_EARTH_ADMIN0_URL, "ne_50m_admin_0_countries", force
    )
    if shp0:
        try:
            w = ensure_wgs84(gpd.read_file(shp0))
            iso_col = first_col(w, ["ISO_A3", "ADM0_A3", "SOV_A3"])
            if iso_col:
                africa = w[w[iso_col].isin(AFRICA_ISO3)].copy()
                name_col = first_col(africa, ["NAME", "NAME_LONG", "ADMIN"])
                keep = [c for c in [name_col, iso_col, "geometry"] if c and c in africa.columns]
                africa = africa[keep].rename(columns={name_col: "name", iso_col: "iso3"})
                africa.to_file(out0, driver="GeoJSON")
                print(f"[admin]   admin0: {len(africa)} countries")
                total += len(africa)
            else:
                write_empty(out0)
        except Exception as e:
            print(f"[admin]   admin0 failed: {e}")
            write_empty(out0)
    else:
        write_empty(out0)

    # ---- admin1: provinces / states ----
    out1 = ADMIN_DIR / "africa_admin1.geojson"
    shp1 = _download_and_extract_ne(
        NATURAL_EARTH_ADMIN1_URL, "ne_50m_admin_1_states_provinces", force
    )
    if shp1:
        try:
            w = ensure_wgs84(gpd.read_file(shp1))
            # NE admin1 has a different ISO column name: `iso_a2` or `adm0_a3`
            iso_col = first_col(w, ["adm0_a3", "iso_a3", "ADM0_A3", "ISO_A3", "sov_a3"])
            if iso_col:
                africa = w[w[iso_col].str.upper().isin(AFRICA_ISO3)].copy() \
                         if w[iso_col].dtype == object else w[w[iso_col].isin(AFRICA_ISO3)].copy()
                name_col = first_col(africa, ["name", "NAME", "name_en"])
                keep = [c for c in [name_col, iso_col, "geometry"] if c and c in africa.columns]
                africa = africa[keep].rename(columns={name_col: "name", iso_col: "iso3"})
                # simplify a bit — admin1 lines are decorative, not analytical
                africa["geometry"] = africa["geometry"].simplify(0.05, preserve_topology=True)
                africa.to_file(out1, driver="GeoJSON")
                print(f"[admin]   admin1: {len(africa)} provinces")
                total += len(africa)
            else:
                write_empty(out1)
        except Exception as e:
            print(f"[admin]   admin1 failed: {e}")
            write_empty(out1)
    else:
        write_empty(out1)

    # ---- admin2: districts. No free global dataset. Write placeholder. ----
    out2 = ADMIN_DIR / "africa_admin2.geojson"
    write_empty(out2)
    print("[admin]   admin2: empty (no free global district dataset)")

    # ---- places: major cities ----
    out_p = ADMIN_DIR / "africa_places.geojson"
    shpp = _download_and_extract_ne(
        NATURAL_EARTH_PLACES_URL, "ne_50m_populated_places", force
    )
    if shpp:
        try:
            w = ensure_wgs84(gpd.read_file(shpp))
            iso_col = first_col(w, ["ADM0_A3", "SOV_A3", "iso_a3"])
            if iso_col:
                africa = w[w[iso_col].str.upper().isin(AFRICA_ISO3)].copy() \
                         if w[iso_col].dtype == object else w[w[iso_col].isin(AFRICA_ISO3)].copy()
                # Keep only meaningfully sized cities (rank 0-5 = capital/megacity/large city)
                rank_col = first_col(africa, ["SCALERANK", "scalerank"])
                if rank_col:
                    africa = africa[africa[rank_col] <= 6]
                name_col = first_col(africa, ["NAME", "name", "NAMEASCII"])
                pop_col = first_col(africa, ["POP_MAX", "pop_max"])
                keep_cols = [c for c in [name_col, iso_col, pop_col, "geometry"]
                             if c and c in africa.columns]
                africa = africa[keep_cols]
                rename = {}
                if name_col: rename[name_col] = "name"
                if iso_col: rename[iso_col] = "iso3"
                if pop_col: rename[pop_col] = "population"
                africa = africa.rename(columns=rename)
                africa.to_file(out_p, driver="GeoJSON")
                print(f"[admin]   places: {len(africa)} cities")
                total += len(africa)
            else:
                write_empty(out_p)
        except Exception as e:
            print(f"[admin]   places failed: {e}")
            write_empty(out_p)
    else:
        write_empty(out_p)

    print(f"[admin] OK: {total:,} total features across 4 files")
    return total


# ====================== PLANNED UPGRADES ======================
def prepare_planned_upgrades(force: bool = False) -> int:
    """Extract planned lines from the transmission layer (must run AFTER transmission)."""
    print("\n[planned] preparing planned upgrades...")
    out = GRID_DIR / "africa_planned_upgrades.geojson"
    trans = GRID_DIR / "africa_transmission.geojson"

    if not trans.exists() or trans.stat().st_size < 200:
        print("[planned] no transmission layer yet; writing empty placeholder")
        write_empty(out); return 0

    try:
        gdf = gpd.read_file(trans)
        if "status" not in gdf.columns:
            print("[planned] transmission has no `status` field; writing empty")
            write_empty(out); return 0
        planned = gdf[
            gdf["status"].astype(str).str.lower()
               .str.contains("plan", na=False)
        ].copy()
        if planned.empty:
            print("[planned] no planned lines in dataset; writing empty")
            write_empty(out); return 0
        planned.to_file(out, driver="GeoJSON")
        print(f"[planned] OK: {len(planned):,} planned lines → {out.name}")
        return len(planned)
    except Exception as e:
        print(f"[planned] failed: {e}")
        write_empty(out); return 0


# ====================== MAIN ======================
def main():
    parser = argparse.ArgumentParser(
        description="Africa Power Atlas data pipeline v3.0"
    )
    parser.add_argument("--force", action="store_true",
                        help="Redownload everything, ignore cache")
    parser.add_argument("--only", default="all",
                        help="Comma-separated: plants,transmission,datacenters,"
                             "substations,submarine,water,admin,planned")
    args = parser.parse_args()

    # Note: 'planned' must come after 'transmission'
    steps = [
        ("plants",       prepare_plants),
        ("transmission", prepare_transmission),
        ("substations",  prepare_substations),
        ("submarine",    prepare_submarine_cables),
        ("datacenters",  prepare_data_centers),
        ("water",        prepare_water_stress),
        ("admin",        prepare_admin),
        ("planned",      prepare_planned_upgrades),
    ]

    if args.only != "all":
        requested = {s.strip() for s in args.only.split(",")}
        steps = [(n, f) for (n, f) in steps if n in requested]

    if not steps:
        print("No valid steps selected."); return

    print(f"Africa Power Atlas v3.0 | steps: {', '.join(n for n, _ in steps)}")
    print(f"Project root: {BASE_DIR}")
    print(f"Output: {PUBLIC_DATA_DIR}\n")

    results = {}
    for name, fn in steps:
        try:
            results[name] = fn(force=args.force)
        except Exception as e:
            print(f"[{name}] unhandled: {type(e).__name__}: {e}")
            results[name] = 0

    print("\n" + "=" * 52)
    print("SUMMARY")
    print("=" * 52)
    for name, count in results.items():
        icon = "[OK]" if count > 0 else ("[--]" if name == "planned" else "[FAIL]")
        print(f"  {icon:<7} {name:<14} {count:>7,} features")
    print(f"\nOutputs in: {PUBLIC_DATA_DIR}")


if __name__ == "__main__":
    main()

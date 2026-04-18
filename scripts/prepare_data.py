import argparse
import json
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests

# ====================== PATHS ======================
# Expected file location:
# C:\Users\ambuso\Desktop\power-grid-map\scripts\prepare_data.py
SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent

PUBLIC_DATA_DIR = BASE_DIR / "public" / "data"
CACHE_DIR = BASE_DIR / "cache"
SOURCE_DATA_DIR = BASE_DIR / "source_data"

PLANTS_DIR = PUBLIC_DATA_DIR / "plants"
GRID_DIR = PUBLIC_DATA_DIR / "grid"
DIGITAL_DIR = PUBLIC_DATA_DIR / "digital"
CONTEXT_DIR = PUBLIC_DATA_DIR / "context"

for folder in [PLANTS_DIR, GRID_DIR, DIGITAL_DIR, CONTEXT_DIR, CACHE_DIR, SOURCE_DATA_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

# ====================== DATA SOURCES ======================
WRI_URL = "https://github.com/wri/global-power-plant-database/raw/master/output_database/global_power_plant_database.csv"
AFRICA_TRANS_URLS = [
    "https://datacatalogfiles.worldbank.org/ddh-published-v2/0040465/1/DR0050466/africagrid20170906final.geojson",
    "https://datacatalogfiles.worldbank.org/ddh-published-v2/0040465/1/DR0050467/africagrid20170906.zip",
]
DATA_CENTERS_URL = "https://raw.githubusercontent.com/stevesong/Africa-Datacentres/main/Africa_datacentres_05Jan2025.geojson"
SUBMARINE_CABLES_URL = "https://raw.githubusercontent.com/lifewinning/submarine-cable-taps/master/data/submarine_cables.geojson"
SUBSTATIONS_OVERPASS_URL = "https://overpass-api.de/api/interpreter"

WATER_STRESS_URL = "https://api.worldbank.org/v2/country/all/indicator/ER.H2O.FWTL.ZS?format=json&date=2015:2023&per_page=300"
NATURAL_EARTH_WORLD_URL = "https://naturalearth.s3.amazonaws.com/110m_cultural/ne_110m_admin_0_countries.zip"

REQUEST_HEADERS = {"User-Agent": "PowerGrid-Map/2.5"}

AFRICA_ISO3 = {
    "DZA", "AGO", "BEN", "BWA", "BFA", "BDI", "CMR", "CPV", "CAF", "TCD",
    "COM", "COD", "COG", "CIV", "DJI", "EGY", "GNQ", "ERI", "SWZ", "ETH",
    "GAB", "GMB", "GHA", "GIN", "GNB", "KEN", "LSO", "LBR", "LBY", "MDG",
    "MWI", "MLI", "MRT", "MUS", "MAR", "MOZ", "NAM", "NER", "NGA", "RWA",
    "STP", "SEN", "SYC", "SLE", "SOM", "ZAF", "SSD", "SDN", "TZA", "TGO",
    "TUN", "UGA", "ZMB", "ZWE", "ESH"
}

TECHNOLOGY_COLORS = {
    "Solar": "#facc15",
    "Wind": "#22d3ee",
    "Hydro": "#38bdf8",
    "Geothermal": "#14b8a6",
    "Gas": "#a78bfa",
    "Coal": "#64748b",
    "Oil": "#f87171",
    "Biomass": "#84cc16",
    "Nuclear": "#ef4444",
    "Other": "#94a3b8",
    "Pumped Storage": "#db2777",
    "Storage": "#ec4899",
}

VOLTAGE_COLORS = {
    "735kV+": "#ef4444",
    "500-734kV": "#f97316",
    "345-499kV": "#facc15",
    "230-344kV": "#38bdf8",
    "100-229kV": "#22c55e",
    "31-99kV": "#a78bfa",
    "<31kV": "#94a3b8",
}


# ====================== HELPERS ======================
def empty_feature_collection() -> dict:
    return {"type": "FeatureCollection", "features": []}


def write_empty_geojson(path: Path) -> None:
    path.write_text(json.dumps(empty_feature_collection(), indent=2), encoding="utf-8")


def download_with_retries(
    url: str,
    out_path: Path,
    timeout: int = 180,
    retries: int = 4,
    force: bool = False
) -> None:
    if not force and out_path.exists() and out_path.stat().st_size > 0:
        print(f"Using cached {out_path.name}")
        return

    last_error = None

    for attempt in range(1, retries + 1):
        try:
            print(f"Downloading {url} (attempt {attempt}/{retries})...")
            response = requests.get(url, headers=REQUEST_HEADERS, timeout=timeout, stream=True)
            response.raise_for_status()

            with open(out_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        f.write(chunk)

            print(f"Saved: {out_path}")
            return
        except Exception as e:
            last_error = e
            print(f"Download failed: {e}")
            if attempt < retries:
                time.sleep(attempt * 5)

    raise RuntimeError(f"Failed to download {url}: {last_error}")


def read_geojson_lenient(path: Path) -> gpd.GeoDataFrame:
    text = path.read_text(encoding="utf-8", errors="ignore")
    lowered = text[:5000].lower()

    if lowered.startswith("<html") or "<!doctype" in lowered:
        raise ValueError(f"Received HTML instead of GeoJSON from {path}")

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError(f"Could not locate valid JSON object in {path}")

    payload = json.loads(text[start:end + 1])
    features = payload.get("features", [])
    return gpd.GeoDataFrame.from_features(features, crs="EPSG:4326")


def ensure_wgs84(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    if gdf.crs is None:
        return gdf.set_crs("EPSG:4326")
    return gdf.to_crs("EPSG:4326")


def first_existing_column(gdf: gpd.GeoDataFrame, names: list[str]):
    for col in names:
        if col in gdf.columns:
            return col
    return None


def safe_series(gdf: gpd.GeoDataFrame, column: str, default):
    if column in gdf.columns:
        return gdf[column].fillna(default)
    return pd.Series([default] * len(gdf), index=gdf.index)


def classify_voltage(value) -> str:
    try:
        cleaned = str(value).replace("kV", "").replace("KV", "").replace(",", "").strip()
        if not cleaned:
            return "100-229kV"
        v = float(cleaned)
        if v >= 735:
            return "735kV+"
        if v >= 500:
            return "500-734kV"
        if v >= 345:
            return "345-499kV"
        if v >= 230:
            return "230-344kV"
        if v >= 100:
            return "100-229kV"
        if v >= 31:
            return "31-99kV"
        return "<31kV"
    except Exception:
        return "100-229kV"


def classify_water_stress(value):
    try:
        v = float(value)
        if v < 10:
            return "Low"
        if v < 20:
            return "Low-Medium"
        if v < 40:
            return "Medium"
        if v < 80:
            return "High"
        return "Extremely High"
    except Exception:
        return "Unknown"


# ====================== PREPARATION FUNCTIONS ======================
def prepare_africa_plants(force: bool = False) -> None:
    print("\nPreparing Africa power plants...")
    out_path = PLANTS_DIR / "africa_power_plants.geojson"
    cache_path = CACHE_DIR / "global_power_plant_database.csv"

    try:
        if force or not cache_path.exists():
            download_with_retries(WRI_URL, cache_path, force=force)

        df = pd.read_csv(cache_path, low_memory=False)
        df = df[df["country"].isin(AFRICA_ISO3)].copy()
        df = df.dropna(subset=["latitude", "longitude", "capacity_mw"])
        df["capacity_mw"] = pd.to_numeric(df["capacity_mw"], errors="coerce")
        df = df[df["capacity_mw"] > 0].copy()

        fuel_map = {
            "Solar": "Solar",
            "Wind": "Wind",
            "Hydro": "Hydro",
            "Nuclear": "Nuclear",
            "Gas": "Gas",
            "Coal": "Coal",
            "Oil": "Oil",
            "Biomass": "Biomass",
            "Geothermal": "Geothermal",
            "Waste": "Biomass",
            "Storage": "Storage",
            "Pumped Storage": "Pumped Storage",
        }

        df["technology"] = df["primary_fuel"].fillna("Other").astype(str).str.title()
        df["technology"] = df["technology"].map(fuel_map).fillna("Other")

        gdf = gpd.GeoDataFrame(
            df,
            geometry=gpd.points_from_xy(df.longitude, df.latitude),
            crs="EPSG:4326",
        )

        gdf["color"] = gdf["technology"].map(TECHNOLOGY_COLORS).fillna("#94a3b8")
        max_cap = float(gdf["capacity_mw"].max() or 1.0)
        gdf["radius"] = (gdf["capacity_mw"] / max_cap * 22) + 6
        gdf["name"] = safe_series(gdf, "name", "Unknown Plant")
        gdf["type"] = "power_plant"

        gdf.to_file(out_path, driver="GeoJSON")
        print(f"Saved {len(gdf):,} power plants → {out_path}")
    except Exception as e:
        print(f"Power plants failed: {type(e).__name__}: {e}")
        write_empty_geojson(out_path)


def prepare_africa_transmission(force: bool = False) -> None:
    print("\nPreparing Africa transmission lines...")
    final_path = GRID_DIR / "africa_transmission.geojson"
    cache_geo = CACHE_DIR / "africa_transmission_download.geojson"
    cache_zip = CACHE_DIR / "africa_transmission_download.zip"

    try:
        if cache_geo.exists():
            head = cache_geo.read_text(encoding="utf-8", errors="ignore")[:500].lower()
            if "<html" in head:
                cache_geo.unlink(missing_ok=True)

        downloaded_path = None
        for url in AFRICA_TRANS_URLS:
            target = cache_zip if url.endswith(".zip") else cache_geo
            try:
                download_with_retries(url, target, force=force)
                downloaded_path = target
                print(f"Using source: {url}")
                break
            except Exception as e:
                print(f"Transmission source failed: {url} → {e}")

        if not downloaded_path:
            raise RuntimeError("All transmission sources failed")

        if downloaded_path.suffix.lower() == ".zip":
            with zipfile.ZipFile(downloaded_path) as z:
                names = z.namelist()
                geojson_files = [f for f in names if f.lower().endswith((".geojson", ".json"))]
                if geojson_files:
                    with z.open(geojson_files[0]) as f:
                        raw = f.read().decode("utf-8", errors="ignore")
                    start = raw.find("{")
                    end = raw.rfind("}")
                    payload = json.loads(raw[start:end + 1])
                    gdf = gpd.GeoDataFrame.from_features(payload.get("features", []), crs="EPSG:4326")
                else:
                    extract_dir = CACHE_DIR / "africa_transmission_zip_extract"
                    if extract_dir.exists():
                        for p in extract_dir.iterdir():
                            if p.is_file():
                                p.unlink()
                    else:
                        extract_dir.mkdir(parents=True, exist_ok=True)
                    z.extractall(extract_dir)
                    shp_files = list(extract_dir.glob("*.shp"))
                    if not shp_files:
                        raise RuntimeError("No shapefile found in transmission zip")
                    gdf = gpd.read_file(shp_files[0])
        else:
            gdf = read_geojson_lenient(downloaded_path)

        if gdf.empty:
            raise ValueError("Transmission dataset is empty")

        gdf = ensure_wgs84(gdf)

        voltage_col = next(
            (c for c in gdf.columns if any(x in c.lower() for x in ["voltage", "kv"])),
            None
        )
        gdf["voltage_kv"] = gdf[voltage_col] if voltage_col else None
        gdf["voltage_class"] = gdf["voltage_kv"].apply(classify_voltage)
        gdf["type"] = "transmission"
        gdf["color"] = gdf["voltage_class"].map(VOLTAGE_COLORS).fillna("#64748b")

        gdf.to_file(final_path, driver="GeoJSON")
        print(f"Saved {len(gdf):,} transmission lines → {final_path}")
    except Exception as e:
        print(f"Transmission failed: {type(e).__name__}: {e}")
        write_empty_geojson(final_path)


def prepare_africa_data_centers(force: bool = False) -> None:
    print("\nPreparing Africa data centers...")
    final_path = DIGITAL_DIR / "africa_datacenters.geojson"
    cache_path = CACHE_DIR / "africa_datacenters.geojson"

    try:
        if force or not cache_path.exists():
            download_with_retries(DATA_CENTERS_URL, cache_path, timeout=120, force=force)

        gdf = gpd.read_file(cache_path)
        gdf = ensure_wgs84(gdf)

        problematic = [c for c in gdf.columns if any(x in c for x in ["SQM", "IT Power", "PostCode"])]
        if problematic:
            gdf = gdf.drop(columns=problematic, errors="ignore")

        name_col = first_existing_column(gdf, ["name", "facility_name", "Company", "operator"])
        if name_col:
            gdf["name"] = gdf[name_col].fillna("Data Center")
        else:
            gdf["name"] = "Data Center"

        gdf["color"] = "#8b5cf6"
        gdf["size"] = 11
        gdf["type"] = "data_center"

        gdf.to_file(final_path, driver="GeoJSON")
        print(f"Saved {len(gdf):,} data centers → {final_path}")
    except Exception as e:
        print(f"Data centers failed: {type(e).__name__}: {e}")
        write_empty_geojson(final_path)


def prepare_africa_substations(force: bool = False) -> None:
    print("\nPreparing Africa substations...")
    final_path = GRID_DIR / "africa_substations.geojson"
    cache_path = CACHE_DIR / "africa_substations.geojson"

    try:
        if not force and cache_path.exists() and cache_path.stat().st_size > 10000:
            gdf = gpd.read_file(cache_path)
            gdf = ensure_wgs84(gdf)
        else:
            print("Querying OpenStreetMap Overpass API...")
            query = """
            [out:json][timeout:240];
            (
              node["power"="substation"](-35,-20,38,52);
              way["power"="substation"](-35,-20,38,52);
              relation["power"="substation"](-35,-20,38,52);
            );
            out geom;
            """

            resp = requests.post(
                SUBSTATIONS_OVERPASS_URL,
                data=query,
                headers=REQUEST_HEADERS,
                timeout=300
            )
            resp.raise_for_status()
            data = resp.json()

            features = []
            for el in data.get("elements", []):
                tags = el.get("tags", {})

                if el.get("type") == "node":
                    lon = el.get("lon")
                    lat = el.get("lat")
                    if lon is None or lat is None:
                        continue
                    coords = [lon, lat]
                elif el.get("geometry"):
                    first = el["geometry"][0]
                    coords = [first["lon"], first["lat"]]
                else:
                    continue

                features.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": coords},
                    "properties": {
                        "name": tags.get("name", "Substation"),
                        "voltage_kv": tags.get("voltage"),
                        "type": "substation",
                    },
                })

            gdf = gpd.GeoDataFrame.from_features(features, crs="EPSG:4326")
            gdf.to_file(cache_path, driver="GeoJSON")

        gdf["voltage_class"] = gdf.get(
            "voltage_kv",
            pd.Series([None] * len(gdf), index=gdf.index)
        ).apply(classify_voltage)
        gdf["color"] = "#f97316"
        gdf["size"] = 7
        gdf["type"] = "substation"

        gdf.to_file(final_path, driver="GeoJSON")
        print(f"Saved {len(gdf):,} substations → {final_path}")
    except Exception as e:
        print(f"Substations failed: {type(e).__name__}: {e}")
        if cache_path.exists():
            try:
                gdf = gpd.read_file(cache_path)
                gdf = ensure_wgs84(gdf)
                gdf["voltage_class"] = gdf.get(
                    "voltage_kv",
                    pd.Series([None] * len(gdf), index=gdf.index)
                ).apply(classify_voltage)
                gdf["color"] = "#f97316"
                gdf["size"] = 7
                gdf["type"] = "substation"
                gdf.to_file(final_path, driver="GeoJSON")
                print(f"Used cached substations → {final_path}")
                return
            except Exception as cache_error:
                print(f"Cached substations also failed: {type(cache_error).__name__}: {cache_error}")

        write_empty_geojson(final_path)


def prepare_africa_submarine_cables(force: bool = False) -> None:
    print("\nPreparing submarine cables...")
    final_path = GRID_DIR / "africa_submarine_cables.geojson"
    cache_path = CACHE_DIR / "submarine_cables.geojson"

    try:
        if force or not cache_path.exists():
            download_with_retries(SUBMARINE_CABLES_URL, cache_path, timeout=120, force=force)

        gdf = gpd.read_file(cache_path)
        gdf = ensure_wgs84(gdf)

        gdf = gdf.cx[-25:55, -40:40].copy()

        gdf["name"] = safe_series(gdf, "name", "Submarine Cable")
        gdf["color"] = "#22d3ee"
        gdf["width"] = 2.5
        gdf["type"] = "submarine_cable"

        gdf.to_file(final_path, driver="GeoJSON")
        print(f"Saved {len(gdf):,} submarine cable segments → {final_path}")
    except Exception as e:
        print(f"Submarine cables failed: {type(e).__name__}: {e}")
        write_empty_geojson(final_path)


def prepare_africa_water_stress(force: bool = False) -> None:
    print("\nPreparing Africa water stress data (country-level)...")
    final_path = CONTEXT_DIR / "africa_water_stress.geojson"
    world_cache_zip = CACHE_DIR / "ne_110m_admin_0_countries.zip"
    world_extract_dir = CACHE_DIR / "ne_110m_admin_0_countries"

    try:
        # 1. Download Natural Earth boundaries once
        if force or not world_cache_zip.exists():
            print("Downloading world countries geometry...")
            download_with_retries(
                NATURAL_EARTH_WORLD_URL,
                world_cache_zip,
                timeout=180,
                force=force
            )

        # 2. Extract locally
        if force or not world_extract_dir.exists():
            world_extract_dir.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(world_cache_zip, "r") as z:
                z.extractall(world_extract_dir)

        shp_files = list(world_extract_dir.glob("*.shp"))
        if not shp_files:
            raise RuntimeError(f"No shapefile found in {world_extract_dir}")

        world = gpd.read_file(shp_files[0])
        world = ensure_wgs84(world)

        # 3. Pull ALL pages from World Bank, most recent non-empty values only
        base_url = "https://api.worldbank.org/v2/country/all/indicator/ER.H2O.FWTL.ZS"
        all_rows = []
        page = 1
        total_pages = 1

        while page <= total_pages:
            page_cache = CACHE_DIR / f"water_stress_page_{page}.json"
            url = f"{base_url}?format=json&mrnev=1&per_page=500&page={page}"

            if force or not page_cache.exists():
                download_with_retries(url, page_cache, timeout=120, force=force)

            with open(page_cache, encoding="utf-8") as f:
                payload = json.load(f)

            if not isinstance(payload, list) or len(payload) < 2:
                raise RuntimeError(f"Unexpected World Bank response on page {page}")

            meta = payload[0] or {}
            rows = payload[1] or []

            try:
                total_pages = int(meta.get("pages", 1))
            except Exception:
                total_pages = 1

            all_rows.extend(rows)
            page += 1

        if not all_rows:
            raise RuntimeError("World Bank API returned no usable rows")

        # 4. Filter Africa using ISO3 from the API response
        records = []
        for item in all_rows:
            country_obj = item.get("country") or {}
            iso = (item.get("countryiso3code") or country_obj.get("id") or "").upper().strip()
            value = item.get("value")
            year = item.get("date")

            if iso in AFRICA_ISO3 and value is not None:
                records.append({
                    "iso3": iso,
                    "country": country_obj.get("value", iso),
                    "water_stress": value,
                    "year": year,
                })

        if not records:
            raise RuntimeError("No African water stress records found after filtering")

        df = pd.DataFrame(records).drop_duplicates(subset=["iso3"], keep="first")

        iso_col = None
        for candidate in ["ISO_A3", "ADM0_A3", "SOV_A3"]:
            if candidate in world.columns:
                iso_col = candidate
                break

        if not iso_col:
            raise RuntimeError(f"No ISO3 column found in Natural Earth columns: {list(world.columns)}")

        gdf = world[world[iso_col].isin(df["iso3"])].copy()
        if gdf.empty:
            raise RuntimeError("Natural Earth filter returned zero African matches")

        gdf = gdf.merge(df, left_on=iso_col, right_on="iso3", how="left")

        gdf["stress_class"] = gdf["water_stress"].apply(classify_water_stress)

        colors = {
            "Low": "#38bdf8",
            "Low-Medium": "#22c55e",
            "Medium": "#facc15",
            "High": "#f97316",
            "Extremely High": "#ef4444",
            "Unknown": "#94a3b8",
        }

        gdf["color"] = gdf["stress_class"].map(colors).fillna("#94a3b8")
        gdf["type"] = "water_stress"
        gdf["name"] = gdf["country"].fillna("Unknown")

        gdf.to_file(final_path, driver="GeoJSON")
        print(f"Saved {len(gdf):,} countries with water stress data → {final_path}")

    except Exception as e:
        print(f"Water stress failed: {type(e).__name__}: {e}")
        write_empty_geojson(final_path)

def prepare_planned_upgrades() -> None:
    print("\nPreparing planned upgrades placeholder...")
    final_path = GRID_DIR / "africa_planned_upgrades.geojson"
    write_empty_geojson(final_path)
    print(f"Saved planned upgrades placeholder → {final_path}")


# ====================== MAIN ======================
def main():
    parser = argparse.ArgumentParser(description="Africa Power Grid Data Preparation Pipeline v2.5")
    parser.add_argument("--force", action="store_true", help="Force redownload everything")
    parser.add_argument(
        "--only",
        type=str,
        default="all",
        help="Run only specific steps: plants,transmission,datacenters,substations,submarine,water,planned"
    )
    args = parser.parse_args()

    print("Africa Power Grid Data Preparation Pipeline v2.5\n")
    print(f"Script dir: {SCRIPT_DIR}")
    print(f"Project base: {BASE_DIR}")
    print(f"Public data dir: {PUBLIC_DATA_DIR}\n")

    steps = {
        "plants": prepare_africa_plants,
        "transmission": prepare_africa_transmission,
        "datacenters": prepare_africa_data_centers,
        "substations": prepare_africa_substations,
        "submarine": prepare_africa_submarine_cables,
        "water": prepare_africa_water_stress,
        "planned": prepare_planned_upgrades,
    }

    to_run = list(steps.keys()) if args.only == "all" else [s.strip() for s in args.only.split(",") if s.strip()]

    invalid = [name for name in to_run if name not in steps]
    if invalid:
        print(f"Unknown steps ignored: {', '.join(invalid)}")

    valid_steps = [name for name in to_run if name in steps]
    if not valid_steps:
        print("No valid steps selected.")
        return

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {}
        for name in valid_steps:
            func = steps[name]
            if name in {"plants", "transmission", "datacenters", "substations", "submarine", "water"}:
                futures[executor.submit(func, force=args.force)] = name
            else:
                futures[executor.submit(func)] = name

        for future in as_completed(futures):
            step_name = futures[future]
            try:
                future.result()
            except Exception as e:
                print(f"Step failed unexpectedly [{step_name}]: {type(e).__name__}: {e}")

    print("\nPipeline completed.")
    print(f"Fresh data ready in: {PUBLIC_DATA_DIR}")


if __name__ == "__main__":
    main()
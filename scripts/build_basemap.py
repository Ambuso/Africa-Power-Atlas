"""
Build the self-hosted basemap layers used by the "Dark" / "Minimal" themes.

Everything comes from Natural Earth (public domain), is simplified and
coordinate-rounded, then written to public/basemap/ so the map never
depends on a third-party tile server for its core look.

Run:
    python scripts/build_basemap.py
"""
import json
import zipfile
from pathlib import Path

import geopandas as gpd
import requests
from shapely.geometry import box, mapping

BASE_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = BASE_DIR / "cache" / "ne"
OUT_DIR = BASE_DIR / "public" / "basemap"

NE = "https://naturalearth.s3.amazonaws.com"
AFRICA_BBOX = box(-26, -40, 64, 40)  # Africa + Madagascar + Arabian margin


def load(name: str) -> gpd.GeoDataFrame:
    """Download (once) and read a Natural Earth layer, e.g. '50m_physical/ne_50m_land'."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = CACHE_DIR / f"{Path(name).name}.zip"
    if not zip_path.exists():
        print(f"  GET {name}")
        r = requests.get(f"{NE}/{name}.zip", timeout=180)
        r.raise_for_status()
        zip_path.write_bytes(r.content)
    out = CACHE_DIR / Path(name).name
    if not out.exists():
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(out)
    shp = next(out.glob("*.shp"))
    return gpd.read_file(shp).to_crs(4326)


def round_coords(obj, nd=3):
    if isinstance(obj, float):
        return round(obj, nd)
    if isinstance(obj, (list, tuple)):
        return [round_coords(o, nd) for o in obj]
    return obj


def write(gdf: gpd.GeoDataFrame, filename: str, keep: list[str], tolerance: float, nd=3):
    gdf = gdf[~gdf.geometry.is_empty & gdf.geometry.notna()].copy()
    if tolerance:
        gdf["geometry"] = gdf.geometry.simplify(tolerance, preserve_topology=True)
    features = []
    for _, row in gdf.iterrows():
        geom = mapping(row.geometry)
        geom = {"type": geom["type"], "coordinates": round_coords(geom["coordinates"], nd)}
        props = {k: (None if row[k] != row[k] else row[k]) for k in keep}  # NaN -> None
        features.append({"type": "Feature", "properties": props, "geometry": geom})
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / filename
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")))
    print(f"  {filename:<22} {len(features):>5} features  {path.stat().st_size / 1024:>7.0f} KB")


def main():
    print("[basemap] building self-hosted Natural Earth layers")

    # World land at low detail + Africa at high detail (sharp coastline when zoomed).
    ocean = load("50m_physical/ne_50m_ocean")
    write(ocean, "ocean.geojson", [], 0.03)

    world_land = load("50m_physical/ne_50m_land")
    write(world_land, "land.geojson", [], 0.03)

    africa_land = load("10m_physical/ne_10m_land").clip(AFRICA_BBOX)
    write(africa_land.explode(index_parts=False), "land_africa.geojson", [], 0.004, nd=4)

    # Countries outside Africa → dimmed so the continent is the focal point.
    countries = load("50m_cultural/ne_50m_admin_0_countries")
    rest = countries[countries["CONTINENT"] != "Africa"]
    write(rest, "rest_of_world.geojson", [], 0.03)

    borders = load("50m_cultural/ne_50m_admin_0_boundary_lines_land")
    write(borders, "borders.geojson", [], 0.02)

    lakes = load("10m_physical/ne_10m_lakes").clip(AFRICA_BBOX)
    lakes = lakes[lakes["scalerank"] <= 6]
    write(lakes, "lakes.geojson", ["name", "scalerank"], 0.004, nd=4)

    rivers = load("10m_physical/ne_10m_rivers_lake_centerlines").clip(AFRICA_BBOX)
    rivers = rivers[(rivers["scalerank"] <= 7) & (rivers["featurecla"] != "Lake Centerline")]
    write(rivers, "rivers.geojson", ["name", "scalerank"], 0.004, nd=4)

    # Ocean / sea names as label points.
    marine = load("50m_physical/ne_50m_geography_marine_polys")
    marine = marine[marine["scalerank"] <= 3].copy()
    marine["geometry"] = marine.geometry.representative_point()
    marine["name"] = marine["name"].str.title()
    write(marine, "marine_labels.geojson", ["name", "scalerank", "featurecla"], 0)

    print(f"[basemap] done → {OUT_DIR}")


if __name__ == "__main__":
    main()

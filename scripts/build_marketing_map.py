#!/usr/bin/env python3
"""Generate the homepage illustration from the committed atlas datasets."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COUNTRIES = ROOT / "public/data/admin/africa_admin0.geojson"
PLANTS = ROOT / "public/data/plants/africa_power_plants.geojson"
OUTPUT = ROOT / "public/mapkwetu-atlas.svg"
COLORS = {"Solar": "#e8d57f", "Wind": "#9ce5cb", "Hydro": "#7ec8db", "Gas": "#e9b67d", "Coal": "#aeb6a3", "Oil": "#d6dcc4", "Geothermal": "#b4d971", "Biomass": "#b4d971", "Nuclear": "#b6a6d2"}

def point(coords):
    longitude, latitude = coords[:2]
    return 69 + (longitude + 19) * 6.78, 102 + (39 - latitude) * 7.10

def ring_path(ring):
    step = max(1, len(ring) // 180)
    points = [point(coords) for coords in ring[::step]]
    if len(points) < 3:
        return ""
    return "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in points) + "Z"

def main():
    countries = json.loads(COUNTRIES.read_text())
    plants = json.loads(PLANTS.read_text())
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 760" role="img" aria-labelledby="title desc">', '<title id="title">Africa infrastructure overview</title><desc id="desc">Natural Earth country boundaries and WRI power plant records. Colours indicate reported fuel type. This illustration is a view of the atlas dataset, not a complete current inventory.</desc>', '<defs><radialGradient id="glow"><stop stop-color="#6f8d6040"/><stop offset="1" stop-color="#6f8d6000"/></radialGradient></defs>', '<ellipse cx="345" cy="385" rx="310" ry="340" fill="url(#glow)"/>', '<g fill="none" stroke="#adc58a" stroke-opacity=".12" stroke-width=".6">']
    for rx, ry in [(245, 320), (190, 320), (110, 320)]:
        svg.append(f'<ellipse cx="352" cy="385" rx="{rx}" ry="{ry}"/>')
    for ry in [70, 145, 225]:
        svg.append(f'<ellipse cx="352" cy="385" rx="300" ry="{ry}"/>')
    svg.extend(['</g>', '<g fill="#6b8a5a" fill-opacity=".25" stroke="#9bb485" stroke-opacity=".67" stroke-width=".65" stroke-linejoin="round">'])
    for feature in countries['features']:
        geometry = feature['geometry']
        polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
        path = ''.join(ring_path(ring) for polygon in polygons for ring in polygon)
        if path:
            svg.append(f'<path d="{path}"/>')
    svg.append('</g><g>')
    for feature in plants['features']:
        if feature['geometry']['type'] != 'Point':
            continue
        x, y = point(feature['geometry']['coordinates'])
        props = feature.get('properties') or {}
        fuel = props.get('primary_fuel') or props.get('fuel') or props.get('technology') or ''
        color = COLORS.get(fuel, '#b4c1a4')
        try:
            capacity = max(0, float(props.get('capacity_mw') or 0))
        except (TypeError, ValueError):
            capacity = 0
        radius = min(4.2, 1.1 + math.sqrt(capacity) / 22)
        svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{radius + 2:.1f}" fill="{color}" opacity=".09"/><circle cx="{x:.1f}" cy="{y:.1f}" r="{radius:.1f}" fill="{color}" opacity=".88"/>')
    svg.append('</g><g fill="#c4d3b6" fill-opacity=".62" font-family="monospace" font-size="9" letter-spacing="2"><text x="60" y="465" transform="rotate(-90 60 465)">ATLANTIC OCEAN</text><text x="556" y="450" transform="rotate(90 556 450)">INDIAN OCEAN</text><text x="242" y="88">MEDITERRANEAN SEA</text></g></svg>')
    OUTPUT.write_text(''.join(svg))
    print(f"Generated {OUTPUT}")

if __name__ == '__main__':
    main()

# Africa Power Grid Map

A clean Next.js + MapLibre project for exploring African power infrastructure.

## What is included

- Map themes (`components/map/mapThemes.ts`)
- Fuel colors (`components/map/fuelColors.ts`)
- Data preparation (`components/map/dataPrep.ts`)
- Map rendering (`components/map/MapCanvas.tsx`)
- Layer/filter sidebar (`components/sidebar/LayerPanel.tsx`)
- Data extraction / normalization script (`scripts/prepare_data.py`)
- Renewable-only and per-fuel filters

## Project structure

```text
app/
components/
  map/
  sidebar/
lib/
public/data/
scripts/
raw/
```

## Install

```bash
npm install
python -m pip install requests
```

## Prepare data

Put your raw GeoJSON files inside `raw/` and run:

```bash
npm run prepare:data
```

The script writes prepared files to:

- `public/data/plants/africa_power_plants.geojson`
- `public/data/grid/africa_transmission.geojson`
- `public/data/grid/africa_substations.geojson`
- `public/data/grid/africa_submarine_cables.geojson`
- `public/data/digital/africa_datacenters.geojson`
- `public/data/context/africa_water_stress.geojson`

## Run

macOS / Linux:

```bash
rm -rf .next
npm run dev
```

Windows PowerShell:

```powershell
rd /s /q .next
npm run dev
```

## Map themes configuration

All basemap themes live in `components/map/mapThemes.ts`. None need an API key:

| Theme | Source |
| --- | --- |
| Dark (default) | Self-hosted Natural Earth layers in `public/basemap/` + shaded relief (AWS Terrain Tiles); OpenFreeMap roads/towns fade in when zoomed |
| Light / Streets | OpenFreeMap hosted `positron` / `liberty` styles |
| Hybrid | Esri World Imagery + vector borders, roads and labels |
| Satellite | Esri World Imagery |
| Minimal | Flat land / water from the self-hosted layers |

The self-hosted layers are committed, so the Dark and Minimal maps always render.
Rebuild them with `python scripts/build_basemap.py`.

Optional: set `NEXT_PUBLIC_MAPTILER_KEY` in `.env.local` to use MapTiler for Light / Streets instead.

## Renewable filters

Renewable logic is centralized in `components/map/dataPrep.ts`.
During plant preparation:

- fuel values are normalized (`Solar`, `Wind`, `Hydro`, etc.)
- each feature gets `properties.renewable`
- the UI can filter with:
  - a global `renewableOnly` toggle
  - per-fuel chip filters

## Notes

- Placeholder GeoJSON files are included so the app boots without 404s.
- If you hit a new compile/runtime error, replace the affected file with the one from this scaffold and clear `.next` again.

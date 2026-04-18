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

All basemap themes live in `components/map/mapThemes.ts`.
Each theme object contains:

- `label`: display name in the UI
- `style`: either a remote style URL or inline style JSON
- `preview`: metadata you can use later for UI gradients/previews
- `description`: short text shown in the panel
- `atmosphere`: optional fog / globe styling metadata

`getAtmosphereForTheme(themeKey)` returns a theme-specific atmosphere object and falls back to the dark theme if one is missing.

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

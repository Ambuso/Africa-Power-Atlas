# MapKwetu

MapKwetu brings together Africa’s energy and digital infrastructure for exploration and focused research. It includes a public landing page, an interactive atlas, source notes, and a project-enquiry brief builder.

**Website:** https://africapowergrid.vercel.app/

**Interactive atlas:** https://africapowergrid.vercel.app/atlas

The repository retains its original `Africa-Power-Atlas` name. The product is branded MapKwetu.

## Pages and enquiries

- `/`: MapKwetu introduction, research offerings, and project brief builder.
- `/atlas`: the existing interactive infrastructure map, filters, and analytics.
- `/sources`: dataset sources, coverage, methods, and limitations.
- `/datasets`: transition dataset catalogue with source releases, coverage, download links, and map entry points.
- `/transition`: searchable project table, country/status filters, three-record comparisons, source-linked exports, and an illustrative emissions scenario.

The enquiry form always downloads a text brief on the visitor’s device. To also prepare an email draft addressed to your business, set `MAPKWETU_CONTACT_EMAIL` in `.env.local` and in the hosting environment, then rebuild. The address is intentionally shown to visitors through their mail client, so use a public business inbox. Without it, the form clearly states that it only downloads a brief and sends nothing. No visitor data is stored by this form, and no email is sent automatically. The visitor reviews and sends the prepared email in their email app.

Research and custom dashboards are offered by enquiry. This release does not implement subscriptions, payment collection, customer accounts, or an automated report-delivery service.

The homepage illustration is generated from the committed Natural Earth boundaries and WRI plant records. It represents that dataset rather than complete current infrastructure coverage. To regenerate it after refreshing the data, run `python scripts/build_marketing_map.py`.

## Architecture

![Architecture: public data sources feed prepare_data.py, which writes GeoJSON layers that the Next.js app loads and draws with MapLibre GL](docs/architecture.png)

The project has two parts. A Python script downloads the public datasets, clips them to Africa and writes clean GeoJSON files. A Next.js app then loads those files in the browser and draws them with MapLibre GL.

## What the map shows

| Layer | Source |
|---|---|
| Power plants | WRI Global Power Plant Database |
| Transmission lines | World Bank Africa Electricity Transmission and Distribution Grid Map (2017) |
| Planned upgrades | Derived from the transmission layer |
| Substations | OpenStreetMap, through the Overpass API |
| Submarine cables | TeleGeography Submarine Cable Map |
| Data centers | OpenStreetMap plus a curated list of major sites |
| Water stress | WRI Aqueduct 4.0 country rankings |
| Countries, provinces, place labels | Natural Earth |

## Features

- Filter power plants by fuel type, or show renewables only
- View plants as points, clusters or a heatmap
- Search by country or region
- Six basemap themes: Dark, Light, Streets, Hybrid, Satellite and Minimal
- Stats panel and map legend

## Run it locally

You need Node.js. Python 3 is optional and is used to refresh the datasets.

```bash
git clone https://github.com/Ambuso/Africa-Power-Atlas.git
cd Africa-Power-Atlas

npm ci
pip install geopandas pandas requests   # only needed to refresh datasets

npm run prepare:data   # optional: refresh the committed data in public/data/
npm run dev            # http://localhost:3000
```

Prepared GeoJSON files are committed in `public/data/`, so you can start the app without running Python. Python 3 and the listed Python packages are only needed to refresh the datasets. The substations step queries OpenStreetMap and can take a few minutes.

The browser loads enabled layers on demand and reuses successful results during the session. Country and province boundaries also load when place labels need them. Plants appear before larger layers finish loading. Failed layers show an error with a Retry button; successful layers remain available. Browser HTTP caching follows the hosting server’s cache headers.

Useful options for the data script:

```bash
python scripts/prepare_data.py --only plants,transmission   # run selected steps
python scripts/prepare_data.py --force                      # ignore the cache and download again
```

### Basemaps

The map works without any API key. The default Dark and Minimal basemaps are built from Natural Earth layers committed in `public/basemap/` (rebuild with `python scripts/build_basemap.py`), with terrain shading from AWS Terrain Tiles. Light and Streets use free OpenFreeMap styles; Hybrid and Satellite use Esri World Imagery.

Optional: add `NEXT_PUBLIC_MAPTILER_KEY=` to `.env.local` to use MapTiler for Light and Streets instead.

## Project structure

```
app/                  Next.js pages and global styles
components/map/       map canvas, layers, themes, legend, data loading
components/sidebar/   layer and filter panel
components/panels/    stats panel
components/topbar/    search and view mode
lib/                  shared types and country list
scripts/              prepare_data.py, the data pipeline
```

## Built with

Next.js, React, TypeScript, MapLibre GL, Tailwind CSS, Python, GeoPandas


## Checks

```bash
npm test             # loading, map control, and enquiry regression tests
npm run typecheck    # TypeScript checks
npm run build        # production build
```

GitHub Actions runs these checks for pushes and pull requests to `main`.

## Energy transition data

The committed `public/data/transition/` snapshots add:

| Dataset | Source snapshot | African records | Published usable source coordinates |
|---|---|---:|---:|
| Hydrogen | IEA-derived research workbook dated 5 March 2025 | 112 | 107 |
| Carbon capture / storage | IEA CCUS 2026 via pinned Policy Hub mirror | 11 | 0 |
| Geothermal | GEM March 2026 via TU Berlin/PyPSA mirror | 71 generating units | 71 |
| Power emissions | Climate TRACE API v7, annual 2025, CO₂e AR6 GWP100 | 431 | 431 |

These are source snapshots, not claims of current verified operation or complete African coverage. Hydrogen output values can be source-normalised estimates. Geothermal generating units are distinct from plant sites. Capture, storage, and full-chain capacities can overlap and are not added as unique captured carbon. The older power-plant layer and transition layers remain separate to avoid double counting.

Country/state anchors from the CCUS mirror are deliberately excluded from facility pins. The map instead shows labelled country areas for unlocated records, while keeping every source record searchable in the workspace. Country and project-status filters apply to transition layers. Dataset/record links can enter the atlas with `?dataset=hydrogen&country=KEN&record=hydrogen:123`.

The emissions scenario uses only the selected country's retained 2025 power-sector inventory records (or all represented countries). It applies `baseline * (1 + activity_change / 100) * (1 - reduction / 100)`. It is a user-assumption calculation, not a validated forecast or an estimate of measured avoided emissions. Source activity/capacity fields labelled license-restricted are not republished.

Refresh all four snapshots with Python 3 and network access:

```bash
python3 scripts/prepare_transition_data.py
python3 scripts/prepare_transition_data.py --validate-only
python3 -m unittest discover -s tests -p 'test_*.py'
```

No third-party Python packages are required. The importer validates source schemas and all four datasets before writing; failures do not replace prior data with empty successes. `manifest.json` records exact download URLs, source dates, retrieval time, checksums, mapped counts, coverage, and limitations. The Transition data preparation Action can also be run manually; no recurring schedule is enabled.

The comparison shortlist is stored only in the visitor's browser. CSV exports include source attribution and escape formula-like cells. Scenario exports preserve the baseline scope, inputs, units, method, and source snapshot.

CI runs the Node and Python regression checks, validates committed snapshots, checks TypeScript, builds production, and exercises catalogue loading, filtering, comparisons, exports, map entry, and mobile layout in an isolated Chromium test runner. Browser screenshots are uploaded as a workflow artifact.

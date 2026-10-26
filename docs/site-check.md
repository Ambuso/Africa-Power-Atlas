# Site Check operations

`/site-check` screens a clicked, dragged, manually entered or locally searched African location. It returns the three closest usable source records per category, reported plant capacity by fuel within 10/25/50/100 km, containing-country water context, source dates, and explicit unknowns. It searches mapped records rather than estimating connection capacity. City search uses a local Natural Earth catalogue; no public geocoder receives user queries.

`npm run build` first runs `scripts/build_site_check_index.py`. This requires the committed atlas inputs and telecom snapshots, writes a server-only `.generated/site-check/index.json`, and emits the public city catalogue. Next traces the generated index into both server functions. No network data fetch is required at build time. The index fingerprint hashes the source files. Nearest-route calculations evaluate short great-circle segment interiors, preserve disjoint parts, and use conservative spherical bounds to avoid pruning the true nearest result. Ambiguous antipodal segments are omitted. Distances are approximate, not survey or connection distances.

## Enable private lead capture

The summary works without storage. The email form and PDF gate are disabled until a storage adapter is configured. Missing or failed persistence returns an error; the application never reports an enquiry saved or releases the PDF before storage succeeds.

Preferred Vercel setup: create a **private Vercel Blob store**, connect it to this project for Production (and Preview only if desired), and redeploy. The connection supplies server-only `BLOB_READ_WRITE_TOKEN`. Use a private store; a public store is rejected. Each successful download saves a JSON record at `site-check-leads/<hashed enquiry id>.json`. Open the private store through Vercel to review enquiries. The token and private URLs are never returned to visitors. This adapter uses the version-13 private upload protocol from Vercel's storage SDK; recheck the protocol when changing Blob integration versions.

Alternative: run `database/site-check-leads.sql` in your Supabase SQL editor, then configure server-only `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Legacy `SUPABASE_SERVICE_ROLE_KEY` is also accepted. New `sb_secret_...` keys use the `apikey` header; legacy JWT service-role keys also use Bearer authorization. Never expose these through `NEXT_PUBLIC_` variables. RLS and grants deny anonymous/authenticated access; there is no public lead-list endpoint. Review records using Supabase's authenticated dashboard.

Optionally set a long random `SITE_CHECK_REPORT_SECRET` to sign 15-minute report grants independently of the storage credential. Otherwise the storage credential signs grants. Grants bind site, report ID and dataset fingerprint; email addresses are not embedded. A changed dataset requires a fresh check. Reports are generated as actual multi-page PDF attachments, with private/no-store caching.

Required consent covers storing the submitted email and site enquiry to deliver the report and respond about that check. Marketing is a separate optional checkbox. Expert verification saves an enquiry; it does not imply an agreed fee, deadline or verification outcome. Submission does not verify email ownership. This implementation saves enquiries; it does not send emails or automatically subscribe visitors to a mailing list. Do not describe it as an email-verification service. To act on enquiries, review the private store and use your business inbox. Set a retention/deletion process appropriate to your operations before collecting production leads; deletion is performed in the private dashboard.

Requests enforce same-origin browser submissions, JSON body limits, consent, email validation, a honeypot and best-effort per-instance throttling. The in-memory throttle is bounded; it is not a distributed quota or a substitute for monitoring abuse. Both POST routes and PDF responses are uncached.

## Data and reuse

Substations retain source voltage tags in volts despite a legacy `voltage_kv` filename property. Transmission voltage units are treated as kV only for primary-source records with source status; ambiguous fallback values remain unverified. Historical source releases and approximate curated data-centre locations are disclosed. Missing MW remains missing. Water context is country-level WRI Aqueduct data joined to generalised polygons; an unscored, overlapping or absent polygon returns unknown, without nearest-country substitution.

New landing-station and terrestrial-fibre snapshots use explicitly tagged OSM records with ODbL attribution. Fibre requires explicit fibre-medium tags; generic communications lines are not assumed optical. Way/relation station centres are labelled bounding-box centres. Coarse country polygons can omit coastal infrastructure. Empty results are coverage gaps. Source query, extraction time and counts are recorded in `telecom-manifest.json`.

Site Check does **not** reuse TeleGeography raw cable geometry from the existing atlas: commercial raw-data rights require a separate licence. Existing atlas displays are unchanged. A source record does not establish a physical connection offer or service availability.

Run `.github/workflows/site-check-data.yml` manually on the branch you intend to update to refresh OSM snapshots; it retains existing data on acquisition failure. No recurring refresh or maintenance promise is enabled. Review source differences and CI before merging future snapshots.

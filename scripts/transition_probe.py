import urllib.request,json,sqlite3,tempfile,os
URLS={
"hydrogen":"https://data.kapsarc.org/api/explore/v2.1/catalog/datasets/iea-hydrogen-projects-database-2021-revised/exports/json",
"geothermal":"https://publicgemdata.nyc3.cdn.digitaloceanspaces.com/geothermal/2026-03/geothermal_map_2026-02-13.geojson",
"ccs":"https://raw.githubusercontent.com/liuh886/ccus-policy-hub/main/agent/ccus-ai-agent/db/ccus_master.sqlite",
}
for key,url in URLS.items():
 print("\nSOURCE",key,url,flush=True)
 try:
  b=urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=100).read()
  print("BYTES",len(b))
  if key=="ccs":
   p=tempfile.mktemp(suffix=".sqlite");open(p,"wb").write(b)
   c=sqlite3.connect(p);c.row_factory=sqlite3.Row
   print("SCHEMA",list(c.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('facilities','facility_i18n')")))
   for row in c.execute("SELECT f.*,i.* FROM facilities f JOIN facility_i18n i ON f.id=i.facility_id AND i.lang='en' WHERE f.country IN ('Algeria','Egypt','South Africa','DZA','EGY','ZAF') LIMIT 4"): print(json.dumps(dict(row),ensure_ascii=False)[:8000])
   print("COUNTRIES",c.execute("SELECT DISTINCT country FROM facilities").fetchall()[:10])
   os.unlink(p)
  else:
   d=json.loads(b)
   if isinstance(d,list):print("COUNT",len(d),"SAMPLE",json.dumps(d[:2],ensure_ascii=False)[:12000])
   elif "features" in d:print("COUNT",len(d["features"]),"SAMPLE",json.dumps(d["features"][:2],ensure_ascii=False)[:12000])
   else:print(json.dumps(d)[:12000])
 except Exception as e:print(type(e).__name__,str(e))

import urllib.request, re, json
PAGES = [
"https://www.iea.org/data-and-statistics/data-product/hydrogen-production-and-infrastructure-projects-database",
"https://www.iea.org/data-and-statistics/data-product/carbon-capture-utilisation-and-storage-projects-database",
"https://globalenergymonitor.org/projects/global-geothermal-power-tracker/",
]
for url in PAGES:
 print("\nPAGE", url)
 try:
  req=urllib.request.Request(url, headers={"User-Agent":"MapKwetu-research/1.0 (public open-data ingestion)"})
  html=urllib.request.urlopen(req,timeout=60).read().decode()
  print("LENGTH",len(html))
  for pattern in [r'.{0,250}xlsx.{0,350}',r'.{0,120}blob.core.windows.net.{0,250}',r'.{0,100}downloadUrl.{0,250}',r'.{0,80}api.iea.org.{0,180}',r'.{0,120}geothermal.{0,150}csv.{0,120}']:
   for m in re.findall(pattern,html,re.I)[:20]: print(m)
 except Exception as e:print(type(e).__name__,str(e))
url="https://api.climatetrace.org/v7/sources?year=2025&gas=co2e_100yr&sectors=power&continent=Africa&limit=1000&offset=0"
print("\nEMISSIONS",url)
try:
 data=json.load(urllib.request.urlopen(url,timeout=90))
 print("TYPE",type(data).__name__,"LENGTH",len(data))
 print(json.dumps(data[:2] if isinstance(data,list) else data)[:9000])
except Exception as e:print(type(e).__name__,str(e))

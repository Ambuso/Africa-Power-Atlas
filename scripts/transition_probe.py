import urllib.request,json,sqlite3,tempfile,os,zipfile,io,xml.etree.ElementTree as ET
URLS={
"hydrogen":"https://raw.githubusercontent.com/NkJoseph/CCUS-impact-H2-Scalability/c8bc34d6c407194209bff7d58a8e70052a2a531d/IEA%20Hydrogen%20Production%20Projects%20Database_update_5_March_2025.xlsx",
"geothermal":"https://tubcloud.tu-berlin.de/s/spGtyE3oPZrMeB3/download/Geothermal-Power-Tracker-March-2026-Final.xlsx",
"geothermal_primary":"https://globalenergymonitor.org/wp-content/uploads/2026/03/Geothermal-Power-Tracker-March-2026-Final.xlsx",
"ccs":"https://raw.githubusercontent.com/liuh886/ccus-policy-hub/d48c2960b882c51c1be26d1ba634152f7823175b/agent/ccus-ai-agent/db/ccus_master.sqlite",
}
for key,url in URLS.items():
 print("\nSOURCE",key,url,flush=True)
 try:
  b=urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=100).read()
  print("BYTES",len(b),"SIGNATURE",repr(b[:20]))
  if key=="ccs":
   p=tempfile.mktemp(suffix=".sqlite");open(p,"wb").write(b)
   c=sqlite3.connect(p);c.row_factory=sqlite3.Row
   print("COUNTRIES", [tuple(r) for r in c.execute("SELECT DISTINCT country FROM facilities")])
   for row in c.execute("SELECT f.*,i.* FROM facilities f JOIN facility_i18n i ON f.id=i.facility_id AND i.lang='en' LIMIT 2"): print("ROW",json.dumps(dict(row),ensure_ascii=False)[:7000])
   print("AFRICA", [dict(r) for r in c.execute("SELECT f.id,f.country,f.precision,f.lat,f.lng,i.name FROM facilities f JOIN facility_i18n i ON f.id=i.facility_id AND i.lang='en' WHERE f.country IN ('DZ','EG','ZA','MA','KE')")])
   os.unlink(p)
  else:
   z=zipfile.ZipFile(io.BytesIO(b));ns={"s":"http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
   strings=[]
   if "xl/sharedStrings.xml" in z.namelist():strings=["".join(n.itertext()) for n in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("s:si",ns)]
   print("SHEETS",z.read("xl/workbook.xml").decode()[:1800])
   for name in z.namelist():
    if not name.startswith("xl/worksheets/sheet") or not name.endswith(".xml"):continue
    root=ET.fromstring(z.read(name));rows=[]
    for row in root.findall("s:sheetData/s:row",ns)[:6]:
     values=[]
     for cell in row.findall("s:c",ns):
      v=cell.find("s:v",ns);value=v.text if v is not None else "".join(cell.find("s:is",ns).itertext()) if cell.find("s:is",ns) is not None else ""
      if cell.get("t")=="s" and value:value=strings[int(value)]
      values.append(cell.get("r")+":"+str(value))
     rows.append(values)
    print("ROWS",name,json.dumps(rows,ensure_ascii=False)[:14000])
 except Exception as e:print(type(e).__name__,str(e))

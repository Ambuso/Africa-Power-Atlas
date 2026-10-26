const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadTypeScript}=require('./helpers.cjs');
const globals={Buffer,process,Request,Response,URL,AbortSignal,fetch};
const geo=loadTypeScript('lib/site-check.ts');
const server=loadTypeScript('lib/site-check-server.ts',globals);
const site={longitude:0,latitude:0,label:'Test (site)',radiusKm:50};
const polygon={type:'Polygon',coordinates:[[[-2,-2],[2,-2],[2,2],[-2,2],[-2,-2]],[[.5,.5],[1.5,.5],[1.5,1.5],[.5,1.5],[.5,.5]]]};
function fixture(){return {version:'fixture-v1',preparedAt:'2026-01-01',countries:[{geometry:polygon,properties:{name:'Test country'}}],water:[{geometry:polygon,properties:{name:'Test country',bws_score:0,stress_class:'Low'}}],layers:Object.fromEntries(geo.SITE_LAYERS.map(key=>[key,{assets:[],source:{name:key,release:'Test source date',url:'https://example.com',count:0,omitted:0,note:'Fixture'}}]))};}
test('distance uses segment interior and keeps disjoint parts separate',()=>{
 assert.ok(Math.abs(geo.distanceKm([0,0],[1,0])-111.19508)<.001);
 assert.ok(Math.abs(geo.segmentDistanceKm([0,1],[-2,0],[2,0])-111.19508)<.001);
 assert.ok(geo.geometryDistanceKm([0,0],{type:'MultiLineString',coordinates:[[[-5,0],[-4,0]],[[4,0],[5,0]]]})>440);
 assert.throws(()=>geo.segmentDistanceKm([0,1],[0,0],[180,0]),/antipodal/);
});
test('polygon holes and boundaries do not invent country coverage',()=>{
 assert.equal(geo.polygonMatch([0,0],polygon),'inside');assert.equal(geo.polygonMatch([1,1],polygon),'outside');assert.equal(geo.polygonMatch([.5,1],polygon),'boundary');
 const index=fixture();assert.equal(geo.analyseSite(site,index).water.score,0);
 assert.equal(geo.analyseSite({...site,longitude:3},index).water.score,null);
 index.water.push(index.water[0]);assert.equal(geo.analyseSite(site,index).water.score,null);
});
test('voltage normalisation respects source units',()=>{
 assert.equal(geo.voltageLabel('220000;33000','V'),'220 / 33 kV');assert.equal(geo.voltageLabel('220','kV'),'220 kV');assert.match(geo.voltageLabel('220','unknown'),/unverified/);assert.throws(()=>geo.validateSiteSpec({...site,latitude:NaN}));
});
test('fuel mix preserves missing capacities and search bounds find route interiors',()=>{
 const index=fixture();const asset=(id,geometry,sphere)=>({id,name:id,geometry,sphere,capacityMW:null,fuel:'Solar',voltageRaw:'',voltageUnit:'unknown',status:'Unknown',accuracy:'Unknown',country:'Test',sourceUrl:'https://example.com'});
 index.layers.plants.assets=[asset('missing',{type:'Point',coordinates:[0,0]},{centre:[0,0],radiusKm:0})];
 const report=geo.analyseSite(site,index);assert.equal(report.fuelMix[0].missingCapacity,1);assert.equal(report.fuelMix[0].reportedMW,0);
 const routes=[asset('line',{type:'LineString',coordinates:[[-5,0],[5,0]]},{centre:[0,0],radiusKm:557}),asset('point',{type:'Point',coordinates:[0,1]},{centre:[0,1],radiusKm:0})];assert.equal(geo.nearestAssets([0,0],routes,1)[0].asset.id,'line');
});
test('PDF contains report and correct cross-reference offsets',()=>{
 const {createSiteCheckPdf}=loadTypeScript('lib/site-check-pdf.ts',{Buffer});const report=geo.analyseSite(site,fixture());report.id='report-123';const pdf=createSiteCheckPdf(report).toString('ascii');
 assert.ok(pdf.startsWith('%PDF-1.4'));assert.ok(pdf.includes('report-123'));assert.ok(pdf.includes('UNKNOWNS TO VERIFY'));const xref=Number(pdf.match(/startxref\n(\d+)/)[1]);assert.equal(pdf.slice(xref,xref+4),'xref');
 const entries=pdf.slice(xref).split('\n').slice(3).filter(x=>/^\d{10} 00000 n/.test(x));entries.forEach((line,i)=>assert.ok(pdf.slice(Number(line.slice(0,10))).startsWith(`${i+1} 0 obj`)));
});
test('report grant rejects alteration and expired requests',()=>{
 const config={reportSecret:'test-secret'};const grant=server.signReportGrant(site,'id','v1',config,1000000);assert.equal(server.verifyReportGrant(grant,config,1000001).reportId,'id');assert.throws(()=>server.verifyReportGrant(grant+'x',config,1000001));assert.throws(()=>server.verifyReportGrant(grant,config,2000000));
});
test('private persistence rejects missing storage, failures and public Blob URLs',async()=>{
 const lead={id:'lead-123',email:'test@example.com'};
 await assert.rejects(server.persistSiteCheckLead(lead,{}));
 await assert.rejects(server.persistSiteCheckLead(lead,{blobToken:'vercel_blob_rw_store_secret'},async()=>Response.json({url:'https://store.public.blob.vercel-storage.com/a'})));
 await assert.rejects(server.persistSiteCheckLead(lead,{supabaseUrl:'https://example.supabase.co',supabaseKey:'sb_secret_test'},async()=>new Response('',{status:500})));
 let stored;await server.persistSiteCheckLead(lead,{supabaseUrl:'https://example.supabase.co',supabaseKey:'sb_secret_test'},async(url,options)=>{stored=options;return new Response(null,{status:201});});assert.equal(stored.headers.apikey,'sb_secret_test');assert.equal(stored.headers.Authorization,undefined);assert.equal(JSON.parse(stored.body).email,lead.email);
});
test('PDF route returns no document when saving fails, and saves before attachment',async()=>{
 let saves=0,fail=false;const index=fixture();
 const adapter={...server,leadStorageConfig:()=>({reportSecret:'test',supabaseUrl:'https://example.com',supabaseKey:'test'}),loadSiteIndex:async()=>index,verifyReportGrant:()=>({site,version:index.version,reportId:'report-123'}),persistSiteCheckLead:async lead=>{saves++;assert.equal(lead.marketing_consent,false);if(fail)throw new server.SiteCheckRequestError('Storage unavailable',503);}};
 const route=loadTypeScript('app/api/site-check/report/route.ts',globals,{'@/lib/site-check-server':adapter});
 const request=consent=>new Request('https://mapkwetu.test/api/site-check/report',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:'test',email:'test@example.com',consent})});
 assert.equal((await route.POST(request(false))).status,400);assert.equal(saves,0);
 fail=true;const rejected=await route.POST(request(true));assert.equal(rejected.status,503);assert.match(rejected.headers.get('content-type'),/json/);
 fail=false;const success=await route.POST(request(true));assert.equal(success.status,200);assert.equal(saves,2);assert.match(success.headers.get('content-type'),/pdf/);assert.equal(success.headers.get('cache-control'),'private, no-store');assert.ok((await success.text()).startsWith('%PDF'));
});
test('request parser rejects cross-origin, oversized and malformed input',async()=>{
 const make=(body,headers={})=>new Request('https://mapkwetu.test/api/site-check',{method:'POST',headers:{'content-type':'application/json',...headers},body});
 await assert.rejects(server.readSiteRequest(make('{}',{origin:'https://unrelated.example'})),error=>error.status===403);
 await assert.rejects(server.readSiteRequest(make('x'.repeat(8193))),error=>error.status===413);
 await assert.rejects(server.readSiteRequest(make('{broken')),error=>error.status===400);
});
test('same-origin checks use the public host behind a Next server proxy',async()=>{
 const request=new Request('http://localhost:4173/api/site-check',{method:'POST',headers:{host:'127.0.0.1:4173',origin:'http://127.0.0.1:4173','content-type':'application/json'},body:'{"label":"test"}'});
 assert.equal((await server.readSiteRequest(request)).label,'test');
});

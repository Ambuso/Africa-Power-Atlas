import type { SiteReport } from './site-check';

const ascii = (value: string) => value.replaceAll('₂', '2').replaceAll('₃', '3').replaceAll('→', '->').replaceAll('—', '-').replaceAll('–', '-').replaceAll('’', "'").normalize('NFKD').replace(/[^\x20-\x7e\n]/g, '');
const escape = (value: string) => ascii(value).replace(/([\\()])/g, '\\$1');
function wrap(value: string, width = 91): string[] {
  const result: string[] = [];
  for (let line of ascii(value).split('\n')) {
    while (line.length > width) { let split = line.lastIndexOf(' ', width); if (split < width / 3) split = width; result.push(line.slice(0, split)); line = line.slice(split).trimStart(); }
    result.push(line);
  }
  return result;
}

/** Self-contained text PDF using standard PDF fonts; never a print-dialog stub. */
export function createSiteCheckPdf(report: SiteReport): Buffer {
  const lines: string[] = [];
  const add = (text = '') => lines.push(...wrap(text));
  add('MAPKWETU | SITE CHECK'); add('Infrastructure screening report'); add();
  add(report.site.label); add(`Coordinates: ${report.site.latitude.toFixed(6)}, ${report.site.longitude.toFixed(6)}`);
  add(`Country context: ${report.country} | Search radius: ${report.site.radiusKm} km`);
  add(`Generated: ${report.createdAt} | Report: ${report.id}`); add(`Data fingerprint: ${report.version}`); add();
  add('SCREENING CONTEXT'); add('This report describes mapped source records. It is not a feasibility study or a connection assessment. Read the unknowns and source dates before acting.'); add();
  const titles = { substations: 'SUBSTATIONS', transmission: 'TRANSMISSION ROUTES', plants: 'POWER PLANTS', dataCentres: 'DATA CENTRES', landingStations: 'CABLE LANDING STATIONS', fibreRoutes: 'MAPPED TERRESTRIAL FIBRE' };
  for (const [key, title] of Object.entries(titles)) {
    add(title);
    const entries = report.nearest[key as keyof typeof report.nearest];
    if (!entries.length) add('No usable mapped source records are available in this dataset.');
    entries.forEach((asset, index) => {
      add(`${index + 1}. ${asset.name} - ${asset.distanceKm.toFixed(2)} km${asset.withinRadius ? '' : ' (outside search radius)'}`);
      add(`   Voltage: ${asset.voltage} | Fuel: ${asset.fuel || 'not reported'} | Reported capacity: ${asset.capacityMW === null ? 'not reported' : `${asset.capacityMW} MW`}`);
      add(`   Source status: ${asset.status || 'not reported'} | Location: ${asset.accuracy}`);
      add(`   Source: ${asset.sourceUrl}`);
    }); add();
  }
  add(`GENERATION MIX WITHIN ${report.site.radiusKm} KM`);
  report.fuelMix.forEach((group) => add(`${group.fuel}: ${group.plants} plant records; ${group.reportedMW.toFixed(1)} reported MW; ${group.missingCapacity} records without reported capacity.`));
  if (!report.fuelMix.length) add('No mapped plant records within the selected radius.'); add();
  add('WATER CONTEXT'); add(`${report.water.country}: ${report.water.category}; score ${report.water.score === null ? 'not available' : report.water.score.toFixed(2)}. ${report.water.scope}. ${report.water.note}`); add();
  add('UNKNOWNS TO VERIFY'); report.unknowns.forEach((item) => { add(`- ${item}`); add(); });
  add('METHOD'); report.methodology.forEach((item) => { add(`- ${item}`); add(); });
  add('SOURCES AND COVERAGE');
  Object.values(report.sources).forEach((source) => { add(`${source.name} | ${source.release} | ${source.count} usable source records`); add(source.url); add(source.note); add(); });
  add('Water: WRI Aqueduct 4.0 country rankings. Boundaries and city search: Natural Earth.');
  add('OpenStreetMap-derived records: copyright OpenStreetMap contributors, ODbL 1.0. https://www.openstreetmap.org/copyright');
  add('MapKwetu: https://africapowergrid.vercel.app/site-check');
  const pages: string[][] = []; for (let i = 0; i < lines.length; i += 48) pages.push(lines.slice(i, i + 48));
  const objects: string[] = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids: string[] = [];
  pages.forEach((page, index) => {
    const pageId = objects.length + 1, contentId = pageId + 1; kids.push(`${pageId} 0 R`);
    const content = `BT /F1 10 Tf 14 TL 42 800 Td ${page.map((line) => `(${escape(line)}) Tj T*`).join('\n')} ET\nBT /F1 8 Tf 42 27 Td (MapKwetu - preliminary screening | Page ${index + 1} of ${pages.length}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream`);
  });
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'; objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, 'ascii')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'ascii'); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}

import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, ChevronRight, Download, Globe2, Layers3, MapPin, MoveUpRight, Radio, Search, Waves, Zap } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/marketing/Brand';
import EnquiryForm from '@/components/marketing/EnquiryForm';

export default function HomePage() {
  const contactEmail = process.env.MAPKWETU_CONTACT_EMAIL || '';
  return (
    <main className="kw-site kw-home">
      <SiteHeader />
      <section className="kw-hero" aria-labelledby="hero-title">
        <div className="kw-hero-copy">
          <Link className="kw-announcement" href="/intelligence"><span>New</span> Introducing Atlas Intelligence <ArrowRight size={14} /></Link>
          <h1 id="hero-title">Better context.<br /><span>For Africa’s energy future.</span></h1>
          <p className="kw-hero-description">Screen Kenyan project locations. Compare infrastructure.<br className="kw-desktop-break" /> Know what to investigate next.</p>
          <div className="kw-actions"><Link className="kw-button" href="/intelligence">Open Atlas Intelligence <ArrowRight size={16} /></Link><Link className="kw-text-link" href="/atlas">Explore Africa’s atlas <ChevronRight size={15} /></Link></div>
          <p className="kw-hero-assurance">Free to explore <span>·</span> Public data <span>·</span> Traceable sources</p>
        </div>
        <div className="kw-product-preview">
          <div className="kw-preview-toolbar"><div className="kw-window-dots" aria-hidden="true"><i /><i /><i /></div><span><Globe2 size={12} /> MapKwetu Atlas</span><Link href="/atlas">Open workspace <ArrowUpRight size={13} /></Link></div>
          <div className="kw-preview-body">
            <aside className="kw-preview-sidebar" aria-label="Preview atlas layers">
              <div className="kw-preview-brand"><Globe2 size={19} /> MapKwetu <span>ATLAS</span></div>
              <Link href="/atlas" className="kw-preview-search"><Search size={13} /> Explore a location <span>↗</span></Link>
              <p className="kw-preview-label">YOUR LAYERS</p>
              <Link href="/atlas" className="kw-preview-layer kw-preview-layer-active"><Zap size={15} /><span>Power plants</span><i /></Link>
              <Link href="/atlas" className="kw-preview-layer"><Radio size={15} /><span>Grid & substations</span><i /></Link>
              <Link href="/atlas" className="kw-preview-layer"><Layers3 size={15} /><span>Data centres</span><i /></Link>
              <Link href="/atlas" className="kw-preview-layer"><Waves size={15} /><span>Subsea cables</span><i /></Link>
              <div className="kw-preview-sidebar-note"><span className="kw-status-dot" /> A continent, in context.<p>Explore the connections.<br />Understand the possibilities.</p><Link href="/sources">View source notes <ArrowUpRight size={12} /></Link></div>
            </aside>
            <div className="kw-map-stage">
              <div className="kw-map-heading"><span><span className="kw-status-dot" /> AFRICA / INFRASTRUCTURE</span><span>ATLAS PREVIEW</span></div>
              <img className="kw-africa-art" src="/mapkwetu-atlas.svg" alt="Atlas preview of Africa with country boundaries and power plant records. Marker colours indicate fuel types." width="720" height="760" fetchPriority="high" />
              <div className="kw-preview-coordinate">0° 00′ N &nbsp; 20° 00′ E</div>
              <Link href="/site-check" className="kw-map-tag kw-map-tag-a"><span className="kw-preview-pin"><MapPin size={16} /></span><div>A better place to begin<small>Check the context around your site</small></div><ArrowUpRight size={14} /></Link>
              <Link href="/atlas" className="kw-map-open" aria-label="Open the interactive atlas"><ArrowUpRight size={20} /></Link>
              <div className="kw-map-caption"><span><i /> Power plant records</span><Link href="/sources">Natural Earth / WRI ↗</Link></div>
            </div>
          </div>
        </div>
        <div className="kw-preview-under"><span>THE BIGGER PICTURE STARTS HERE</span><span>One place to connect the dots. <ArrowRight size={13} /></span></div>
      </section>

      <div className="kw-layer-strip" aria-label="Atlas layers"><span>ONE MAP.<br /><strong>MORE CONTEXT.</strong></span><span><Zap /> Power plants</span><span><Radio /> Grid & substations</span><span><Layers3 /> Data centres</span><span><Waves /> Subsea cables</span><span><MapPin /> Water stress</span></div>

      <section id="research" className="kw-research" aria-labelledby="research-title">
        <div className="kw-section-heading"><p className="kw-eyebrow">FROM EXPLORATION TO A CLEARER BRIEF</p><div><h2 id="research-title">Bring a place.<br />Bring a question.</h2><p>Start with the atlas. When your project needs more context, define a focused research brief for a country, a shortlist of locations, or a dashboard built around your work.</p></div></div>
        <div className="kw-services">
          <article><span className="kw-service-number">01 / COUNTRY CONTEXT</span><div className="kw-service-graphic kw-graphic-country"><span>KENYA</span><MapPin size={39} /><i /><i /><i /></div><h3>Understand the landscape.</h3><p>Scope a country briefing around generation, grid infrastructure, digital connections, and the gaps that need further research.</p><ul><li><Check /> Source notes and data dates</li><li><Check /> A focused list of research questions</li></ul><a href="#request">Prepare a country brief <ArrowUpRight size={17} /></a></article>
          <article><span className="kw-service-number">02 / LOCATION COMPARISON</span><div className="kw-service-graphic kw-graphic-compare"><div><span>LOCATION A</span><i /><i /><i /></div><span>↔</span><div><span>LOCATION B</span><i /><i /><i /></div></div><h3>Ask better site questions.</h3><p>Frame a comparison of candidate locations, nearby infrastructure, and water context before detailed fieldwork or engineering studies.</p><ul><li><Check /> Your locations and requirements</li><li><Check /> Explicit assumptions and missing data</li></ul><a href="#request">Prepare a comparison brief <ArrowUpRight size={17} /></a></article>
          <article><span className="kw-service-number">03 / CUSTOM DASHBOARDS</span><div className="kw-service-graphic kw-graphic-dashboard"><div><span /><span /><span /></div><div><i /><i /><i /><i /></div></div><h3>Make the map fit your work.</h3><p>Describe a dashboard that combines your permitted datasets with geographic context, filters, and views for your team.</p><ul><li><Check /> Your layers and workflows</li><li><Check /> A scope agreed before delivery</li></ul><a href="#request">Prepare a dashboard brief <ArrowUpRight size={17} /></a></article>
        </div>
        <p className="kw-service-note">Custom research and dashboards are scoped by enquiry. A brief is a starting point; scope, availability, fees, and delivery are agreed separately.</p>
      </section>

      <section className="kw-transition-banner"><div><p className="kw-eyebrow">NEW / ENERGY TRANSITION WORKSPACE</p><h2>The projects behind the transition.</h2><p>Explore hydrogen, carbon capture, geothermal units, and power-sector emissions. Filter source-linked records, compare a shortlist, and test an emissions scenario with visible assumptions.</p></div><Link href="/datasets" className="kw-button">Explore transition datasets <ArrowUpRight size={18} /></Link></section>

      <section className="kw-method" aria-labelledby="method-title"><div><p className="kw-eyebrow">KNOW WHAT YOU’RE LOOKING AT</p><h2 id="method-title">Good context starts<br />with honest data.</h2><Link className="kw-text-link" href="/sources">Read the source notes <ArrowUpRight size={18} /></Link></div><div className="kw-method-details"><p>The atlas brings together public datasets with different dates and levels of coverage. Its totals describe the records loaded into the map, rather than a complete current inventory of African infrastructure.</p><div><span>01</span><p><strong>Traceable sources</strong>See where each layer comes from and what it represents.</p></div><div><span>02</span><p><strong>Clear limits</strong>Nearby infrastructure does not establish connection access, available capacity, or project feasibility.</p></div><div><span>03</span><p><strong>A practical starting point</strong>Use the map to guide further research and conversations with local operators.</p></div></div></section>

      <section className="kw-request" id="request" aria-labelledby="request-title"><div className="kw-request-copy"><p className="kw-eyebrow">LET’S MAKE IT SPECIFIC</p><h2 id="request-title">Your next project<br />starts with<br /><span>a good question.</span></h2><p>Tell us where you’re looking, what you’re trying to understand, and what a useful result would look like.</p><div className="kw-request-process"><span><MapPin size={18} /> Choose your focus</span><span><Download size={18} /> Keep a copy of your brief</span><span><MoveUpRight size={18} /> Agree the next step</span></div></div><EnquiryForm contactEmail={contactEmail} /></section>
      <SiteFooter />
    </main>
  );
}

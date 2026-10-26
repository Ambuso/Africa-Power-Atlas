import Link from 'next/link';
import { ArrowUpRight, Check, Download, Layers3, MapPin, MoveUpRight, Radio, Waves, Zap } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/marketing/Brand';
import EnquiryForm from '@/components/marketing/EnquiryForm';

export default function HomePage() {
  const contactEmail = process.env.MAPKWETU_CONTACT_EMAIL || '';
  return (
    <main className="kw-site">
      <SiteHeader />
      <section className="kw-hero" aria-labelledby="hero-title">
        <div className="kw-hero-copy">
          <p className="kw-eyebrow"><span /> AFRICA, IN CONTEXT</p>
          <h1 id="hero-title">See the connections.<br /><span>Find your next<br className="kw-desktop-break" /> starting point.</span></h1>
          <p className="kw-hero-description">Power. Connectivity. Place. Explore the infrastructure shaping Africa, together on one map.</p>
          <div className="kw-actions"><Link className="kw-button" href="/atlas">Explore the free atlas <ArrowUpRight size={18} /></Link><a className="kw-text-link" href="#research">For your next project <span aria-hidden="true">↓</span></a></div>
          <div className="kw-hero-footnote"><span className="kw-tiny-map">↗</span><span>Open exploration. Sourced data.<br /><strong>A continent of possibilities.</strong></span></div>
        </div>
        <div className="kw-map-stage">
          <div className="kw-map-heading"><span><span className="kw-status-dot" /> THE MAPKWETU ATLAS</span><span>01 / AFRICA</span></div>
          <img className="kw-africa-art" src="/mapkwetu-atlas.svg" alt="Map of Africa showing country boundaries and power plant records from the atlas. Marker colours indicate fuel types." width="720" height="760" fetchPriority="high" />
          <div className="kw-map-tag kw-map-tag-a"><Zap size={14} /><div>Energy networks<small>See what connects a region</small></div></div>
          <div className="kw-map-tag kw-map-tag-b"><Waves size={14} /><div>Digital connections<small>Explore cable routes in the atlas</small></div></div>
          <Link href="/atlas" className="kw-map-open" aria-label="Open the interactive atlas"><ArrowUpRight size={25} /></Link>
          <div className="kw-map-caption">A view of the dataset · Natural Earth / WRI <Link href="/sources">Source notes ↗</Link></div>
        </div>
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

      <section className="kw-method" aria-labelledby="method-title"><div><p className="kw-eyebrow">KNOW WHAT YOU’RE LOOKING AT</p><h2 id="method-title">Good context starts<br />with honest data.</h2><Link className="kw-text-link" href="/sources">Read the source notes <ArrowUpRight size={18} /></Link></div><div className="kw-method-details"><p>The atlas brings together public datasets with different dates and levels of coverage. Its totals describe the records loaded into the map, rather than a complete current inventory of African infrastructure.</p><div><span>01</span><p><strong>Traceable sources</strong>See where each layer comes from and what it represents.</p></div><div><span>02</span><p><strong>Clear limits</strong>Nearby infrastructure does not establish connection access, available capacity, or project feasibility.</p></div><div><span>03</span><p><strong>A practical starting point</strong>Use the map to guide further research and conversations with local operators.</p></div></div></section>

      <section className="kw-request" id="request" aria-labelledby="request-title"><div className="kw-request-copy"><p className="kw-eyebrow">LET’S MAKE IT SPECIFIC</p><h2 id="request-title">Your next project<br />starts with<br /><span>a good question.</span></h2><p>Tell us where you’re looking, what you’re trying to understand, and what a useful result would look like.</p><div className="kw-request-process"><span><MapPin size={18} /> Choose your focus</span><span><Download size={18} /> Keep a copy of your brief</span><span><MoveUpRight size={18} /> Agree the next step</span></div></div><EnquiryForm contactEmail={contactEmail} /></section>
      <SiteFooter />
    </main>
  );
}

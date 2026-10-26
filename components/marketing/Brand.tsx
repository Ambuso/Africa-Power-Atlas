import Link from 'next/link';

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`kw-brand${light ? ' kw-brand-light' : ''}`} aria-label="MapKwetu home">
      <svg viewBox="0 0 36 36" aria-hidden="true"><path d="m5 10 9-4 9 4 8-4v23l-8 3-9-4-9 4z" fill="currentColor"/><path d="M14 7v20M23 10v21" stroke="var(--kw-paper, #f4f3ec)" strokeWidth="1.5"/><circle cx="23" cy="15" r="5" fill="#d9f273"/><circle cx="23" cy="15" r="2" fill="#153c36"/></svg>
      <span>Map<span className="kw-brand-soft">Kwetu</span><span className="kw-brand-period">.</span></span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="kw-header">
      <Brand />
      <nav aria-label="Main navigation">
        <Link href="/atlas">Atlas</Link>
        <Link href="/datasets">Datasets</Link>
        <Link href="/transition">Transition workspace</Link>
        <Link href="/sources">Sources</Link>
      </nav>
      <Link href="/#request" className="kw-button kw-button-small kw-header-cta">Prepare a brief <span aria-hidden="true">↗</span></Link>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="kw-footer">
      <div><Brand light /><p>Our continent. A clearer picture.</p></div>
      <nav aria-label="Footer navigation"><Link href="/atlas">Open atlas ↗</Link><Link href="/datasets">Datasets</Link><Link href="/transition">Workspace</Link><Link href="/sources">Sources & methodology</Link><a href="https://github.com/Ambuso/Africa-Power-Atlas" target="_blank" rel="noreferrer">GitHub ↗</a></nav>
      <span>Built by Ambuso · MapKwetu {new Date().getFullYear()}</span>
    </footer>
  );
}

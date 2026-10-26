'use client';

import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, Download } from 'lucide-react';
import { enquiryMailto, formatEnquiryBrief, type EnquiryBrief } from '@/lib/enquiry';

export default function EnquiryForm({ contactEmail }: { contactEmail: string }) {
  const [status, setStatus] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const brief: EnquiryBrief = {
      name: String(form.get('name') || ''), email: String(form.get('email') || ''),
      organisation: String(form.get('organisation') || ''), service: String(form.get('service') || ''),
      geography: String(form.get('geography') || ''), question: String(form.get('question') || ''),
    };
    const blob = new Blob([formatEnquiryBrief(brief)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mapkwetu-project-brief.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (contactEmail) {
      window.location.href = enquiryMailto(contactEmail, brief);
      setStatus('Your brief is downloaded and your email app has been opened. Send the email there to make your enquiry.');
    } else {
      setStatus('Your brief is downloaded. Nothing has been submitted or sent. Keep the file to share when you arrange your enquiry.');
    }
  }

  return (
    <form className="kw-enquiry-form" onSubmit={submit}>
      <div className="kw-form-heading"><span className="kw-eyebrow">PROJECT BRIEF</span><span>01 / YOUR CONTEXT</span></div>
      <div className="kw-form-row"><label>Your name<input name="name" autoComplete="name" required maxLength={100} placeholder="Full name" /></label><label>Work email<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@organisation.com" /></label></div>
      <label>Organisation <span className="kw-optional">(optional)</span><input name="organisation" autoComplete="organization" maxLength={150} placeholder="Company or organisation" /></label>
      <label>What do you need?<select name="service" defaultValue="Country briefing"><option>Country briefing</option><option>Location comparison</option><option>Custom dashboard</option><option>Something else</option></select></label>
      <label>Where are you looking?<input name="geography" required maxLength={300} placeholder="e.g. Kenya, or Nairobi and Mombasa" /></label>
      <label>What would you like to understand?<textarea name="question" required minLength={20} maxLength={2000} rows={4} placeholder="Describe your project, the decisions you’re exploring, and the information you need…" /></label>
      <p className="kw-form-privacy">{contactEmail ? 'Your brief is prepared on your device. You review and send the enquiry in your email app.' : 'This form creates a brief on your device. It does not submit an enquiry or send your information to MapKwetu.'}</p>
      <button className="kw-button" type="submit">{contactEmail ? 'Prepare email & download brief' : 'Download project brief'}{contactEmail ? <ArrowUpRight size={18} /> : <Download size={18} />}</button>
      {status && <p className="kw-form-status" role="status"><Check size={17} />{status}</p>}
    </form>
  );
}

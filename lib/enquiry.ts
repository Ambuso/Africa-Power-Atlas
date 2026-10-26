export interface EnquiryBrief {
  name: string;
  email: string;
  organisation: string;
  service: string;
  geography: string;
  question: string;
}

export function formatEnquiryBrief(brief: EnquiryBrief): string {
  return [
    'MapKwetu — project enquiry', '',
    `Name: ${brief.name.trim()}`,
    `Email: ${brief.email.trim()}`,
    `Organisation: ${brief.organisation.trim() || 'Not specified'}`,
    `Research focus: ${brief.service}`,
    `Countries / locations: ${brief.geography.trim()}`, '',
    'Project question:', brief.question.trim(), '',
    'Please discuss scope, availability, fees, and delivery before starting work.',
  ].join('\n');
}

export function enquiryMailto(recipient: string, brief: EnquiryBrief): string {
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(`MapKwetu enquiry: ${brief.service}`)}&body=${encodeURIComponent(formatEnquiryBrief(brief))}`;
}

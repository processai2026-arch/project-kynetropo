import type { ReactNode } from 'react';

interface InlineFieldProps {
  label: string;
  value?: string | number | boolean | null;
  /**
   * What to show instead of `value`.
   *
   * A ReactNode rather than a string, so a field can carry more than a word —
   * an expiry date with "in 8 days" under it, a coloured status, a link. Every
   * existing caller passes a string, and a string is a ReactNode, so widening
   * this changes nothing for them.
   */
  display?: ReactNode;
}

export function InlineField({ label, value, display }: InlineFieldProps) {
  let text: ReactNode;
  if (display !== undefined) {
    text = display;
  } else if (value == null || value === '') {
    text = '—';
  } else if (typeof value === 'boolean') {
    text = value ? 'Yes' : 'No';
  } else {
    text = String(value);
  }

  return (
    // Inside a detail page this becomes a label-beside-value row; everywhere
    // else it stays stacked. See `record-detail.css`.
    <div data-field="">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-card-foreground mt-0.5">{text}</dd>
    </div>
  );
}

export default InlineField;

/**
 * Email validation, kept beside lib/phone for the same reason: the Customers
 * form, the Quotation Builder header and the server-side check in
 * VBSolarCustomerController must all agree on what counts as an address.
 *
 * Deliberately permissive. The full RFC 5322 grammar allows things no ERP will
 * ever see (quoted local parts, comments, IP-literal domains), and a strict
 * regex mostly succeeds at rejecting valid addresses. This checks the shape a
 * typo would break — one @, something either side, a dot in the domain — and
 * leaves deliverability to the mail server.
 */

export const normalizeEmail = (raw: string): string => (raw ?? "").trim();

/** True when the value looks like a usable address. */
export const isValidEmail = (raw: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(raw));

/**
 * Domains reserved by RFC 2606 for documentation, plus the placeholder this
 * system writes itself.
 *
 * Mail to these can never be delivered, so an address on one is a customer who
 * will never receive a payment reminder — worth catching at entry rather than
 * discovering when the invoice goes unpaid.
 */
const UNDELIVERABLE_DOMAINS = [
  "example.com", "example.org", "example.net",
  "test.com", "test.test", "email.com",
  "no-email.invalid", "invalid",
];

/**
 * Near-misses for the domains people actually type.
 *
 * A typo here is silent: the address is well-formed, it saves, and the
 * reminder simply bounces. Mapped to the intended spelling so the message can
 * name it rather than just refusing.
 */
const DOMAIN_TYPOS: Record<string, string> = {
  "gmail.co": "gmail.com",     "gmail.cm": "gmail.com",
  "gmial.com": "gmail.com",    "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",    "gmail.con": "gmail.com",
  "gnail.com": "gmail.com",    "gmaill.com": "gmail.com",
  "yahoo.co": "yahoo.com",     "yaho.com": "yahoo.com",
  "hotmail.co": "hotmail.com", "hotmial.com": "hotmail.com",
  "outlok.com": "outlook.com", "outlook.co": "outlook.com",
  "rediffmail.co": "rediffmail.com",
};

/**
 * Validation message, or null when acceptable.
 * `required = false` lets an empty optional field pass.
 */
export const emailError = (raw: string, required = true): string | null => {
  const v = normalizeEmail(raw);
  if (!v) return required ? "Email is required" : null;
  if (!isValidEmail(v)) return "Enter a valid email address (name@example.com)";

  const domain = v.toLowerCase().split("@")[1] ?? "";

  const meant = DOMAIN_TYPOS[domain];
  if (meant) return `Did you mean @${meant}?`;

  if (UNDELIVERABLE_DOMAINS.includes(domain)) {
    return "That address cannot receive mail — use a real one or leave it blank";
  }

  return null;
};

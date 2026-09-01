/**
 * Indian mobile numbers: exactly 10 digits.
 *
 * Kept in one place because the same rule is needed by the Customers form, the
 * Quotation Builder header and the dealer portal — and it must agree with the
 * server-side check in VBSolarCustomerController, since the browser rule is a
 * convenience and the API is the actual gate.
 */

export const PHONE_LENGTH = 10;

/** Strip everything that is not a digit, then cap at 10. */
export const normalizePhone = (raw: string): string =>
  (raw ?? "").replace(/\D/g, "").slice(0, PHONE_LENGTH);

/**
 * People paste numbers with a country code or leading zero. Drop those first so
 * "+91 98765 43210" and "098765 43210" both land on the real 10 digits rather
 * than being truncated to "919876543" by a naive slice.
 */
export const cleanPhoneInput = (raw: string): string => {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.length > PHONE_LENGTH && d.startsWith("91")) d = d.slice(2);
  if (d.length > PHONE_LENGTH && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, PHONE_LENGTH);
};

/**
 * Indian mobile numbers begin 6, 7, 8 or 9.
 *
 * Landlines and the 1xx service ranges are not reachable by SMS and are never a
 * customer's mobile, so a number starting 0–5 is a typo or a placeholder.
 */
const MOBILE_FIRST_DIGIT = /^[6-9]/;

/**
 * Numbers that are the right shape but obviously not real.
 *
 * These are what gets typed when someone wants past a required field:
 * ten of the same digit, or a straight run up or down the keypad. Caught
 * because such an order is unreachable — nobody can be called about a delivery
 * or chased for payment on 9999999999.
 */
const isFakePattern = (d: string): boolean => {
  if (/^(\d)\1{9}$/.test(d)) return true;            // 9999999999
  const seq = "0123456789012345678901234567890";
  if (seq.includes(d)) return true;                   // 6789012345
  const rev = "9876543210987654321098765432109";
  if (rev.includes(d)) return true;                   // 9876543210
  return false;
};

/** True when the value is a usable 10-digit mobile number. */
export const isValidPhone = (raw: string): boolean => phoneError(raw) === null;

/**
 * Validation message, or null when acceptable.
 * `required = false` lets an empty optional field pass.
 */
export const phoneError = (raw: string, required = true): string | null => {
  const v = (raw ?? "").trim();
  if (!v) return required ? "Phone number is required" : null;
  const digits = v.replace(/\D/g, "");
  if (digits.length !== PHONE_LENGTH) {
    return `Phone number must be exactly ${PHONE_LENGTH} digits (got ${digits.length})`;
  }
  if (!MOBILE_FIRST_DIGIT.test(digits)) {
    return "Indian mobile numbers start with 6, 7, 8 or 9";
  }
  if (isFakePattern(digits)) {
    return "That does not look like a real mobile number";
  }
  return null;
};

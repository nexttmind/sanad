/** Public donation contact numbers (E.164 without +). */
export const WHISH_DONATION_PHONE = "96181432343";
export const ALT_DONATION_PHONE = "9613689363";

export const WHISH_DONATION_DISPLAY = "+961 81 432 343";
export const ALT_DONATION_DISPLAY = "+961 3 689 363";

export function telHref(digits: string): string {
  return `tel:+${digits.replace(/\D/g, "")}`;
}

export function whatsappHref(digits: string): string {
  return `https://wa.me/${digits.replace(/\D/g, "")}`;
}

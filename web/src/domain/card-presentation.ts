/** Card edition codes belong in the stamp, not in the municipality name. */
export function municipalityName(city: string) {
  return city.replace(/\s*\([A-Z]\d{3}\)$/, "");
}

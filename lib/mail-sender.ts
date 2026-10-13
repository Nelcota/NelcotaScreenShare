const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const NAMED = /^[^<>]*<\s*([^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)\s*>$/;

/** A sender the providers accept: "oi@nelcota.com" or "Nelcota <oi@nelcota.com>". */
export function isValidSender(value: string): boolean {
  const sender = value.trim();
  return ADDRESS.test(sender) || NAMED.test(sender);
}

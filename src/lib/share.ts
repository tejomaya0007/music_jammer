/** The link friends open to join: the app's own address with ?join=CODE. */
export function shareUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}?join=${code}`;
}

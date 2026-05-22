// In-memory map of customId -> url for article buttons.
// Buttons on old messages stop resolving after a bot restart, which is acceptable.
const store = new Map<string, string>();
let counter = 0;

export function registerArticleUrl(url: string): string {
  const id = `art_${(++counter).toString(36)}_${Date.now().toString(36)}`;
  store.set(id, url);
  return id;
}

export function resolveArticleUrl(customId: string): string | undefined {
  return store.get(customId);
}

const SLUG = /^[a-z][a-z0-9-]{0,31}$/;

export function slugOk(slug: string): boolean {
  return SLUG.test(slug);
}

export function suggestCloneSlug(slug: string): string {
  const suffix = "-copy";
  if (slug.length + suffix.length <= 32) {
    return `${slug}${suffix}`;
  }
  return `${slug.slice(0, 32 - suffix.length)}${suffix}`;
}

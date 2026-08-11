export function orderCategories(categories: string[], savedOrder: string[] = []): string[] {
  const remaining = new Set(categories);
  return [
    ...savedOrder.filter((category) => remaining.delete(category)),
    ...[...remaining].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  ];
}

export function moveCategory(categories: string[], source: string, target: string): string[] {
  const sourceIndex = categories.indexOf(source);
  const targetIndex = categories.indexOf(target);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return categories;
  const next = [...categories];
  next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, source);
  return next;
}

export function parseCategoryOrder(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((category): category is string => typeof category === 'string' && Boolean(category.trim()) && category.length <= 80))].slice(0, 200);
  } catch {
    return [];
  }
}

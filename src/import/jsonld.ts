import { parseIsoDurationMinutes } from '@/domain/duration';
import { parseIngredient } from '@/domain/ingredient';
import { isSafeHttpUrl, stripHtmlTags } from '@/lib/html';
import type { RecipeDraft } from '@/types/recipe';

const LD_JSON_REGEX = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function hasRecipeType(node: Record<string, unknown>): boolean {
  const t = node['@type'];
  if (typeof t === 'string') {
    return t.toLowerCase() === 'recipe' || t.toLowerCase().endsWith('/recipe');
  }
  if (Array.isArray(t)) {
    return t.some((item) => typeof item === 'string' && (item.toLowerCase() === 'recipe' || item.toLowerCase().endsWith('/recipe')));
  }
  return false;
}

function findRecipeObject(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 8 || value === null || typeof value !== 'object') return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipeObject(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const obj = value as Record<string, unknown>;
  if (hasRecipeType(obj)) {
    return obj;
  }

  if (Array.isArray(obj['@graph'])) {
    const found = findRecipeObject(obj['@graph'], depth + 1);
    if (found) return found;
  }

  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object') {
      const found = findRecipeObject(val, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

function extractYieldNumber(rawYield: unknown): { servings: number; found: boolean } {
  if (typeof rawYield === 'number' && Number.isFinite(rawYield) && rawYield > 0) {
    return { servings: Math.round(rawYield), found: true };
  }
  const str = Array.isArray(rawYield) ? String(rawYield[0] ?? '') : typeof rawYield === 'string' ? rawYield : '';
  const m = str.match(/(\d+(?:\.\d+)?)/);
  if (m) {
    const n = Number(m[1]);
    if (n > 0) return { servings: Math.round(n), found: true };
  }
  return { servings: 4, found: false };
}

function extractInstructions(raw: unknown): string[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    return raw
      .split(/\r?\n+/)
      .map((s) => stripHtmlTags(s))
      .filter(Boolean);
  }
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const item of raw) {
      if (typeof item === 'string') {
        const cleaned = stripHtmlTags(item);
        if (cleaned) out.push(cleaned);
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        if (Array.isArray(obj.itemListElement)) {
          out.push(...extractInstructions(obj.itemListElement));
        } else {
          const text = typeof obj.text === 'string' ? obj.text : typeof obj.name === 'string' ? obj.name : '';
          const cleaned = stripHtmlTags(text);
          if (cleaned) out.push(cleaned);
        }
      }
    }
    return out;
  }
  return [];
}

function extractTags(keywords: unknown, category: unknown): string[] {
  const rawList: string[] = [];
  const pushVal = (v: unknown) => {
    if (typeof v === 'string') {
      rawList.push(...v.split(',').map((s) => stripHtmlTags(s).toLowerCase()).filter(Boolean));
    } else if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === 'string') {
          rawList.push(stripHtmlTags(item).toLowerCase());
        }
      }
    }
  };
  pushVal(keywords);
  pushVal(category);
  return Array.from(new Set(rawList.filter((t) => t.length > 0 && t.length <= 30))).slice(0, 8);
}

function extractAuthorName(author: unknown): string | null {
  if (typeof author === 'string') return stripHtmlTags(author) || null;
  if (Array.isArray(author) && author.length > 0) return extractAuthorName(author[0]);
  if (author && typeof author === 'object') {
    const name = (author as Record<string, unknown>).name;
    if (typeof name === 'string') return stripHtmlTags(name) || null;
  }
  return null;
}

function extractImageUrl(image: unknown): string | null {
  if (typeof image === 'string') return isSafeHttpUrl(image) ? image.trim() : null;
  if (Array.isArray(image) && image.length > 0) return extractImageUrl(image[0]);
  if (image && typeof image === 'object') {
    const url = (image as Record<string, unknown>).url;
    if (typeof url === 'string' && isSafeHttpUrl(url)) return url.trim();
  }
  return null;
}

export interface JsonLdExtractResult {
  draft: RecipeDraft;
  candidateImageUrl: string | null;
}

export function extractRecipeFromHtml(html: string, sourceUrl: string): JsonLdExtractResult | null {
  const regex = new RegExp(LD_JSON_REGEX.source, 'gi');
  let match: RegExpExecArray | null;
  let recipeObj: Record<string, unknown> | null = null;

  while ((match = regex.exec(html)) !== null) {
    const rawJson = match[1]?.trim();
    if (!rawJson) continue;
    try {
      const parsed: unknown = JSON.parse(rawJson);
      const found = findRecipeObject(parsed);
      if (found) {
        recipeObj = found;
        break;
      }
    } catch {
      // Skip malformed JSON-LD blocks
    }
  }

  if (!recipeObj) return null;

  const warnings: string[] = [];
  const title =
    typeof recipeObj.name === 'string' ? stripHtmlTags(recipeObj.name).slice(0, 200) : 'Imported recipe';
  const description =
    typeof recipeObj.description === 'string'
      ? stripHtmlTags(recipeObj.description).slice(0, 1000) || null
      : null;

  const { servings, found: yieldFound } = extractYieldNumber(recipeObj.recipeYield);
  if (!yieldFound) {
    warnings.push('Servings not found; defaulted to 4.');
  }

  let prepMinutes = parseIsoDurationMinutes(recipeObj.prepTime as string | undefined);
  let cookMinutes = parseIsoDurationMinutes(recipeObj.cookTime as string | undefined);
  if (prepMinutes === null && cookMinutes === null) {
    cookMinutes = parseIsoDurationMinutes(recipeObj.totalTime as string | undefined);
  }

  const rawIngredients = Array.isArray(recipeObj.recipeIngredient)
    ? recipeObj.recipeIngredient
        .filter((i): i is string => typeof i === 'string')
        .map((i) => stripHtmlTags(i))
        .filter(Boolean)
    : [];

  if (rawIngredients.length === 0) {
    warnings.push('No ingredients found in structured data.');
  } else {
    const flagged = rawIngredients.filter((line) => parseIngredient(line).warn).length;
    if (flagged > 0) {
      warnings.push(`${flagged} ingredient line${flagged === 1 ? '' : 's'} may need a quick check.`);
    }
  }

  const steps = extractInstructions(recipeObj.recipeInstructions);
  if (steps.length === 0) {
    warnings.push('No steps found in structured data.');
  }

  const tags = extractTags(recipeObj.keywords, recipeObj.recipeCategory);
  const sourceName = extractAuthorName(recipeObj.author);
  const candidateImageUrl = extractImageUrl(recipeObj.image);

  return {
    draft: {
      title,
      description,
      servings,
      prepMinutes,
      cookMinutes,
      ingredientsText: rawIngredients.join('\n'),
      stepsText: steps.join('\n'),
      notes: null,
      sourceUrl: isSafeHttpUrl(sourceUrl) ? sourceUrl : null,
      sourceName,
      tags,
      warnings,
    },
    candidateImageUrl,
  };
}

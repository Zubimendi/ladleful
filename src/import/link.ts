import { isSafeHttpUrl } from '@/lib/html';
import { err, ok, type AppError, type Result } from '@/lib/result';
import { extractRecipeFromHtml, type JsonLdExtractResult } from './jsonld';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB

export async function fetchAndExtractRecipe(url: string): Promise<Result<JsonLdExtractResult, AppError>> {
  const trimmed = url.trim();
  if (!isSafeHttpUrl(trimmed)) {
    return err({
      kind: 'import',
      subtype: 'invalidUrl',
      message: 'Enter a valid http or https link.',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(trimmed, {
      method: 'GET',
      credentials: 'omit',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'LadlefulRecipeBox/1.0',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return err({
        kind: 'import',
        subtype: 'noRecipeData',
        message: `Page returned status ${response.status}. Try Paste text instead.`,
      });
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType && !contentType.toLowerCase().includes('text/html') && !contentType.toLowerCase().includes('xhtml')) {
      return err({
        kind: 'import',
        subtype: 'notHtml',
        message: 'That link does not point to a web page.',
      });
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_HTML_BYTES) {
      return err({
        kind: 'import',
        subtype: 'tooLarge',
        message: 'That page is too large to import (over 2 MB).',
      });
    }

    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) {
      return err({
        kind: 'import',
        subtype: 'tooLarge',
        message: 'That page is too large to import (over 2 MB).',
      });
    }

    const extracted = extractRecipeFromHtml(html, trimmed);
    if (!extracted) {
      return err({
        kind: 'import',
        subtype: 'noRecipeData',
        message: "This page doesn't publish structured recipe data. Try Paste text.",
      });
    }

    return ok(extracted);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return err({
        kind: 'import',
        subtype: 'timeout',
        message: 'Timed out waiting for that page. Try again or use Paste text.',
      });
    }
    return err({
      kind: 'import',
      subtype: 'offline',
      message: 'Could not reach that page. Check your connection and try again.',
    });
  } finally {
    clearTimeout(timeout);
  }
}

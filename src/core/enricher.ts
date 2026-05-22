import Anthropic from '@anthropic-ai/sdk';
import type { CollectedItem } from '../types';
import logger from '../utils/logger';

const BATCH_SIZE = 20;
const OG_TIMEOUT_MS = 5000;

// Lazy init — avoids crash at startup if ANTHROPIC_API_KEY is absent
let _anthropic: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

async function fetchOgImage(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(OG_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    });
    if (!res.ok) return undefined;
    const html = await res.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const raw = match?.[1];
    if (!raw) return undefined;
    try {
      return new URL(raw, url).toString();
    } catch {
      return raw;
    }
  } catch {
    return undefined;
  }
}

interface FrenchFields {
  titleFr: string;
  descriptionFr: string;
}

function fallback(items: CollectedItem[]): FrenchFields[] {
  return items.map((i) => ({ titleFr: i.title, descriptionFr: i.description }));
}

async function enrichBatchWithClaude(items: CollectedItem[]): Promise<FrenchFields[]> {
  const client = getClient();
  if (!client) return fallback(items);

  const articles = items.map((i) => ({
    title: i.title,
    description: i.description.substring(0, 200),
  }));

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system:
      'Tu es un journaliste tech francophone. Tu reçois des articles en anglais et tu génères pour chacun un titre accrocheur en français et une description courte et percutante en français.',
    messages: [
      {
        role: 'user',
        content: `Pour chaque article, génère :
- "title_fr" : titre accrocheur en français, max 90 caractères
- "description_fr" : description courte en français qui résume l'essentiel, max 180 caractères

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ou après.

Articles :
${JSON.stringify(articles, null, 2)}`,
      },
    ],
  });

  // Log token usage
  const usage = msg.usage;
  const inputCost  = (usage.input_tokens  / 1_000_000) * 0.80;
  const outputCost = (usage.output_tokens / 1_000_000) * 4.00;
  logger.info(
    {
      source: 'enricher',
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: parseFloat((inputCost + outputCost).toFixed(6)),
    },
    `Claude usage — batch of ${items.length} articles`
  );

  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '[]';
  const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  const parsed = JSON.parse(clean) as Array<{ title_fr: string; description_fr: string }>;

  return parsed.map((p) => ({
    titleFr: p.title_fr ?? '',
    descriptionFr: p.description_fr ?? '',
  }));
}

export async function enrich(items: CollectedItem[]): Promise<CollectedItem[]> {
  if (items.length === 0) return [];

  const client = getClient();
  if (!client) {
    logger.warn({ source: 'enricher' }, 'ANTHROPIC_API_KEY absent — skipping Claude enrichment, publishing originals');
  }

  // OG images in parallel
  const imageUrls = await Promise.all(items.map((i) => fetchOgImage(i.url)));

  // Claude enrichment in batches (with fallback per batch)
  const frenchFields: FrenchFields[] = [];
  let totalCost = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    try {
      const fields = await enrichBatchWithClaude(batch);
      frenchFields.push(...fields);
    } catch (err) {
      const isCreditsError =
        err instanceof Anthropic.APIError &&
        (err.status === 402 || err.status === 529 || err.message.toLowerCase().includes('credit'));

      if (isCreditsError) {
        logger.warn({ source: 'enricher', err }, 'Anthropic credits exhausted — switching to fallback for remaining batches');
        // fallback for this batch AND all remaining
        frenchFields.push(...fallback(batch));
        for (let j = i + BATCH_SIZE; j < items.length; j += BATCH_SIZE) {
          frenchFields.push(...fallback(items.slice(j, j + BATCH_SIZE)));
        }
        break;
      }

      logger.error({ source: 'enricher', err }, 'Claude enrichment failed — using originals for this batch');
      frenchFields.push(...fallback(batch));
    }
  }

  if (totalCost > 0) {
    logger.info({ source: 'enricher', total_cost_usd: totalCost.toFixed(6) }, 'Total enrichment cost');
  }

  return items.map((item, idx) => ({
    ...item,
    titleFr: frenchFields[idx]?.titleFr || item.title,
    descriptionFr: frenchFields[idx]?.descriptionFr || item.description,
    imageUrl: imageUrls[idx] ?? item.imageUrl,
  }));
}

import type { Response } from 'openai/resources/responses/responses';

const rates = {
  'gpt-5.6-sol': { input: 400, cached: 40, output: 2000 },
  'gpt-5.6-terra': { input: 200, cached: 20, output: 1200 },
  'gpt-5.6-luna': { input: 20, cached: 2, output: 120 },
} as const;

export function calculateResponseCost(
  response: Pick<Response, 'model' | 'usage'>,
): string {
  const model = response.model.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  const rate = rates[model as keyof typeof rates];
  if (!rate)
    throw new Error(`No AI pricing configured for model "${response.model}"`);
  const usage = response.usage;
  if (!usage) throw new Error('OpenAI response is missing token usage');
  const input = usage.input_tokens;
  const cached = usage.input_tokens_details.cached_tokens;
  const output = usage.output_tokens;
  if (
    [input, cached, output].some(
      (tokens) => !Number.isSafeInteger(tokens) || tokens < 0,
    ) ||
    cached > input
  ) {
    throw new Error('OpenAI response contains invalid token usage');
  }
  // Cached tokens are included in input_tokens; reasoning tokens in output_tokens.
  const units =
    BigInt(input - cached) * BigInt(rate.input) +
    BigInt(cached) * BigInt(rate.cached) +
    BigInt(output) * BigInt(rate.output);
  return `${units / BigInt(100_000_000)}.${(units % BigInt(100_000_000)).toString().padStart(8, '0')}`;
}

import { calculateResponseCost } from './response-cost';

const response = (model = 'gpt-5.6-sol') => ({
  model,
  usage: {
    input_tokens: 1_000_000,
    input_tokens_details: { cached_tokens: 250_000, cache_write_tokens: 0 },
    output_tokens: 100_000,
    output_tokens_details: { reasoning_tokens: 50_000 },
    total_tokens: 1_100_000,
  },
});

describe('calculateResponseCost', () => {
  it.each([
    ['gpt-5.6-sol', '5.10000000'],
    ['gpt-5.6-terra', '2.75000000'],
    ['gpt-5.6-luna', '0.27500000'],
    ['gpt-5.6-luna-2026-09-01', '0.27500000'],
  ])(
    'calculates %s without double counting cached or reasoning tokens',
    (model, cost) => {
      expect(calculateResponseCost(response(model))).toBe(cost);
    },
  );

  it('preserves the price of a single cached luna token', () => {
    const data = response('gpt-5.6-luna');
    data.usage.input_tokens = 1;
    data.usage.input_tokens_details.cached_tokens = 1;
    data.usage.output_tokens = 0;
    expect(calculateResponseCost(data)).toBe('0.00000002');
  });

  it('rejects missing usage and unknown prices instead of recording zero', () => {
    expect(() =>
      calculateResponseCost({ model: 'gpt-5.6-sol', usage: undefined }),
    ).toThrow('missing token usage');
    expect(() => calculateResponseCost(response('unknown'))).toThrow(
      'No AI pricing',
    );
  });

  it('rejects inconsistent cached usage', () => {
    const data = response();
    data.usage.input_tokens = 1;
    expect(() => calculateResponseCost(data)).toThrow('invalid token usage');
  });
});

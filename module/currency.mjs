// Currency values are whole coin counts; sheet controls normalize typed decimals.
export const GOLD_PER_PLATINUM = 1000;

export function currencyTotal({ gc = 0, pc = 0 } = {}) {
  return gc + pc * GOLD_PER_PLATINUM;
}

/**
 * Linear bonding curve: price(s) = BASE_PRICE + SLOPE * s
 * See docs/adr/0002-amm-linear-bonding-curve.md
 */

export const BASE_PRICE = 100;
export const SLOPE = 2;

/** Spot price at a given outstanding-shares state. */
export function currentPrice(outstandingShares: number): number {
  assertNonNegativeInt(outstandingShares, "outstandingShares");
  return BASE_PRICE + SLOPE * outstandingShares;
}

/**
 * Cost to buy `n` shares starting from state `s`.
 * Integral of price from s to s+n: BASE*n + (s+n)^2 - s^2 - 0 (since slope=2, integral of 2x is x^2)
 * = BASE*n + 2*s*n + n^2
 *
 * NOTE: with SLOPE=2, the integral of (BASE + SLOPE*x)dx is BASE*x + x^2, so the difference
 * is BASE*n + (s+n)^2 - s^2 = BASE*n + 2sn + n^2.
 */
export function buyCost(s: number, n: number): number {
  assertNonNegativeInt(s, "s");
  assertPositiveInt(n, "n");
  return BASE_PRICE * n + 2 * s * n + n * n;
}

/**
 * Receipt for selling `n` shares from state `s` down to s-n.
 * Same integral, reversed: BASE*n + 2sn - n^2.
 */
export function sellReceipt(s: number, n: number): number {
  assertNonNegativeInt(s, "s");
  assertPositiveInt(n, "n");
  if (n > s) {
    throw new Error(`cannot sell ${n} shares: only ${s} outstanding`);
  }
  return BASE_PRICE * n + 2 * s * n - n * n;
}

/**
 * Mark-to-market liquidation value: `n` shares × current spot price.
 * Used at Friday 17:00 closing. Does NOT walk the curve.
 * See docs/adr/0004-mark-to-market-liquidation.md
 */
export function liquidationValue(outstandingShares: number, holdingShares: number): number {
  assertNonNegativeInt(outstandingShares, "outstandingShares");
  assertNonNegativeInt(holdingShares, "holdingShares");
  return currentPrice(outstandingShares) * holdingShares;
}

function assertNonNegativeInt(v: number, name: string): void {
  if (!Number.isInteger(v) || v < 0) {
    throw new Error(`${name} must be a non-negative integer, got ${v}`);
  }
}

function assertPositiveInt(v: number, name: string): void {
  if (!Number.isInteger(v) || v <= 0) {
    throw new Error(`${name} must be a positive integer, got ${v}`);
  }
}

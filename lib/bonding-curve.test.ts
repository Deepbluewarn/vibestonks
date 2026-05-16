import { describe, expect, it } from "vitest";
import {
  BASE_PRICE,
  buyCost,
  currentPrice,
  liquidationValue,
  sellReceipt,
  SLOPE,
} from "./bonding-curve";

describe("currentPrice", () => {
  it("returns BASE_PRICE at s=0", () => {
    expect(currentPrice(0)).toBe(BASE_PRICE);
  });

  it("increases by SLOPE per share", () => {
    expect(currentPrice(1)).toBe(BASE_PRICE + SLOPE);
    expect(currentPrice(10)).toBe(BASE_PRICE + 10 * SLOPE);
  });

  it("rejects negative or non-integer input", () => {
    expect(() => currentPrice(-1)).toThrow();
    expect(() => currentPrice(1.5)).toThrow();
  });
});

describe("buyCost", () => {
  it("matches hand-calc for single-share buys", () => {
    // s=0, buy 1: midpoint price between 100 and 102 = 101
    expect(buyCost(0, 1)).toBe(101);
    expect(buyCost(1, 1)).toBe(103);
    expect(buyCost(5, 1)).toBe(111);
  });

  it("matches hand-calc for multi-share buys", () => {
    // s=0, buy 5: 101 + 103 + 105 + 107 + 109 = 525
    expect(buyCost(0, 5)).toBe(525);
    // s=5, buy 3: 111 + 113 + 115 = 339
    expect(buyCost(5, 3)).toBe(339);
  });

  it("is additive across consecutive segments", () => {
    // buying m+n shares from s = buying m from s + buying n from s+m
    const s = 7;
    const m = 4;
    const n = 6;
    expect(buyCost(s, m + n)).toBe(buyCost(s, m) + buyCost(s + m, n));
  });

  it("rejects zero or negative shares", () => {
    expect(() => buyCost(0, 0)).toThrow();
    expect(() => buyCost(0, -1)).toThrow();
  });
});

describe("sellReceipt", () => {
  it("matches hand-calc for single-share sells", () => {
    // s=1, sell 1: integral from 0 to 1 of (100 + 2x) = 101
    expect(sellReceipt(1, 1)).toBe(101);
    // s=2, sell 1: integral from 1 to 2 = 103
    expect(sellReceipt(2, 1)).toBe(103);
  });

  it("matches hand-calc for multi-share sells", () => {
    // s=5, sell 5: 109+107+105+103+101 = 525
    expect(sellReceipt(5, 5)).toBe(525);
    // s=8, sell 3: 115+113+111 = 339
    expect(sellReceipt(8, 3)).toBe(339);
  });

  it("rejects selling more than outstanding", () => {
    expect(() => sellReceipt(3, 4)).toThrow();
    expect(() => sellReceipt(0, 1)).toThrow();
  });
});

describe("zero-sum round-trip", () => {
  it("buy N then sell N (no intervening trades) is exactly break-even", () => {
    // CRITICAL INVARIANT: buyCost(s, n) === sellReceipt(s + n, n)
    for (const s of [0, 1, 5, 17, 100]) {
      for (const n of [1, 2, 5, 10]) {
        expect(sellReceipt(s + n, n)).toBe(buyCost(s, n));
      }
    }
  });

  it("two traders' trades sum to pool-deposit conservation", () => {
    // A buys 5 at s=0: pays 525. State s=5.
    // B buys 3 at s=5: pays 339. State s=8.
    // Pool collected: 864.
    // If both sell back in reverse: B sells 3 at s=8 -> receives 339, A sells 5 at s=5 -> receives 525.
    // Total returned: 864. Conservation holds.
    const aCost = buyCost(0, 5);
    const bCost = buyCost(5, 3);
    const bRecv = sellReceipt(8, 3);
    const aRecv = sellReceipt(5, 5);
    expect(aCost + bCost).toBe(bRecv + aRecv);
  });
});

describe("liquidationValue (mark-to-market)", () => {
  it("returns holdings × spot price", () => {
    // At s=8, price = 116. Holding 3 shares = 348.
    expect(liquidationValue(8, 3)).toBe(348);
    expect(liquidationValue(8, 5)).toBe(580);
  });

  it("zero holdings = zero value", () => {
    expect(liquidationValue(50, 0)).toBe(0);
  });

  it("demonstrates the system 'subsidy' from ADR-0004", () => {
    // A buys 5 at s=0 (525), B buys 3 at s=5 (339). Pool: 864.
    // Liquidate both at mark-to-market: A 5×116=580, B 3×116=348. Total: 928.
    // Subsidy = 928 - 864 = 64.
    const poolCollected = buyCost(0, 5) + buyCost(5, 3);
    const liquidationPaid = liquidationValue(8, 5) + liquidationValue(8, 3);
    expect(liquidationPaid - poolCollected).toBe(64);
  });
});

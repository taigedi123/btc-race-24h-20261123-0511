// Momentum-ignition bot for the cbBTC 24h race.
//
// Idea, in one paragraph: one-minute BTC bars are mostly noise, and every
// round trip costs about 26 bps, so this bot trades at most twice per window.
// It buys once, with all of its cash, the first time the 30-minute return
// turns positive after the open (the market has shown a direction instead of
// drifting sideways), and then it simply holds, protected by a single
// trailing stop: if the close falls 2% below the highest close seen since
// entry, it sells everything and stays in cash for the rest of the window.
// No re-entry, no second-guessing, no churn: a stop that fires on a dip
// costs a little upside, but a stop that fires in a real crash saves the
// entry from riding a falling market to the end. Every decision is a pure
// function of the bars seen so far, so the two grading runs agree exactly.
//
// Protocol: agent-fun/bars-replay/v1, spoken through the kit's SDK shim
// (vendor/makefun-bars.ts, copied byte for byte). Orders decided on the
// batch of the bar closing at minute t fill at the next bar's open, so the
// buy below lands one minute after the ignition bar closes, and the stop
// sell one minute after the bar that trips it.

import { runBars } from "./vendor/makefun-bars.ts";
import type { BarsState, Batch } from "./vendor/makefun-bars.ts";

const SYMBOL = "CBBTC";

// How far back the ignition look is: the close must beat the close this
// many bars ago before we buy. 30 minutes is long enough that a single
// noisy minute cannot trigger it, and short enough that a real move is
// caught while most of it is still ahead.
const IGNITION_BARS = 30;

// Trailing stop, in basis points below the highest close since entry.
// 2% is wider than the deepest ordinary dip of the dev window, so the stop
// only fires on a genuine fall, and narrow enough to cut a crash early.
const STOP_BPS = 200;

// Never open a position this late: a buy in the final hour would pay a
// full round trip of fees for minutes of exposure before the forced sale.
const NO_ENTRY_AFTER_BAR = 1380;

// Slippage caps, in basis points from the latest close. The buy cap is
// tight because a buy that gaps away is simply skipped; the sell cap is
// loose because a stop that is rejected leaves us long through a crash.
const BUY_MAX_SLIPPAGE_BPS = 200;
const SELL_MAX_SLIPPAGE_BPS = 500;

// Closes of CBBTC in raw price units, one per bar actually received.
// Ratios of raw prices are the same as ratios of USDC prices, so no scale
// conversion is needed anywhere below.
const closes: bigint[] = [];

// Highest close since the current position was opened, or null while flat.
let peakClose: bigint | null = null;

// True once a stop sell has filled: after that we never trade again.
let stoppedOut = false;

// True while a position is held, from the account the harness reports.
// Derived from state each batch, so a rejected order never corrupts it.
let wasLong = false;

function onBatch(state: BarsState, batch: Batch) {
  if (state.warmingUp) return [];
  const bar = batch.bars.find((b) => b.symbol === SYMBOL);
  if (bar === undefined) return [];
  const close = BigInt(bar.c);
  closes.push(close);

  const position = state.positions.get(SYMBOL);
  const qty = position === undefined ? 0n : position.qty;

  if (qty > 0n) {
    wasLong = true;
    if (peakClose === null || close > peakClose) peakClose = close;
    const stopLine = (peakClose * BigInt(10_000 - STOP_BPS)) / 10_000n;
    if (close < stopLine) {
      return [
        {
          side: "sell",
          symbol: SYMBOL,
          qty,
          max_slippage_bps: SELL_MAX_SLIPPAGE_BPS,
        },
      ];
    }
    return [];
  }

  // Flat. A stop sell that filled ends our trading for the window.
  if (wasLong) stoppedOut = true;
  wasLong = false;
  peakClose = null;
  if (stoppedOut) return [];

  const index = closes.length - 1;
  if (index < IGNITION_BARS || index >= NO_ENTRY_AFTER_BAR) return [];
  if (state.cash <= 0n) return [];
  if (close > closes[index - IGNITION_BARS]) {
    return [
      {
        side: "buy",
        symbol: SYMBOL,
        notional_quote_units: state.cash,
        max_slippage_bps: BUY_MAX_SLIPPAGE_BPS,
      },
    ];
  }
  return [];
}

await runBars({ onBatch });

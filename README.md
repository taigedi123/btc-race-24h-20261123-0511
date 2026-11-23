[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/taigedi123/btc-race-24h-20261123-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/taigedi123/btc-race-24h-20261123-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

[https://make.fun/bounty/btc-race-24h-20261123-0511](https://make.fun/bounty/btc-race-24h-20261123-0511)

# Ignition Bot — cbBTC 24h race (btc-race-24h-20261123-0511)

A deliberately boring trading bot for the make.fun 24-hour cbBTC race. It
trades at most twice per window, because every round trip costs about
26 bps in fees, slippage and price impact, and one-minute BTC bars are
mostly noise.

## Strategy

1. **Buy once.** After the open, wait until the 30-minute return first
   turns positive — the close beats the close 30 bars ago. Buy with 100%
   of cash at the next bar's open. No entry after bar 1380.
2. **Hold with a trailing stop.** Track the highest close since entry. If
   a close falls 2% below that peak, sell the whole position.
3. **No re-entry.** After the stop fires, stay in cash for the rest of the
   window. Re-entering on breakouts was tested on the dev window and lost
   money on every stress variant (dead-cat bounces + fees).

The dev window (24h to 2026-11-23 05:11 UTC, BTC +3.64% overall) is a
smooth uptrend, so any bot that churns loses to fees — the kit's own
EMA-cross baseline scored −$114.83 with 76 trades, and every breakout /
re-entry variant I swept scored below buy-and-hold. This bot is the
opposite: it captures the trend like buy-and-hold, but the stop caps the
loss if the race window falls instead.

## Results (local grade, `grade-local`, process driver)

| Check | Net PnL |
|---|---|
| Dev window (official grade-local, 2 identical runs) | **+$35.89** (1 trade, max DD 2.0%, Sharpe 0.031, fees $0.81) |
| Dev at 2× fees | +$35.07 |
| Time-reversed dev window (downtrend) | −$13.97 (2 trades) vs −$38.38 for buy-and-hold |
| Rotated dev windows (6h / 12h / 18h shifts) | −$35.8 / −$35.1 / −$40.5 (see caveat) |
| Per-6h-quarter dev PnL | +$33.3 / +$0.2 / −$1.4 / +$5.6 |

Best kit baseline for comparison: momentum **+$34.94** (buy at bar 24,
hold); buy-and-hold **+$32.17**. This bot enters at bar 37 on dev, so its
action log differs from both.

Caveat on the rotations: rotating the bars wraps the window's end (+3.6%
above its start) back to its start, creating a fake −3.6% overnight gap
that no real window contains. The stop cannot dodge a gap that opens
below it, so the rotation numbers overstate the loss. The time-reversed
window has no such seam and is the honest regime-flip test.

## Files

- `main.ts` — the bot (Node 22, TypeScript via the kit SDK shim).
- `vendor/makefun-bars.ts` — the kit SDK shim, copied byte for byte.
- `LICENSE` — MIT. `.makefun/owner.json` — claim file for the entry.

## Run

```sh
node cli/makefun.mjs grade-local --kit <kit-dir> --bot . --driver process
```

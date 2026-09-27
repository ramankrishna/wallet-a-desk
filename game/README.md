# Wallet A Desk

A Rare Friend runs a **simulated** paper desk. FriendSDK v0.1.2 supplies the wallet connection and the owned Friend. The desk draws that Friend from the canonical Generations artwork, unchanged. This game does not use a private key and does not send live orders.

The game frame cannot call Hyperliquid (`connect-src` is only the preview itself and Robinhood RPC), so the tape is generated in the desk. Marks walk once a second. They are not exchange prices.

Public preview: <https://ramankrishna.github.io/wallet-a-desk/>. Same wallet requirement. Simulated only.

## Run

From the FriendSDK root:

```bash
npm run dev:game -- games/wallet-a-desk
```

Open the printed URL, normally `http://localhost:4173`. Connect a wallet on Robinhood mainnet that holds a hardwired Generations NFT, generation 1 or higher.

On a phone on the same network:

```bash
npm run dev:game -- games/wallet-a-desk --host 0.0.0.0 --port 4173
```

The phone layout is taller (9:16). A computer keeps the 960×640 desk. Restart the dev runner once after `host.css` is added.

## How to play

1. Buy one desk chip. Confirm it on the frame. Simulated RF only.
2. Pick a name on the tape (tap, ↑↓, or 1–6).
3. Long or short. Confirm the chip on the frame. One chip, one ticket.
4. The stamp sets the fill. The mark keeps moving. Close the ticket when you want. That PnL stays on the Book and is not a transfer.
5. Open Prints and redeem a kept stamp for its simulated RF.

If a stamp is interrupted, long or short again. That finishes the same print and does not spend a second chip.

Keys, when the desk is focused: L long, S short, C close, B chip, P prints, Esc closes Prints. Sound starts off.

## Economy (simulated)

| Item | Cost or chance | What you get |
|---|---|---|
| Desk chip | 1 RF (`1000000000000000000`) | One print |
| Flat tape | 50% | 0.5 RF, fill slips 0.40% against you |
| Clean fill | 35% | 1 RF, fill at the mark |
| Rare print | 15% | 2 RF, fill slips 0.25% in your favor |

A new chip needs free preview backing for the 2 RF top prize. Each chip reserves that prize until the print is stamped, and the prize stays reserved until you redeem it. Ticket size is $200 at 3×. Book PnL is `price move × $200` and never leaves the session. Reloading clears the preview.

Buying a chip, printing a ticket, and redeeming each ask for a confirm on the frame. This preview does not sign or spend ETH.

## Not included

Wallet A’s trading key is not in this project. Submission to the vibeathon waits until you have played it.

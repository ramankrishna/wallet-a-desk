# Wallet A Desk

A Rare Friend sits a simulated paper desk. You spend $RAREFRIENDS on a desk chip, stamp a fill, and close the ticket. The Friend on screen is your own Generations NFT, drawn from its original artwork.

**Builder:** [Ramakrishna Bachu / @ramankrishna](https://github.com/ramankrishna) · **Category:** Economy Potential · **SDK:** FriendSDK v0.1.2

Play it at <https://ramankrishna.github.io/wallet-a-desk/>. You need a browser wallet on Robinhood mainnet that holds a hardwired Generations NFT, generation 1 or higher. Nothing in the preview is signed or sent.

## Run it

Node.js 22 or newer, and a browser wallet that holds a hardwired Rare Friends Generations NFT (generation 1 or higher) on Robinhood mainnet (chain 4663).

```sh
git clone https://github.com/ramankrishna/wallet-a-desk.git
cd wallet-a-desk
npm install
npm run dev
```

Open the printed URL, normally `http://127.0.0.1:4173`. Connect the wallet and choose your Friend. The SDK checks ownership before play. No RF funding and no transaction signature are required. Purchases and rewards are simulated.

On a phone on the same network:

```sh
npx friendsdk dev ./game --host 0.0.0.0 --port 4173
```

A computer keeps the 960×640 frame. A narrow screen uses a taller frame so the desk still fits.

## Play

Your Friend is seated at the desk. Buy one desk chip for 1 RF and confirm it on the frame. Pick a name, then long or short. That spends the chip and stamps the fill. Close the ticket when you want. The Book number is simulated and never leaves the session. Open Prints to redeem a stamp for its simulated RF.

Keys, when the desk is focused: 1–6 or arrow keys select a name, L long, S short, C close, B chip, P prints, Esc closes Prints. Sound starts off.

## Rules and rewards

**All balances, purchases, and rewards are simulated.** One desk chip costs 1 RF (`1000000000000000000` base units) and prints one ticket. Ticket size is $200 at 3×. Book PnL is the price move times $200.

| Print | Chance | Redeem | Fill |
|---|---:|---:|---|
| Flat tape | 50% | 0.5 RF | slips 0.40% against you |
| Clean fill | 35% | 1 RF | at the mark |
| Rare print | 15% | 2 RF | slips 0.25% for you |

Expected reward is 0.9 RF. The top prize is 2 RF. A new chip needs free backing for that prize, and the prize stays reserved until you redeem the print. An interrupted stamp finishes on the next long or short and does not spend a second chip. Reloading clears the preview. There is no save.

The tape is simulated inside the desk. The game frame cannot call Hyperliquid, so these marks are not exchange prices and no order is sent.

## Checks and limitations

`npm run check` validates the game bundle. Desktop and phone browser checks, run from the FriendSDK checkout with its test harness, passed buy, print, close, and redeem, and confirmed the fixture Friend's canonical pixels are drawn. Those browser checks use a test wallet and mocked reads. A playthrough with a real wallet is still required before treating the preview as personally verified.

No trading key is in this project. No live order, contract deployment, or real RF transfer is included. Official Rare Friends publication is a separate review.

# Mint Play Websites

The Mint Play hub and three games share a deployable project. The hub opens each game in its own tab.

## Play locally

Open the extracted `mint-play-web` folder in a terminal with Node.js 22 or newer.

```powershell
npm start
```

Open http://127.0.0.1:4173/ in your browser.

| Site | Direct path |
| --- | --- |
| Mint Play hub | `/` |
| Orbit Pins | `/orbit-pins/` |
| Prism Stack | `/prism-stack/` |
| Helix Drop | `/helix-drop/` |

Use the hub address for the Flutter app's **Visit Site** button and the game paths for direct links. If the app has a Drift Circuit link, update that card to Helix Drop and use `/helix-drop/`.

## Put it on GitHub and Vercel

1. Put the contents of `mint-play-web` at the root of your GitHub repository. Keep `package.json` and `vercel.json` there.
2. Import the repository in Vercel with the repository root selected.
3. Deploy. The included configuration runs `npm run build` and serves `dist`.

[Vercel build settings](https://vercel.com/docs/builds/configure-a-build)

### Four separate domains

Import the same repository as four Vercel projects. Set `MINT_SITE` to the site name on each project.

| Project | `MINT_SITE` |
| --- | --- |
| Mint Play hub | `hub` |
| Orbit Pins | `orbit-pins` |
| Prism Stack | `prism-stack` |
| Helix Drop | `helix-drop` |

Deploy the three games first. On the hub project, set `MINT_ORBIT_PINS_URL`, `MINT_PRISM_STACK_URL`, and `MINT_HELIX_DROP_URL` to their respective HTTPS URLs. Deploy the hub. Set `MINT_HUB_URL` on each game project and redeploy to add a link back to the hub.

[Vercel projects from one repository](https://vercel.com/docs/builds)

## Game rules

| Game | Controls and progression | Currency |
| --- | --- | --- |
| Orbit Pins | Tap or press Space to fire into an open gap. Clear planets with changing spin patterns. Target the glowing star for a bonus. A collision costs one of three hearts. | Starbits buy pin styles. |
| Prism Stack | Tap or press Space to stop the sliding block and drop it. The overhang falls away. A perfect drop keeps the full width and builds a streak. A complete miss ends the run. | Prism Chips buy block palettes. |
| Helix Drop | Drag sideways or hold the arrow keys to rotate the tower. The ball bounces on solid platforms and drops through gaps. Striped platforms end the run. | Drops buy ball styles. |

Free play has no countdown. Earned currency, high scores, and styles save per game in the browser. The hub shows the separate Mint Coin preview balance. Each game offers one optional preview revive per run after a loss. The revive button restores one heart in Orbit Pins and resumes at the same stack or ring in the other games. The dismissible ad break previews appear after Level 5 in Orbit Pins, 15 floors in Prism Stack, and 10 rings in Helix Drop. These flows run locally without an ad SDK.

## Mint Coin and ad estimate

Using your rate of **1,000 Mint Coins = $1**, your estimate of **₹0.15 per paid ad impression**, and an illustrative exchange rate of **₹90 = $1**:

| Calculation | Result |
| --- | --- |
| Payout cost per Mint Coin | ₹0.09 |
| Paid impressions to cover a $1 payout | 600 |
| Gross revenue per 1,000 paid impressions | ₹150 |
| Gross break-even Mint Coins per paid impression | About 1.67 |

The estimate covers payout value before fees, infrastructure, and other expenses. In this build, game currencies are spent in their own style shops. Google's rewarded-ad policy permits qualifying in-game rewards such as an extra life and prohibits direct monetary rewards such as cash and crypto. [Google rewarded-ad policy](https://support.google.com/adsense/answer/9121589)

## Source

```text
sites/hub/            Hub and game links
sites/orbit-pins/     Orbit Pins site settings
sites/prism-stack/    Prism Stack site settings
sites/helix-drop/     Helix Drop site settings
shared/               Game rules, drawing, browser saves, and artwork
scripts/              Static build and local preview
test/                 Rules, saves, and build checks
vercel.json           Vercel build settings
```

`npm run build` writes all four sites to `dist`. `npm test` runs the checks.

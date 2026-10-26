# Agents on Open Rails: what you need to know

Sources: the event page (loops.house/agents-on-open-rails), the Córdoba Luma page, Celo's "How to tag" guide (github.com/celo-org/attribution-tags/BUILDERS.md), Celo's ERC-8004 doc (docs.celo.org/build-on-celo/build-with-ai/8004), and your 5 screenshots. The playground/ideate page blocks automated reading, so I couldn't open it.

## What it is
A global online hackathon run by **Loops House** with **Celo** and **Ripio**: build AI agents that earn, pay and settle with real money on Celo's payment rails. **$5,000 in prizes.**
The Luma link is a separate in-person **2-hour Builder Session in Córdoba** (Bithouse, José Roque Funes 1791), with an intro, workshop, demo and networking. The date isn't shown on the page, and the hosts have to approve your registration.

## Key dates (GMT; Argentina is GMT-3)
| When | What |
|---|---|
| Tue 6 Oct | Kick-off (already happened) |
| Thu 8 Oct 15:00 GMT (12:00 ART) | Ripio wFIAT livestream (today) |
| Thursdays 12:00 GMT | Office Hours |
| **Mon 9 Nov 09:00 GMT (06:00 ART)** | **Deadline to register and submit** |
| Fri 13 Nov | Winners announced |

So you have roughly **one month**. Treat Sunday 8 Nov as the real deadline.

## Tracks and prizes
| Track | Prize | What to build | How it's judged |
|---|---|---|---|
| **Stable Agents: LatAm** (Ripio × Celo) | $1,500 / $500 | Agents that charge, pay, save or settle in Ripio stablecoins: **wARS**, wBRL, wMXN, wCOP, wPEN, wCLP | Runs on mainnet with a real wFIAT token, uses wFIAT and Celo for real, the agent is autonomous and useful, a normal person can use the UX, clear impact for LatAm |
| **Open Corridors: Textile FX** | $750 / $250 | Agents that quote and settle FX on Textile, or treasury agents | Strategy P&L, volume quoted and filled, originality |
| **Open Corridors: USA₮ + x402** | $750 / $250 | Real users settling USA₮ through Celo's x402 facilitator | Real settlement between independent parties |
| **Build with buy** | $1,000 split over 5 projects | Agents that pay for services they don't own (compute, browsers, data, inference) through usebuy.ai | Problem solved and depth of integration. Independent users are required, and spamming cheap calls earns nothing |

You can enter several tracks, but each project wins at most one prize per track.
**Scoring:** each track has a public onchain query and a live leaderboard (the BOARD tab). A human panel makes the final call using that data plus an AI review of your repository.
**"Independent user"** means a wallet you don't own, that you (or whoever funds you) didn't fund first, and that had its own Celo activity *before* the hackathon. Funding your friends' new wallets doesn't count.

## Hard rules (from your screenshots and the docs)
1. **Celo mainnet only (chain 42220).** Testnet transactions don't count. Gas is paid in CELO, or in stablecoins through `feeCurrency`.
2. **Your attribution tag is `celo_dc3ce5f39b37`.** It has to be in **every** transaction **before** it's sent. Untagged transactions are never credited and there's no backfill. If you lose it, you can find it on your event page, under the Celo button in the playground, or with `loops project get`.
   - How to apply it: `npm i @celo/attribution-tags viem`, then build the wallet client once with `.extend(withAttribution('celo_dc3ce5f39b37'))` so every send is tagged automatically.
   - Common mistake: passing `data: 'celo_...'` instead of `toDataSuffix(...)`, which leaves no tag at all.
   - EIP-5792 `sendCalls` isn't covered by the client wrapper. x402 settlements don't carry tags yet.
3. **One agent wallet for the whole event.** Your score is tied to that address, and you enter it when you submit (or through the Celo button in the playground).
4. **ERC-8004 identity:** register the agent from that same wallet before the deadline.
   - Celo Identity Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
   - Host a JSON "agent card" (name, description, image, services), call `register(agentURI)`, read your agentId from the `Registered` event, then add it back into the card. The registration transaction should carry the tag too.
5. **Joining a team switches you to the team's tag.** Anything you sent with your own tag before joining isn't credited to the team, so **decide solo or team before sending anything.**
6. **Public GitHub repo** that exists when you register and still works at judging. Code has to be written during the hackathon.
7. **100 Loops Credits** are already active for AI ideation, the co-pilot and project feedback. There's nothing to claim.

## Useful extras
- wFIAT contracts on Celo (all 18 decimals): wARS `0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d`, wBRL `0xd76f5faf6888e24d9f04bf92a0c8b921fe4390e0`, wMXN `0x337e7456b420bd3481e7fa61fa9850343d610d34`
- Easiest way to get wARS: ramp.ripio.com (no API keys needed)
- Support: Telegram t.me/realworldagentshackathon. Chainstack gives teams 3 free months. Prezenti grants (about $165K) come after.

## Project ideas
1. **Vaquita Agent (recommended, LatAm track).** A Telegram or WhatsApp bot for splitting expenses in **wARS**. You write "dinner 48,000 split between 4", and the agent works out each share, sends payment requests, tracks who paid and settles automatically. It could also run a shared "vaquita" savings pot. It's very Argentine, easy for anyone to use, and you can get real users from your circle (people who already use Celo or MiniPay).
2. **Freelancer Cobrador (LatAm).** It invoices a client abroad in USD stablecoin and automatically converts and settles part into wARS, wBRL or wMXN, with reminders and receipts.
3. **Remesas Agent (LatAm or Textile FX).** "Send 50 USD to my mom in Lima" gets an FX quote, picks the best route and settles in wPEN.
4. **Research agent that pays its own way (Build with buy).** It answers questions by paying per call for search, browser or inference through buy. The prize pool is smaller, but this is the most "agentic" idea.

**Why #1:** it's the biggest prize pool, Ripio and Celo are sponsoring an in-person session in your city, the criteria reward a real person using it, and it can be built as an MVP in about four weeks.

## Likely tech for #1 (to confirm before coding)
TypeScript + Node, **viem** (Celo transactions), **@celo/attribution-tags** (the tag), the ERC-8004 registry, a Telegram bot (grammY), the Claude API to understand free-text messages, and a small database (SQLite or Supabase) for groups and balances.

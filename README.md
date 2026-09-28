# Jarvis market watches on Vercel

Two Vercel functions run separate Forex and U.S. stocks research, ask AI Gateway to summarize the timestamped evidence, store the last report in a private Vercel Blob store, and display it on the public dashboard.

## Required project setup

1. Connect a **private Vercel Blob** store to this project. Enable it for Production. Connect the store to this project for Production; Vercel injects `BLOB_STORE_ID` and rotating OIDC credentials (and may also show a read-write token).
2. Set `MASSIVE_API_KEY` in Vercel project environment variables for Production. It must grant Forex daily aggregate and U.S. stocks grouped daily aggregate access. Stocks news is optional; unavailable news is disclosed in the report.
3. Set `CRON_SECRET` to a long random string in Production. Vercel sends it as a Bearer token to the cron functions.
4. Enable AI Gateway for the team, set a small spending budget, and select an available model via `AI_MODEL` if the default `openai/gpt-5-mini` is unavailable. Vercel functions can use their project OIDC token, or set `AI_GATEWAY_API_KEY` in Production.
5. Deploy to the existing Jarvis Vercel project. The cron jobs run only in Production. Watch the first executions in the Logs tab.

## What the agents can substantiate

The Forex analyst uses recent EUR/USD and USD/JPY **daily** bars and public Fed/BLS headlines. No gold feed is configured, so it explicitly withholds gold levels. The stocks analyst ranks liquid U.S. names using the **previous session's** grouped aggregates and news. It does not verify S&P 500 membership or use live premarket quotes. Neither analyst can confirm an ICT entry from that evidence. Configure intraday and gold sources before enabling those conclusions.

Vercel Hobby cron is UTC and may trigger anywhere within the scheduled hour. Two seasonal UTC triggers per analyst and a New York local-time gate handle daylight saving time; the 9 a.m. analyst skips weekends. The ChatGPT scheduled watches remain separate and are not mirrored here. No trades are placed.

`/api/reports` returns only the latest saved reports. The page displays their actual run and evidence timestamps, and does not claim a live market feed.

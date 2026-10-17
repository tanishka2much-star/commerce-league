# Commerce League Cloudflare pilot

This Worker serves the homepage and API from one Cloudflare origin. D1 stores student name, class/grade, CL ID, credential hashes, session hashes, and practice attempts. Email is not collected. The browser sends selected answers; the Worker calculates and stores scores. Groups are launch practice buckets: 0–2 Foundation, 3–4 Contender, 5 Advanced Practice. They are not official rankings or qualifications.

Cloudflare will process and store these records after deployment. Review the Cloudflare account, privacy, and retention settings before inviting students. The GitHub Pages site does not connect to this API; students must use the deployed Worker URL.

## Deployment

1. Create a Cloudflare D1 database named `commerce-league-students` and copy its ID into `database_id` here.
2. Install Wrangler and authenticate to the intended Cloudflare account with `npx wrangler login`.
3. From this directory, run `npx wrangler d1 execute commerce-league-students --remote --file=./schema.sql`.
4. Set Worker secrets through Wrangler: run `npx wrangler secret put AUTH_PEPPER` and enter a fresh random value of at least 32 bytes. Then run `npx wrangler secret put ANSWER_KEY_JSON` and enter the correct option indexes for the current round at the private prompt. Never put either value in GitHub, a public file, or a screenshot.
5. Deploy with `npx wrangler deploy`. The Worker serves the site and API at its `workers.dev` address.

Accounts receive a random CL ID, random access code, and one-time recovery code. Save them privately when shown. Recovery consumes the old recovery code and issues a new access code. The Worker stores SHA-256 hashes of these random high-entropy values and session tokens. Sessions use HttpOnly cookies. Do not replace generated codes with short student-chosen passwords without adding an appropriate password hashing scheme.

Server-side scoring blocks casual editing of saved scores, but cannot prevent answer sharing, copied accounts, or changes by repository maintainers. A student can still change what appears in their own browser. There is no public leaderboard. Scores and groups are unofficial practice only.

Free-plan quotas and abuse controls still apply. Monitor Cloudflare usage; quotas do not guarantee availability if a limit is reached. This starter has no administrator dashboard or self-service deletion, so the project owner must define a retention/deletion process before collecting real student data.

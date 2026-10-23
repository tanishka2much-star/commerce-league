# Owner Economics AI Test Panel — Setup

The site is published as a static GitHub Pages site. GitHub Pages cannot run the secret-bearing AI backend, so the Owner chat calls a separate Cloudflare Worker. The Worker holds the OpenAI API key and an Owner access token; neither secret is included in the site source.

## One-time setup

1. In Cloudflare, create a Worker and paste the repository's `worker.js` into its editor. Deploy it.
2. In that Worker’s **Settings → Variables and Secrets**, add:
   - Secret `OPENAI_API_KEY`: your OpenAI API key.
   - Secret `OWNER_ACCESS_TOKEN`: a separate long random token that you keep private. You can generate one locally in PowerShell with:
     `[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`
   - Plain-text variable `SITE_ORIGIN`: `https://tanishka2much-star.github.io`
   - Optional plain-text variable `OPENAI_MODEL`: defaults to `gpt-6-astra`.
3. Deploy the Worker again after setting the variables and secrets.
4. In Commerce League, open **Cloffice → Owner**. Enter the Worker URL ending in `/api/chat` and the private Owner access token. Select **Use for this tab**, then send a test question. The token is held in memory for that browser tab and is cleared by **Disconnect** or closing the page.

Use the exact `*.workers.dev` HTTPS Worker URL. The backend allows browser requests only from the GitHub Pages origin above and validates the token before making a model request.

## Access and costs

The Owner panel is visible on the public site; it is not a login-protected page. The private Worker token gates requests to the AI backend. Keep it secret and disconnect after testing. Set an API usage budget in your OpenAI API account. API calls may incur charges separately from ChatGPT.

The Worker sends only the conversation messages to the OpenAI Responses API, sets `store: false`, and does not write chat logs to disk. Do not enter sensitive personal data.

## If setup fails

- **Owner access token did not match**: confirm the entered token exactly matches the Worker secret `OWNER_ACCESS_TOKEN`.
- **Could not reach the Worker**: confirm the URL ends with `/api/chat`, the Worker is deployed, and `SITE_ORIGIN` is exactly `https://tanishka2much-star.github.io`.
- **AI service could not authorize this request**: check the Worker secret `OPENAI_API_KEY`, the selected model, and API account access/billing.

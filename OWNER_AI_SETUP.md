# Future Live AI Upgrade

The current **Cloffice → Owner** panel contains a built-in Economics mini tutor demo. It works on the static GitHub Pages site without a key or external service. Replies come from a small local set of Economics explanations and practice prompts; it is not a generative model.

When ready to connect a real model, the repository's `worker.js` is a secure backend starting point. GitHub Pages cannot run private API code, so deploy the Worker separately and keep secrets there:

- `OPENAI_API_KEY`: OpenAI API key, stored as a Worker secret.
- `OWNER_ACCESS_TOKEN`: a separate, long random secret to gate Owner requests.
- `SITE_ORIGIN`: `https://tanishka2much-star.github.io`.
- Optional `OPENAI_MODEL`: defaults to `gpt-6-astra`.

The current site interface does not yet connect to this Worker. A future integration should add a secure Worker URL and Owner token flow, and the Worker must validate both the site origin and the token. The Owner page itself is public, so do not rely on its location as authentication.

Never put an OpenAI API key or Owner token in the public HTML or repository. Do not share secrets in chat. API usage may incur separate charges.

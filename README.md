# Flotek Tender Radar

A single-file tool that searches UK public-sector procurement sources for opportunities matching Flotek's delivery capability, scores them, and produces a branded weekly shortlist.

No build step, no dependencies, no server. One HTML file.

## Deploy to GitHub Pages

1. Create a repository and add `index.html` at the root.
2. **Settings → Pages → Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Wait a minute, then open `https://<your-username>.github.io/<repo>/`.

That's the whole deployment.

## First run

Open the page and paste an Anthropic API key. Optionally add a Firecrawl key, which lets the tool read notice pages directly rather than relying on search results.

Both keys are held in your browser's local storage. They are never committed to the repository and are sent only to `api.anthropic.com`. Anyone else opening the page supplies their own key — which is why the repository can safely be public.

**Use a dedicated key with a spend limit set.** A key in a browser is a key that anyone with access to that machine's browser profile can read. Treat it as you would a saved password, and rotate it if a shared or public machine ever loads the page.

## How it works

**Sweeps.** Each selected sweep is one search pass with its own remit and terminology — telephony, managed IT, cabling, cyber and so on. They run in sequence and results are deduplicated by procurement reference, falling back to buyer and title.

**Scoring.** Each opportunity is scored 0–100 against Flotek's services and assigned a priority. Anything below 40 is discarded.

**Week-on-week comparison.** Every run is saved. The next one tags each result NEW, UPDATED (deadline, value or priority moved) or UNCHANGED, and lists anything that has dropped off since last time.

**Assessments.** "Qualify this" reads the notice and produces the why-we-match reasons, the three things needing confirmation, the commercial view and a recommended action. Results are cached, so reopening one costs nothing.

**Weekly report.** Takes the top five live opportunities ordered by next decision point and renders the branded pack — cover, at-a-glance page, then a page per opportunity. Print or save as PDF from the toolbar.

## What it can't do

**It can't reach portals behind supplier login.** In-Tend, ProContract, Atamis, Delta and most NHS and HE consortium portals need credentials. Above-threshold notices on those platforms are usually mirrored to Find a Tender or Contracts Finder; below-threshold local authority work often isn't.

**It can't run on a schedule.** Static hosting has no server, so nothing runs unless the page is open. The cadence setting shows a reminder when you next visit. For a report that arrives unattended, use "Copy scheduled-task prompt" and paste it into a scheduled task in Claude — that runs on its own, though it has no memory of previous runs and so can't do the week-on-week comparison.

**It can't be trusted blind.** Every figure comes from a model reading a web page. Verify deadlines, values and mandatory requirements against the original notice before committing bid resource.

## Running costs

Charged per API call against your Anthropic account. A sweep is roughly a few pence; a full assessment somewhat more. A weekly run across five or six sweeps plus a handful of assessments is a few pounds a month. Web search is billed separately from tokens — check current rates at https://docs.claude.com.

## Customising

Everything is in `index.html`:

- `SWEEPS` — the search areas and their terminology.
- `PROFILE` — the company description used in every prompt. Update this when Flotek's service lines change; it drives scoring accuracy more than anything else.
- `SOURCES` — the portals the search is pointed at.
- `:root` in the stylesheet — brand colours and typeface, set from the Flotek brand guidelines.

## Brand

Colours are the key values and tints from the guidelines: Russian Violet `#4b1c4b`, Plum `#8a3b8e`, Princeton Orange `#ee792c`, Meadow Green `#99bfaa`. Space Grotesk throughout — Regular for body, Medium for subheadings, Bold for headings, with the orange full stop on headings.

The logo is embedded as vector, taken from the guidelines. It appears only on white and on the dark aubergine, the two approved backgrounds, with at least one icon-height of clear space on all sides. `flotek-logo.svg` is included separately if you need it elsewhere.

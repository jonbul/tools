# PureVibeCoding — Tools

A personal collection of utilities built **100% with vibecoding**: not a single line written by hand, everything generated and evolved through AI conversations.

## What is this?

A set of tools to solve one-off problems without losing focus on my main projects. Whenever a specific need comes up — a calculator, a comparator, a script — instead of leaving it pending or spending days learning a new stack, I describe it and the AI builds it. Problem solved, focus kept.

## Tools

### Electricity price comparator (`comparator/`)
Self-contained HTML (no external dependencies) to compare Spanish electricity tariffs:
- Parses CNMC official comparator URLs to extract invoice data
- Supports **2.0TD** (3 periods) and **3.0TD** (6 periods) tariffs
- Multi-offer comparison with per-concept breakdown and savings/extra cost
- Import/export offers as CSV (`|` separator)
- **Datadis API** integration to fetch real hourly consumption data
- **Datadis session persistence**: token saved in `localStorage` — skip login on return visits, with explicit logout button
- **Datadis data export/import**: download fetched consumption as JSON and reload it later, working around the 24 h rate limit on repeated queries
- **Toast notification** after a successful Datadis fetch reminding the user to save the data before the rate limit kicks in
- Clear rate-limit error message when Datadis rejects a repeated query within 24 h

## Philosophy

I have plenty of repositories where I write every line myself. This one is different: whenever a specific utility need comes up, I describe it and the AI builds it. Problem solved, focus kept on whatever I was actually working on.

100% vibecoding. In this repo.

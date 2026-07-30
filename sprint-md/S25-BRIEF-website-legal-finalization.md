# Sprint Brief: S25 -- Website And Legal Page Finalization

## Intent

Finish the public website against the corrected contract: landing page plus readable legal subpages, production form proof, mobile proof, and no confusion between the public site and the operator app.

## Milestone Gate

Implementation sprint after FULLY FUNCTIONAL PRD

## Branch Target

`v1.1.0/heirright-contract-completion-s24-s25`

## Scope -- Included

- Verify the public website root remains `site-v2/` and the operator app remains `probate-lead-engine/`.
- Keep the landing page focused on HeirRight's public offer and contact intake.
- Ensure Terms of Use and Privacy Policy are readable legal subpages. Safer default: create/verify separate `terms.html` and `privacy.html` routes even if `legal.html` remains as an index.
- Keep or verify the contact page if it is already useful, but do not let it obscure the requested 3-page contract.
- Verify forms on landing and contact/legal routes behave as intended.
- Verify production aliases and avoid deploying website assets onto the app project.
- Update sitemap and route metadata.

## Strict IDI Core Advisory

The public website must not trigger IDI, enrichment, paid source use, or contact search. Website form submissions can create intake/review requests only.

- No IDI route, script, analytics event, or hidden enrichment action on the website.
- No paid lookup from public form submission.
- No mutation to the verified IDI intake path.

## Scope -- Excluded

- No new lead-generation acceptance claim.
- No app UI redesign.
- No legal copy invention beyond the already supplied Terms/Privacy content unless TP provides replacement text.
- No custom domain/DNS change unless explicitly requested.

## Acceptance Criteria

- [ ] `/` returns the landing page with the correct form behavior.
- [ ] `/terms.html` returns readable Terms of Use or `/legal.html#terms` is explicitly approved as the contract route.
- [ ] `/privacy.html` returns readable Privacy Policy or `/legal.html#privacy` is explicitly approved as the contract route.
- [ ] Sitemap includes the public legal routes.
- [ ] Desktop and mobile have no horizontal overflow or console errors.
- [ ] Production site alias is verified separately from the app alias.
- [ ] Form proof returns a reference id or a clear blocked state.

## Validation Commands

```bash
cd /Users/tifos/Documents/Codebases/heir-right/site-v2
pnpm build
```

Browser proof:

- Verify landing desktop/mobile.
- Verify Terms desktop/mobile.
- Verify Privacy desktop/mobile.
- Verify contact/form path if present.
- Confirm app project `heirright-landing-demo` remains healthy if a deploy occurs.

## Handoff

S25 hands off to S26 when the public website route contract is production-proved and clearly separated from the operator app.

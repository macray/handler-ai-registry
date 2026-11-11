You audit this project's interface with the `impeccable` skill's `audit` command (Paul Bakaus's
Impeccable, https://github.com/pbakaus/impeccable, Apache-2.0). Follow its playbook in full, and
run the detector on what you audit: `impeccable detect <the folder>`, and on the rendered pages
too when the project can run.

What to audit is the form's `target`: a page, a flow, a folder or a component; nothing for the
whole interface.

You only read and report: never edit, create or delete a file in the project, never commit,
never install anything into it. No one is there to answer questions: when something is unclear,
decide, and say so in `notChecked`.

Your result holds the audit's report: `scores`, each dimension's 0 to 4 with its key finding,
`total` out of 20 and its rating band, the implementation integrity verdict in `integrity`, each
finding with its severity, and the recommended commands in order in `nextSteps`.

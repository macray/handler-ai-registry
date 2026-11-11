<script lang="ts">
  // Notes: write or paste notes, Scribe (your agent) turns each into actions, decisions, questions
  // and a follow-up; your open actions on top. Everything is in the folder you gave it (the backend
  // reads and writes it), so a note dropped there from an editor shows up here too.
  import ActionRow from "./ActionRow.svelte";
  import { api } from "./api";
  import type { Item, State } from "./types";

  const SAMPLE = `Weekly sync with Alice and Sam

- launch: we keep Friday 30 Oct, no new features after Wednesday
- login bug still there on Safari, Alice takes it
- Sam needs the Q3 numbers for the board, I send them by Tuesday
- pricing page: nobody owns it?? to sort out
- demo next week: need a room, Sam books it
- Alice asked if we could move the retro to Thursday, ok for everyone`;

  let state = $state<State | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let text = $state("");
  let title = $state("");
  let question = $state("");
  let everyone = $state(false);
  let copied = $state<string | null>(null);

  const today = $derived.by(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const working = $derived(state?.asks.some((a) => a.state === "waiting" || a.state === "running") ?? false);
  const latest = $derived(state?.asks[0]);
  const waiting = $derived(state?.notes.filter((n) => !n.done).length ?? 0);
  const open = $derived(
    (state?.notes ?? [])
      .flatMap((n) => n.actions.filter((a) => !a.done).map((a): Item & { note: string; from: string } => ({ ...a, note: n.name, from: n.title })))
      .filter((a) => everyone || a.owner === "me")
      .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")),
  );

  /** One call to the backend; the page shows what it answers. False when it failed. */
  async function act(method: string, path: string, body?: unknown): Promise<boolean> {
    busy = true;
    error = null;
    try {
      state = await api<State>(path, { method, body });
      return true;
    } catch (e) {
      error = (e as Error).message;
      return false;
    } finally {
      busy = false;
    }
  }

  async function refresh(): Promise<void> {
    try {
      state = await api<State>("state");
    } catch (e) {
      error = (e as Error).message;
    }
  }

  // Scribe (or your editor) may change the folder at any time: looked at again, more often while it works
  $effect(() => {
    void refresh();
  });
  $effect(() => {
    const timer = setInterval(refresh, working ? 4000 : 30000);
    return () => clearInterval(timer);
  });

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (await act("POST", "notes", { text, title })) text = title = "";
  }

  async function ask(event?: SubmitEvent, q = question): Promise<void> {
    event?.preventDefault();
    if (await act("POST", "ask", { request: q })) question = "";
  }

  async function remove(name: string, noteTitle: string): Promise<void> {
    if (confirm(`Delete “${noteTitle}” and its actions?`)) await act("DELETE", `notes/${encodeURIComponent(name)}`);
  }

  async function copy(name: string, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      copied = name;
      setTimeout(() => (copied = null), 2000);
    } catch {
      error = "Copying is not allowed here: select the text instead.";
    }
  }

  function when(at: string): string {
    return new Date(at).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function ago(at: string): string {
    const minutes = Math.round((Date.now() - new Date(at).getTime()) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
    return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }
</script>

<main>
  <header>
    <h1>Notes</h1>
    <span class="date">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span>
  </header>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <form class="card write" onsubmit={save}>
    <textarea bind:value={text} rows="6" maxlength="50000" aria-label="your notes"
      placeholder="Paste or type your notes: a meeting, a call, a brain dump. Scribe finds what to do, who does it, what was decided."></textarea>
    {#if text.trim()}<input bind:value={title} maxlength="100" placeholder="Title (optional)" aria-label="title" />{/if}
    <div class="buttons">
      <button class="primary" disabled={busy || !text.trim()}>Get the actions</button>
      {#if !text}<button type="button" class="link" onclick={() => (text = SAMPLE)}>Try with sample notes</button>{/if}
    </div>
  </form>

  {#if state}
    {#if working || (latest && latest.state !== "succeeded" && latest.state !== "cancelled")}
      <p class="status {latest?.state}" role="status">
        {#if latest?.state === "waiting"}Scribe is finishing another run; yours comes next.
        {:else if latest?.state === "running"}Scribe is reading{waiting ? ` ${waiting} new note${waiting === 1 ? "" : "s"}` : ""} (a minute or two). You can close the app: it also comes to your inbox.
        {:else if latest?.state === "failed"}<span class="error">Scribe did not answer: {latest.error ?? "the run failed"}</span>{/if}
      </p>
    {/if}

    <section>
      <h2>
        Still open {#if open.length}<span class="count">{open.length}</span>{/if}
        <span class="toggle">
          <button type="button" class="chip" class:on={!everyone} onclick={() => (everyone = false)}>Mine</button>
          <button type="button" class="chip" class:on={everyone} onclick={() => (everyone = true)}>Everyone's</button>
        </span>
      </h2>
      <div class="card list">
        {#each open as a (`${a.note}:${a.line}`)}
          <ActionRow item={a} note={a.note} from={a.from} {today} {busy} {act} />
        {:else}
          <p class="muted empty">{state.notes.length ? "Nothing open. Well done." : "Your actions show up here, from every note."}</p>
        {/each}
      </div>
    </section>

    <section class="card scribe">
      <h2>Scribe</h2>
      {#if state.messages.length}
        <ul class="plain told">
          {#each state.messages.slice(0, 3) as m (m.id)}<li><p class="said">{m.text}</p><small>{ago(m.at)}</small></li>{/each}
        </ul>
      {/if}
      <form onsubmit={ask}>
        <textarea bind:value={question} rows="2" placeholder="Ask about your notes…" aria-label="your question" maxlength="2000"
          onkeydown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && question.trim()) void ask(); }}></textarea>
        <button class="primary" disabled={busy || working || !question.trim()}>Ask</button>
      </form>
      {#if !question}
        <div class="chips">
          {#each ["What did we decide this week?", "What is everyone waiting on?", "What should I do first?"] as q (q)}
            <button type="button" class="chip" disabled={busy || working || !state.notes.length} onclick={() => ask(undefined, q)}>{q}</button>
          {/each}
        </div>
      {/if}
      {#if latest?.state === "succeeded" && latest.summary}
        <div class="answer {latest.status ?? ''}">
          <p class="asked">“{latest.request}” <small>{ago(latest.at)}</small></p>
          <p class="summary">{latest.summary}</p>
        </div>
      {/if}
    </section>

    {#if state.notes.length}
      <section>
        <h2>Notes</h2>
        {#each state.notes as n (n.name)}
          <details class="card note">
            <summary>
              <span class="title">{n.title}</span>
              <small>{when(n.at)}</small>
              {#if !n.done}<span class="badge">not done yet</span>
              {:else if n.actions.length}<small>{n.actions.filter((a) => !a.done).length} open of {n.actions.length}</small>{/if}
            </summary>
            {#if n.actions.length}
              <h3>Actions</h3>
              <div class="list">{#each n.actions as a (a.line)}<ActionRow item={a} note={n.name} {today} {busy} {act} />{/each}</div>
            {/if}
            {#if n.decisions.length}
              <h3>Decisions</h3>
              <ul>{#each n.decisions as d, i (i)}<li>{d}</li>{/each}</ul>
            {/if}
            {#if n.questions.length}
              <h3>Questions</h3>
              <ul>{#each n.questions as q, i (i)}<li>{q}</li>{/each}</ul>
            {/if}
            {#if n.followup}
              <h3>Follow-up <button type="button" class="link" onclick={() => copy(n.name, n.followup ?? "")}>{copied === n.name ? "Copied" : "Copy"}</button></h3>
              <p class="followup">{n.followup}</p>
            {/if}
            <details class="source">
              <summary>The note</summary>
              <p class="said">{n.text}</p>
            </details>
            <div class="buttons"><button type="button" class="danger" disabled={busy} onclick={() => remove(n.name, n.title)}>Delete</button></div>
          </details>
        {/each}
      </section>
    {/if}

    <footer>
      <p>In {state.folder}: <code>notes/</code> and <code>actions/</code>, yours to read and edit too, shared with Scribe. A note dropped in <code>notes/</code> from any editor is read too.</p>
      <p>Want it to send your actions to Planner, use your team's names, or write the follow-up your way? Open this app's page in Handler and <strong>Change it</strong>: tell the App creator what you want.</p>
    </footer>
  {:else if !error}
    <p class="muted">Loading…</p>
  {/if}
</main>

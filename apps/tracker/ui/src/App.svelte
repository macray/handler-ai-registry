<script lang="ts">
  // The Tracker: your trackers (a tap logs one step), today's log, and your Coach. Everything is in
  // the folder you gave it (the backend reads and writes it), so the Coach sees what you log here at
  // its next run, and what it tells you shows up here.
  import { api } from "./api";
  import TrackerCard from "./TrackerCard.svelte";
  import type { State } from "./types";

  // a start, for an empty folder: one tap makes it
  const STARTERS = [
    { name: "Water", unit: "glasses", goal: 8, step: 1 },
    { name: "Coffee", unit: "cups", step: 1 },
    { name: "Walk", unit: "min", goal: 30, step: 10 },
    { name: "Reading", unit: "pages", goal: 20, step: 10 },
    { name: "Focus", unit: "sessions", goal: 4, step: 1 },
    { name: "Interruptions", step: 1 },
  ];

  let state = $state<State | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let question = $state("");
  let adding = $state(false);
  let name = $state("");
  let unit = $state("");
  let goal = $state("");

  const asking = $derived(state?.asks.some((a) => a.state === "waiting" || a.state === "running") ?? false);
  const latest = $derived(state?.asks[0]);
  const names = $derived(new Map((state?.trackers ?? []).map((t) => [t.id, t])));
  const starters = $derived(STARTERS.filter((s) => !state?.trackers.some((t) => t.name.toLowerCase() === s.name.toLowerCase())));

  /** The day on your clock, sent with every call: the server's may differ. */
  function today(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** One call to the backend; the page shows what it answers. False when it failed. */
  async function act(method: string, path: string, body?: unknown): Promise<boolean> {
    busy = true;
    error = null;
    try {
      state = await api<State>(`${path}?today=${today()}`, { method, body });
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
      state = await api<State>(`state?today=${today()}`);
    } catch (e) {
      error = (e as Error).message;
    }
  }

  // the Coach (or your editor) may change the folder at any time: looked at again, more often while it works
  $effect(() => {
    void refresh();
  });
  $effect(() => {
    const timer = setInterval(refresh, asking ? 4000 : 30000);
    return () => clearInterval(timer);
  });

  async function ask(event?: SubmitEvent, text = question): Promise<void> {
    event?.preventDefault();
    if (await act("POST", "ask", { request: text })) question = "";
  }

  async function add(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (await act("POST", "trackers", { name, unit, goal })) {
      name = unit = goal = "";
      adding = false;
    }
  }

  function ago(at: string): string {
    const minutes = Math.round((Date.now() - new Date(at).getTime()) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
    return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }

  function time(at: string): string {
    return new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
</script>

<main>
  <header>
    <h1>Tracker</h1>
    <span class="date">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span>
  </header>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if state}
    {#if state.trackers.length}
      <section class="grid">
        {#each state.trackers as t (t.id)}<TrackerCard tracker={t} {busy} {act} />{/each}
      </section>
    {:else}
      <section class="card welcome">
        <h2>What do you want to count?</h2>
        <p class="muted">Tap one to start, or make your own. Then a tap on <strong>+</strong> logs it, here or on your phone.</p>
      </section>
    {/if}

    <section class="add">
      {#if starters.length}
        <div class="chips">
          {#each starters as s (s.name)}
            <button type="button" class="chip" disabled={busy} onclick={() => act("POST", "trackers", s)}>+ {s.name}</button>
          {/each}
          <button type="button" class="chip" class:on={adding} onclick={() => (adding = !adding)}>Your own…</button>
        </div>
      {:else}
        <button type="button" class="link" onclick={() => (adding = !adding)}>+ Track something else</button>
      {/if}
      {#if adding}
        <form class="card settings" onsubmit={add}>
          <label>Name <input bind:value={name} maxlength="40" placeholder="Push-ups, sleep, meetings…" /></label>
          <label>Unit <input bind:value={unit} maxlength="20" placeholder="optional" /></label>
          <label>Goal a day <input type="number" step="any" min="0" bind:value={goal} placeholder="optional" /></label>
          <div class="buttons"><button class="primary" disabled={busy || !name.trim()}>Add</button></div>
        </form>
      {/if}
    </section>

    <section class="card coach">
      <h2>Coach</h2>
      {#if state.messages.length}
        <ul class="plain told">
          {#each state.messages.slice(0, 3) as m (m.id)}<li><p class="said">{m.text}</p><small>{ago(m.at)}</small></li>{/each}
        </ul>
      {:else}
        <p class="muted">Your Coach looks at your numbers when you ask, and on its own if you turn on its check-ins (on the app's page in Handler).</p>
      {/if}
      <form onsubmit={ask}>
        <textarea bind:value={question} rows="2" placeholder="Ask your Coach…" aria-label="your question" maxlength="2000"
          onkeydown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && question.trim()) void ask(); }}></textarea>
        <button class="primary" disabled={busy || asking || !question.trim()}>Ask</button>
      </form>
      {#if !question}
        <div class="chips">
          {#each ["How was my week?", "Am I on track today?", "What should I change?"] as q (q)}
            <button type="button" class="chip" disabled={busy || asking || !state.trackers.length} onclick={() => ask(undefined, q)}>{q}</button>
          {/each}
        </div>
      {/if}
      {#if latest}
        <div class="answer {latest.status ?? ''}">
          <p class="asked">“{latest.request}” <small>{ago(latest.at)}</small></p>
          {#if latest.state === "waiting"}
            <p class="working">Your Coach is finishing another run; yours comes next.</p>
          {:else if latest.state === "running"}
            <p class="working">Your Coach is looking (a minute or two). You can close the app: the answer also comes to your inbox.</p>
          {:else if latest.state === "succeeded"}
            <p class="summary">{latest.summary}</p>
          {:else if latest.state === "cancelled"}
            <p class="muted">Cancelled.</p>
          {:else}
            <p class="error">It did not answer: {latest.error ?? "the run failed"}</p>
          {/if}
        </div>
      {/if}
    </section>

    {#if state.entries.length}
      <section>
        <h2>Today</h2>
        <div class="card list">
          {#each state.entries as e (e.id)}
            <div class="row">
              <span class="text"><span>{names.get(e.tracker)?.name} <strong>+{e.amount}</strong> {names.get(e.tracker)?.unit ?? ""}</span>{#if e.note}<small>{e.note}</small>{/if}</span>
              <small>{time(e.at)}</small>
              <button type="button" class="undo" disabled={busy} onclick={() => act("DELETE", `log/${e.id}`)}>Undo</button>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <footer>
      <p>In {state.folder}: <code>trackers.json</code> and <code>log.jsonl</code>, yours to read and edit too, shared with your Coach.</p>
      <p>Want a chart, a reminder, another way to count? Open this app's page in Handler and <strong>Change it</strong>: tell the App creator what you want.</p>
    </footer>
  {:else if !error}
    <p class="muted">Loading…</p>
  {/if}
</main>

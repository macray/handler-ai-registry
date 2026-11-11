<script lang="ts">
  // One tracker: today against its goal, a tap to log one step, the last 7 days, and its settings.
  import type { Tracker } from "./types";

  let { tracker, busy, act }: { tracker: Tracker; busy: boolean; act: (method: string, path: string, body?: unknown) => Promise<boolean> } = $props();

  let open = $state(false);
  let amount = $state("");
  let name = $state("");
  let unit = $state("");
  let goal = $state("");
  let step = $state("");

  const unitText = $derived(tracker.unit ? ` ${tracker.unit}` : "");
  const max = $derived(Math.max(tracker.goal ?? 0, ...tracker.week.map((d) => d.total), 1));
  const reached = $derived(!!tracker.goal && tracker.today >= tracker.goal);

  function edit(): void {
    open = !open;
    name = tracker.name;
    unit = tracker.unit ?? "";
    goal = tracker.goal ? String(tracker.goal) : "";
    step = String(tracker.step);
    amount = "";
  }

  async function logSome(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (await act("POST", "log", { tracker: tracker.id, amount: Number(amount) })) amount = "";
  }

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (await act("PUT", `trackers/${tracker.id}`, { name, unit, goal, step })) open = false;
  }

  async function remove(): Promise<void> {
    if (confirm(`Stop tracking ${tracker.name}? What you logged stays in log.jsonl.`)) await act("DELETE", `trackers/${tracker.id}`);
  }

  function weekday(day: string): string {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "narrow" });
  }
</script>

<article class="card tracker" class:reached>
  <div class="top">
    <button type="button" class="name" onclick={edit} aria-expanded={open}>{tracker.name}</button>
    {#if tracker.streak > 1}<span class="streak" title="days in a row">{tracker.streak} days</span>{/if}
  </div>
  <div class="now">
    <p><strong>{tracker.today}</strong>{#if tracker.goal}<span class="muted">&nbsp;/ {tracker.goal}</span>{/if}<span class="muted">{unitText}</span></p>
    <button type="button" class="plus primary" disabled={busy} onclick={() => act("POST", "log", { tracker: tracker.id })} aria-label="add {tracker.step}{unitText} to {tracker.name}">
      +{tracker.step === 1 ? "" : tracker.step}
    </button>
  </div>
  {#if tracker.goal}
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax={tracker.goal} aria-valuenow={tracker.today}>
      <span style="width: {Math.min(100, (tracker.today / tracker.goal) * 100)}%"></span>
    </div>
  {/if}
  <div class="week" aria-label="the last 7 days">
    {#each tracker.week as d (d.day)}
      <div class="day" title="{d.day}: {d.total}{unitText}">
        <span class="col"><span class:met={tracker.goal ? d.total >= tracker.goal : d.total > 0} style="height: {(d.total / max) * 100}%"></span></span>
        <small>{weekday(d.day)}</small>
      </div>
    {/each}
  </div>

  {#if open}
    <form class="more" onsubmit={logSome}>
      <input type="number" step="any" min="0" bind:value={amount} placeholder="Another amount" aria-label="amount" />
      <button disabled={busy || !(Number(amount) > 0)}>Add</button>
    </form>
    <form class="settings" onsubmit={save}>
      <label>Name <input bind:value={name} maxlength="40" /></label>
      <label>Unit <input bind:value={unit} maxlength="20" placeholder="glasses, km, pages…" /></label>
      <label>Goal a day <input type="number" step="any" min="0" bind:value={goal} placeholder="none" /></label>
      <label>One tap adds <input type="number" step="any" min="0" bind:value={step} /></label>
      <div class="buttons">
        <button class="primary" disabled={busy || !name.trim()}>Save</button>
        <button type="button" onclick={() => (open = false)}>Cancel</button>
        <button type="button" class="danger" disabled={busy} onclick={remove}>Stop tracking</button>
      </div>
    </form>
  {/if}
</article>

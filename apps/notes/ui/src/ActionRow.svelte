<script lang="ts">
  // One action: its box (ticked in its actions file), what to do, whose, by when, from which note.
  import type { Item } from "./types";

  let { item, note, from, today, busy, act }: {
    item: Item;
    note: string;
    from?: string; // the note's title, when listed outside it
    today: string;
    busy: boolean;
    act: (method: string, path: string, body?: unknown) => Promise<boolean>;
  } = $props();

  const late = $derived(!item.done && !!item.due && item.due < today);

  function day(d: string): string {
    if (d === today) return "today";
    const [y, m, n] = d.split("-").map(Number);
    return new Date(y, m - 1, n).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  }
</script>

<label class="row" class:done={item.done}>
  <input type="checkbox" checked={item.done} disabled={busy}
    onchange={(e) => act("POST", `notes/${encodeURIComponent(note)}/actions/${item.line}`, { done: e.currentTarget.checked })} />
  <span class="text">
    <span class="title">{item.text}</span>
    {#if item.owner || item.due || from}
      <span class="meta">
        {#if item.owner}<span class="owner" class:me={item.owner === "me"}>{item.owner === "me" ? "You" : item.owner}</span>{/if}
        {#if item.due}<span class:late>{late ? "late, " : ""}{day(item.due)}</span>{/if}
        {#if from}<span>· {from}</span>{/if}
      </span>
    {/if}
  </span>
</label>

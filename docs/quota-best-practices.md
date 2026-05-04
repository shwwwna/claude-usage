# Claude Quota System & Best Practices Guide

## How the Quota System Works

### Session & Weekly Limits
- **5-hour rolling session window** governs short-term limits
- **Weekly cap** governs total usage across the week
- Claude.ai (web/app) and Claude Code share the same usage pool on your Pro/Max plan

### Conversation Cost Escalation
Longer conversations cost exponentially more per message because the entire conversation history is re-processed with each turn:
- Message 1 in a new conversation: ~500 input tokens
- Message 30 in the same conversation: 40,000+ tokens

### Peak Hour Effects
Peak hours (roughly 05:00–11:00 PT) reduce your effective session capacity further. Off-peak usage allows higher throughput.

---

## Best Practices for Claude.ai (Web/App)

### High-Leverage Habits
1. **Start new conversations frequently** — This is the single highest-leverage habit. Five conversations of 10 messages each are far cheaper than one conversation of 50 messages.

2. **Default to Sonnet, use Opus strategically** — Opus consumes your allocation 3–5x faster than Sonnet. Use Opus for complex reasoning, architecture decisions, and nuanced writing. Use Sonnet for everything else.

3. **Use Projects with uploaded documents** — Content in projects is cached and doesn't count against your limits when reused. Upload reference materials once instead of re-pasting them.

4. **Batch related questions** — Group multiple questions into a single message instead of sending separate ones to reduce back-and-forth.

5. **Write complete, specific prompts upfront** — Include all relevant context, constraints, and desired format in one message. Vague prompts generate clarification rounds that eat tokens.

6. **Use memory and past chat search** — Search previous conversations to prevent re-providing the same information repeatedly.

7. **Check Settings > Usage regularly** — Navigate to Settings > Usage to view progress bars showing how much of your 5-hour session and weekly limits you've consumed.

8. **Shift heavy work to off-peak hours** — Off-peak usage allows higher throughput. Peak hours burn through limits faster. Your timezone influences when you naturally have off-peak access.

9. **Enable extra usage as overflow insurance** — Once enabled, hitting your plan limit no longer stops you completely — you continue at API rates with a cap you control.

---

## Best Practices for Claude Code (VS Code / Terminal)

### Cost Optimization Strategies

1. **Keep CLAUDE.md lean** — Every word in CLAUDE.md is read at the start of every session, so keep only essential instructions. Target under 150–200 lines. Ask for each line: would Claude make a mistake without this?

2. **Use /clear aggressively** — Every time you start something new, clear the chat. You don't need old history eating tokens.

3. **Use Opus for planning, Sonnet for implementation** — With the `opusplan` setting, Claude uses Opus during plan mode for reasoning and switches to Sonnet for code generation, giving you the best of both worlds.

4. **Use .claudeignore** — Works like .gitignore. If Claude can't see files, it can't accidentally read them. This is one of the highest-leverage moves for keeping token usage down.

5. **Point Claude to specific files, not the whole codebase** — When you ask Claude to "look at the codebase and figure out X," it may read several files in sequence. Tell it exactly which file or function to examine.

6. **Use skills instead of bloated CLAUDE.md** — Skills load only when relevant, keeping context lean. Unlike CLAUDE.md which loads every session.

7. **Use plan mode for anything non-trivial** — Starting with plan mode prevents Claude from going down the wrong path and wasting tokens on incorrect implementations.

8. **Use /rewind or Esc Esc when off-track** — Undo and restart rather than trying to fix it within the same bloated context.

9. **Compact manually at ~50% context usage** — Avoid the "agent dumb zone" by doing manual `/compact` at max 50% context, rather than waiting for automatic compaction.

---

## Anti-Patterns to Avoid

### High-Cost Mistakes

- **Don't keep one mega-conversation running** — This is the #1 quota killer. Each message re-sends the full history.

- **Don't default to Opus for everything** — Most coding, summarization, and drafting tasks perform well on Sonnet at a fraction of the cost.

- **Don't re-upload or re-paste the same documents** — Use Projects instead to cache and reuse content.

- **Don't send vague one-liners and iterate** — "Make it better" or "fix the bug" without context generates wasted rounds.

- **Don't let Claude explore the whole repo unscoped** — Asking Claude to "investigate" without scoping it leads to hundreds of file reads. Scope narrowly or use subagents.

- **Don't overload CLAUDE.md with aspirational text** — Cut anything descriptive or non-behavioral. If it doesn't change how Claude should behave, it doesn't belong there.

- **Don't @-file large docs in Claude Code** — Using @-file embeds the entire file on every run. Instead, reference the path and let Claude read on demand.

- **Don't ignore the usage dashboard** — You have no other visibility into how fast you're burning quota.

- **Don't run Claude Code in automated loops without rate-limit handling** — One session in a loop can drain your daily budget in minutes.

- **Don't avoid /compact** — Automatic compaction is opaque and not well-optimized. Manual compaction with instructions on what to preserve gives better results.

---

## Summary

**Core principle:** Quota is consumed by tokens, not by time or conversation count. Shorter, more frequent conversations with complete context upfront are far more efficient than longer, iterative ones. Use the tool's usage dashboard to track your consumption and adjust your habits accordingly.

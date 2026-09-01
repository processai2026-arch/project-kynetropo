import { useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { namesakeHint, type TeamMember } from "@/hooks/useTeamMembers";
import type { CommentMention } from "@/types/sales";

/**
 * A textarea that understands "@".
 *
 * Type @ and the team appears; pick a name and it is inserted as plain text.
 * The ids are tracked alongside, and `mentionsIn()` keeps only the ones whose
 * name is still actually written in the box — so deleting the text deletes the
 * mention, and nobody is notified about a comment that no longer names them.
 *
 * Deliberately a plain <textarea> rather than a contenteditable rich editor:
 * the body is stored and shown as plain text everywhere else in the module
 * (notifications, the feed, the lead timeline), and a rich editor would be the
 * only place it was not.
 */

/** Longest names first, so "@Ravi Kumar" wins over "@Ravi". */
function byLengthDesc(a: { name: string }, b: { name: string }): number {
  return b.name.length - a.name.length;
}

/**
 * The mentions actually present in the text.
 *
 * Names are matched literally against "@Name". A name typed by hand that
 * happens to match a colleague counts too — if you wrote it, you meant them.
 */
export function mentionsIn(text: string, people: TeamMember[]): number[] {
  const found: number[] = [];
  for (const person of [...people].sort(byLengthDesc)) {
    if (person.name && text.includes("@" + person.name)) {
      found.push(person.user_id);
    }
  }
  return found;
}

/** Splits a body into text and @mention runs, for highlighting. */
export function splitMentions(
  body: string,
  mentions: CommentMention[] | undefined,
): { text: string; mention: boolean }[] {
  const names = (mentions ?? []).map((m) => m.name).filter(Boolean).sort((a, b) => b.length - a.length);
  if (names.length === 0) return [{ text: body, mention: false }];

  const parts: { text: string; mention: boolean }[] = [];
  let i = 0;
  outer: while (i < body.length) {
    if (body[i] === "@") {
      for (const name of names) {
        if (body.startsWith(name, i + 1)) {
          parts.push({ text: "@" + name, mention: true });
          i += name.length + 1;
          continue outer;
        }
      }
    }
    // Accumulate plain text one character at a time, merging into the previous
    // run so the output stays a handful of nodes rather than one per letter.
    const last = parts[parts.length - 1];
    if (last && !last.mention) last.text += body[i];
    else parts.push({ text: body[i], mention: false });
    i += 1;
  }
  return parts;
}

/** The "@ricky" fragment immediately before the caret, if there is one. */
function activeQuery(text: string, caret: number): { query: string; start: number } | null {
  const upto = text.slice(0, caret);
  // An @ starts a mention only at the start of the text or after whitespace —
  // otherwise every email address in a comment would open the picker.
  const match = /(?:^|\s)@([^\s@]{0,40})$/.exec(upto);
  if (!match) return null;
  return { query: match[1], start: caret - match[1].length - 1 };
}

export function MentionInput({
  value,
  onChange,
  people,
  rows = 3,
  maxLength,
  placeholder,
  className,
  disabled,
  onSubmit,
}: {
  value: string;
  onChange: (next: string) => void;
  people: TeamMember[];
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Ctrl/Cmd+Enter posts, as long as the picker is not open. */
  onSubmit?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [query, setQuery] = useState<{ query: string; start: number } | null>(null);
  const [highlight, setHighlight] = useState(0);

  const matches = useMemo(() => {
    if (!query) return [];
    const q = query.query.toLowerCase();
    return people.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, people]);

  // A picker with nothing in it is a floating empty box; close it instead.
  useEffect(() => {
    if (query && matches.length === 0) setQuery(null);
  }, [query, matches.length]);

  useEffect(() => setHighlight(0), [query?.query]);

  const syncQuery = () => {
    const el = ref.current;
    if (!el) return;
    setQuery(activeQuery(el.value, el.selectionStart ?? el.value.length));
  };

  const insert = (person: TeamMember) => {
    const el = ref.current;
    if (!el || !query) return;
    const caret = el.selectionStart ?? el.value.length;
    const next = value.slice(0, query.start) + "@" + person.name + " " + value.slice(caret);
    onChange(next);
    setQuery(null);
    // Put the caret after the inserted name once React has re-rendered, or the
    // browser leaves it wherever the old text put it.
    const at = query.start + person.name.length + 2;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(at, at);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (query && matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insert(matches[highlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setQuery(null);
        return;
      }
    }
    if (onSubmit && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative w-full">
      <Textarea
        ref={ref}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          // After the value, not before: the query is read off the element and
          // the element still holds the previous value until React commits.
          requestAnimationFrame(syncQuery);
        }}
        onClick={syncQuery}
        onKeyUp={syncQuery}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // A click on the list fires blur first; let it land.
          window.setTimeout(() => setQuery(null), 120);
        }}
      />

      {query && matches.length > 0 && (
        <ul
          role="listbox"
          aria-label="Mention a colleague"
          className="absolute bottom-full left-0 z-50 mb-1 max-h-56 w-64 overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg"
        >
          {matches.map((person, i) => (
            <li key={person.user_id}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                // onMouseDown, not onClick: mousedown fires before the
                // textarea's blur, so the picker is still open when we insert.
                onMouseDown={(e) => {
                  e.preventDefault();
                  insert(person);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  i === highlight ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-semibold text-primary">
                  {person.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{person.name}</span>
                  {/* Only when the name is shared — otherwise it is just noise. */}
                  {namesakeHint(person) && (
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {namesakeHint(person)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A comment body with its @mentions picked out. */
export function CommentBody({ body, mentions }: { body: string; mentions?: CommentMention[] }) {
  const parts = useMemo(() => splitMentions(body, mentions), [body, mentions]);
  return (
    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted-foreground">
      {parts.map((part, i) =>
        part.mention ? (
          <span key={i} className="rounded bg-primary/10 px-1 font-medium text-primary">
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

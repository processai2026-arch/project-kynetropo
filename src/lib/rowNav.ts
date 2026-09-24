import type { KeyboardEvent, MouseEvent } from "react";

/**
 * A table row that opens its record — from the mouse OR the keyboard.
 *
 * Every list in the app opens a record by clicking the row rather than by an
 * eye button in an actions column: the button costs a column of width on every
 * table and makes "open" a small target while the rest of the row, the part
 * people actually aim at, does nothing.
 *
 * The half that was missing is the keyboard. Rows carried a bare `onClick`, so
 * the whole app's primary navigation was mouse-only — unreachable by Tab, and
 * invisible to anything driving the page by keyboard. `tabIndex` puts the row
 * in the tab order, Enter and Space open it, and a focus ring says where you
 * are.
 *
 *     <tr className="…" {...rowOpenProps(() => navigate(`/operators/${op.id}`))}>
 *
 * Not only rows: the Work Board's cards are the same interaction in a
 * different shape, so the event is typed to HTMLElement rather than to
 * HTMLTableRowElement.
 *
 * A control INSIDE the row does its own thing and does NOT open the record —
 * see INTERACTIVE below.
 */
export function rowOpenProps(open: () => void) {
  return {
    tabIndex: 0,
    /*
     * A click that landed on a control inside the row belongs to that control.
     *
     * This used to be a bare `onClick: open`, which meant every link and every
     * button inside a clickable row did its own job AND opened the record. The
     * damage was quiet and everywhere: pressing a staff name to see who they
     * are opened their attendance day over the top of the popup it had just
     * asked for; the map link on a punch opened Google Maps in a new tab and
     * navigated the tab you were still looking at. Two things happened, one of
     * them was never asked for, and the one you wanted was the one that got
     * covered up.
     *
     * `stopRowOpen` was the documented fix and it is per-control, so it had to
     * be remembered on every button in every table — 25 files use rowOpenProps
     * and 3 of them remembered. A rule that is obeyed 12% of the time is not a
     * rule, so the row asks the question itself: did this click start on
     * something clickable? Then it was not a click on the row.
     *
     * `closest` is scoped to the row with contains(), so a row nested inside
     * some other control cannot swallow its own clicks.
     */
    onClick: (event: MouseEvent<HTMLElement>) => {
      const target = event.target as Element | null;
      const control = target?.closest?.(INTERACTIVE) ?? null;
      if (control && event.currentTarget.contains(control)) return;
      open();
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      // A key pressed inside a button or an input belongs to that control —
      // Space on a checkbox must tick it, not navigate away from the page.
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    },
  };
}

/**
 * What counts as "a control", and so as not-the-row.
 *
 * Roles as well as tags, because a shadcn Select trigger, a Radix checkbox and
 * a dropdown item are divs wearing a role rather than real elements — and they
 * are exactly the things people put in a table row.
 */
const INTERACTIVE = [
  "a[href]", "button", "input", "select", "textarea", "label",
  "[role='button']", "[role='link']", "[role='checkbox']", "[role='switch']",
  "[role='menuitem']", "[role='menuitemcheckbox']", "[role='menuitemradio']",
  "[role='option']", "[role='tab']", "[role='combobox']", "[role='radio']",
  "[contenteditable='true']",
].join(", ");

/**
 * The className a clickable row carries. Kept here with the behaviour so a row
 * cannot end up focusable with nothing to show for it.
 *
 * `ring-inset`, because a ring drawn outside a <tr> is clipped by the scroll
 * container on the first and last rows and by the neighbouring cells elsewhere.
 */
export const ROW_OPEN_CLASS =
  "border-b cursor-pointer transition-colors hover:bg-muted/30 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

/**
 * Wrap a control that lives inside a clickable row.
 *
 * Rarely needed now — rowOpenProps ignores a click that started on anything
 * clickable, which is every ordinary case. This is for the ones that are not
 * clickable by the DOM's reckoning: a div you have wired up by hand, or a
 * control whose click is dispatched from somewhere the row cannot see.
 *
 * Stops both the click and the key, since the row answers to both: without the
 * keydown guard, Space on a focused delete button inside a focused row still
 * reached the row on some paths.
 */
export function stopRowOpen<E extends HTMLElement>() {
  return {
    onClick: (event: MouseEvent<E>) => event.stopPropagation(),
    onKeyDown: (event: KeyboardEvent<E>) => event.stopPropagation(),
  };
}

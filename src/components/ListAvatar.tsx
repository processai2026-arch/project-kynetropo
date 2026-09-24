import { initialsOf } from "@/lib/initials";
/**
 * The tinted disc at the head of a row.
 *
 * ## Where this belongs, and where it does not
 *
 * Only on a record that has a *name* — an operator, a customer, a member of
 * staff, a supplier. The disc carries initials, and initials of a name are
 * something a reader recognises before they have finished reading the row.
 *
 * A machine, a ticket, a purchase order and a recharge have codes, not names.
 * "SO" for a sales order tells nobody anything, and a column of identical
 * meaningless discs is worse than no column at all: it adds 2.35rem of width
 * and a colour that means nothing to every row on the page. So this is used
 * where it reads and left off everywhere else, rather than applied uniformly
 * because it is available.
 *
 * ## The colour
 *
 * Taken from the record's id, so the same record is the same colour on every
 * load and the eye can use it to keep its place while scrolling. It is an
 * index, never a status — status is the pill's job, and a colour that meant
 * both would mean neither.
 */
export function ListAvatar({ name, id }: { name: string | null | undefined; id: number }) {
  const initials = initialsOf(name);

  return (
    <span data-list-avatar={String(Math.abs(id) % 6)} aria-hidden="true">
      {/* A record with no name still gets a disc, so the column does not go
          ragged; it just has nothing to put in it. */}
      {initials}
    </span>
  );
}

export default ListAvatar;

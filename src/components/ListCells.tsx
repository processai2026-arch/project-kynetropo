import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ListAvatar } from "@/components/ListAvatar";

/**
 * List cells in the record-list skin (mpTV-erp Operators register): a name
 * with its code underneath beside a tinted disc, and a quiet icon-led fact.
 * Styled by `record-list.css`, so they belong inside `RecordListPage`.
 */
export function NameCell({
  id,
  name,
  sub,
  avatar,
}: {
  id: number;
  name: ReactNode;
  sub?: ReactNode;
  /** Replaces the initials disc, e.g. a customer's photo. */
  avatar?: ReactNode;
}) {
  return (
    <div data-list-cell="">
      {avatar ?? <ListAvatar name={typeof name === "string" ? name : ""} id={id} />}
      <p>
        <strong>{name}</strong>
        {sub !== undefined && sub !== null && sub !== "" && <small>{sub}</small>}
      </p>
    </div>
  );
}

export function IconCell({ icon: Icon, primary, secondary }: { icon: LucideIcon; primary: ReactNode; secondary?: ReactNode }) {
  return (
    <div data-list-cell="quiet">
      <Icon aria-hidden />
      <p>
        <strong>{primary}</strong>
        {secondary !== undefined && secondary !== null && secondary !== "" && <small>{secondary}</small>}
      </p>
    </div>
  );
}

/* eslint-disable react-refresh/only-export-components */
import { Link } from "react-router-dom";
import { CalendarCheck, CalendarDays, ClipboardList, Clock, Flame, Phone, Trophy } from "lucide-react";
import { ViewAsSwitcher } from "@/components/sales/ViewAsSwitcher";
import { Avatar, Count, Empty, HeroAvatar, HeroBar, List, Pill, Row, greeting, shortDate, type Tone } from "@/components/phone/PhoneKit";
import { humanise } from "@/components/sales/SalesBits";
import type { LeadTemperature, SalesDashboard, SalesFollowup } from "@/types/sales";
import { cn } from "@/lib/utils";

const TEMP_TONE: Record<LeadTemperature, Tone> = { hot: "danger", warm: "warning", cold: "sky" };

/** A temperature as the phone app shows it: a small coloured pill. */
export function TempPill({ value }: { value: LeadTemperature | null | undefined }) {
  if (!value) return null;
  return <Pill tone={TEMP_TONE[value]}>{humanise(value)}</Pill>;
}

/** When a follow-up is due: the day, and its time when it has one. */
export const dueAt = (f: Pick<SalesFollowup, "due_date" | "due_time">) =>
  shortDate(f.due_time && f.due_time.slice(0, 5) !== "00:00" ? `${f.due_date} ${f.due_time}` : f.due_date);

/**
 * A follow-up as a chat row: tap it to open the lead; the round phone button beside it logs
 * the call (the one thing done most from Home), kept outside the row's link.
 */
export function FollowupRow({ item, overdue, canCall }: { item: SalesFollowup; overdue?: boolean; canCall: boolean }) {
  const name = item.lead_company || item.subject_name || item.lead_name || "Lead";
  const target = item.lead_id ? `/sales/leads/${item.lead_id}` : item.client_id ? `/clients/${item.client_id}` : "/sales/followups";
  return (
    <div className="flex items-center">
      <div className="min-w-0 flex-1">
        <Row
          to={target}
          avatar={<Avatar name={name} />}
          title={name}
          meta={<span className={cn(overdue && "font-medium text-destructive")}>{dueAt(item)}</span>}
          sub={item.purpose || item.lead_contact_person || item.lead_name || ""}
          end={<TempPill value={item.lead_temperature} />}
        />
      </div>
      {canCall && item.lead_id && (
        <Link to={`/sales/leads/${item.lead_id}?action=call`} aria-label={`Log a call with ${name}`}
          className="mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary active:bg-primary/20">
          <Phone className="h-5 w-5" />
        </Link>
      )}
    </div>
  );
}

/**
 * Sales Home on a phone (Diamond Fencing's phone design): the coloured header with the
 * greeting and the day's three figures, then the work as chat-style lists — overdue first,
 * then today, meetings, tasks, hot leads and challenges.
 */
export function SalesPhoneHome({ data, name, can }: { data: SalesDashboard; name: string; can: (p: string) => boolean }) {
  const s = data.summary;
  const firstName = name.split(" ")[0];
  const callable = can("sales.calls.create");
  const figures = [
    { label: "Due today", value: s.followups_today, to: "/sales/followups" },
    { label: "Overdue", value: s.followups_overdue, to: "/sales/followups?bucket=overdue", alert: s.followups_overdue > 0 },
    { label: "Meetings", value: s.meetings_today, to: "/sales/meetings" },
  ];

  return (
    <>
      <HeroBar eyebrow={`${greeting()}${firstName ? `, ${firstName}` : ""}`} title="Today's Sales" right={<HeroAvatar name={name} to="/sales/more" />}>
        <div className="grid grid-cols-3 gap-2">
          {figures.map((f) => (
            <Link key={f.label} to={f.to} className="rounded-2xl bg-white/15 px-3 py-2.5 active:bg-white/25">
              <p className={cn("text-2xl font-bold tabular-nums leading-none", f.alert && "text-amber-200")}>{f.value}</p>
              <p className="mt-1 text-xs text-white/85">{f.label}</p>
            </Link>
          ))}
        </div>
        <div className="mt-3 [&_button]:border-0 [&_button]:bg-white [&_button]:text-foreground">
          <ViewAsSwitcher />
        </div>
      </HeroBar>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pt-1 eco-noscrollbar">
        {([["hot", s.hot, Flame], ["warm", s.warm, null], ["cold", s.cold, null]] as const).map(([t, n]) => (
          <Link key={t} to={`/sales/leads?temperature=${t}`}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-muted px-4 text-sm font-medium text-muted-foreground active:bg-muted/70">
            <span className={cn("h-2 w-2 rounded-full", t === "hot" ? "bg-destructive" : t === "warm" ? "bg-amber-500" : "bg-sky-500")} />
            {humanise(t)} <span className="opacity-75">{n}</span>
          </Link>
        ))}
      </div>

      {data.followups.overdue.length > 0 && (
        <List title={<span className="text-destructive">Overdue · {s.followups_overdue}</span>}
          right={<Link to="/sales/followups?bucket=overdue" className="text-xs font-semibold text-primary">View all</Link>}>
          {data.followups.overdue.slice(0, 5).map((f) => <FollowupRow key={f.id} item={f} overdue canCall={callable} />)}
        </List>
      )}

      <List title={`Today · ${s.followups_today}`} right={<Link to="/sales/followups" className="text-xs font-semibold text-primary">View all</Link>}>
        {data.followups.today.length === 0
          ? <Empty icon={CalendarCheck} text={`Nothing due today.${s.followups_upcoming > 0 ? ` ${s.followups_upcoming} coming up.` : ""}`} />
          : data.followups.today.map((f) => <FollowupRow key={f.id} item={f} canCall={callable} />)}
      </List>

      {can("sales.meetings.view") && (data.meetings.today.length > 0 || data.meetings.upcoming.length > 0) && (
        <List title="Meetings" right={<Link to="/sales/meetings" className="text-xs font-semibold text-primary">View all</Link>}>
          {[...data.meetings.today, ...data.meetings.upcoming.slice(0, 4)].map((m) => (
            <Row key={m.id} to={`/sales/leads/${m.lead_id}`} avatar={<Avatar icon={CalendarDays} tone="violet" />}
              title={m.title} meta={shortDate(m.meeting_time ? `${m.meeting_date} ${m.meeting_time}` : m.meeting_date)}
              sub={`${m.lead_company || m.lead_name || ""} · ${humanise(m.meeting_type)}`} />
          ))}
        </List>
      )}

      {can("sales.tasks.view") && (data.tasks.mine.length > 0 || data.tasks.given.length > 0) && (
        <List title="Tasks" right={<Link to="/sales/tasks" className="text-xs font-semibold text-primary">View all</Link>}>
          {data.tasks.mine.slice(0, 4).map((t) => (
            <Row key={`m-${t.id}`} to={`/sales/tasks?task=${t.id}`} avatar={<Avatar icon={ClipboardList} tone={t.is_overdue ? "danger" : "primary"} />}
              title={t.title} meta={t.due_date ? shortDate(t.due_date) : undefined} sub={`From ${t.assigned_by_name || "—"}`}
              end={t.is_overdue ? <Pill tone="danger">Overdue</Pill> : t.is_live ? <Pill tone="primary">In progress</Pill> : null} />
          ))}
          {data.tasks.given.slice(0, 3).map((t) => (
            <Row key={`g-${t.id}`} to={`/sales/tasks?task=${t.id}`} avatar={<Avatar icon={Clock} tone="muted" />}
              title={t.title} meta={t.due_date ? shortDate(t.due_date) : undefined} sub={`Waiting on ${t.assigned_to_name}`} />
          ))}
        </List>
      )}

      {data.hot_leads.length > 0 && (
        <List title="Hot leads" right={<Link to="/sales/leads?temperature=hot" className="text-xs font-semibold text-primary">View all</Link>}>
          {data.hot_leads.slice(0, 5).map((l) => (
            <Row key={l.id} to={`/sales/leads/${l.id}`} avatar={<Avatar name={l.company || l.name} />}
              title={l.company || l.name} sub={[l.contact_person || l.name, l.phone].filter(Boolean).join(" · ")}
              end={<TempPill value={l.temperature} />} />
          ))}
        </List>
      )}

      {can("sales.challenges.view") && (
        <List title="Challenges" right={<Link to="/sales/challenges" className="text-xs font-semibold text-primary">View all</Link>}>
          <Row to="/sales/challenges" avatar={<Avatar icon={Trophy} tone="warning" />} title="Available to accept"
            sub={`${s.active_challenges} active`} end={<Count n={data.challenges.counts.available} />} />
          {data.challenges.active.map((c) => (
            <Row key={c.id} to={`/sales/challenges/${c.id}`} avatar={<Avatar icon={Trophy} tone="primary" />} title={c.title}
              meta={shortDate(c.deadline)} sub={c.lead_company || c.lead_name || humanise(c.status)} />
          ))}
        </List>
      )}
    </>
  );
}

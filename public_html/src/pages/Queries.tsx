import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollableX } from "@/components/ui/scrollable-x";
import { queriesApi,type Query,type QueryPriority,type QueryStatus } from "@/lib/api/queries";

const statuses:QueryStatus[]=["New","In Progress","Waiting on Customer","Resolved","Closed"];
const priorities:QueryPriority[]=["low","normal","high","urgent"];
const statusColor:Record<QueryStatus,string>={"New":"bg-blue-500/15 text-blue-600","In Progress":"bg-amber-500/15 text-amber-600","Waiting on Customer":"bg-violet-500/15 text-violet-600","Resolved":"bg-emerald-500/15 text-emerald-600","Closed":"bg-slate-500/15 text-slate-600"};

export default function Queries(){
  const qc=useQueryClient(); const [search,setSearch]=useState(""); const [filter,setFilter]=useState<string>("All"); const [selected,setSelected]=useState<Query|null>(null);
  const [sortKey, setSortKey] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const resetSort = () => { setSortKey("created_at"); setSortDir("desc"); };
  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 ml-1 inline" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary ml-1 inline" /> : <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />;
  };
  const [message,setMessage]=useState(""); const [status,setStatus]=useState<QueryStatus>("In Progress"); const [priority,setPriority]=useState<QueryPriority>("normal"); const [assignee,setAssignee]=useState("unassigned"); const [sla,setSla]=useState("");
  const list=useQuery({queryKey:["queries"],queryFn:queriesApi.list});
  const staff=useQuery({queryKey:["queries","staff"],queryFn:queriesApi.staff});
  const open=async(q:Query)=>{ try{const detail=await queriesApi.show(q.query_id);setSelected(detail);setMessage("");setStatus(detail.status==="New"?"In Progress":detail.status);setPriority(detail.priority);setAssignee(detail.assigned_to?String(detail.assigned_to):"unassigned");setSla(detail.sla_due_at?detail.sla_due_at.slice(0,16):"");}catch{toast.error("Could not load query");} };
  const save=useMutation({mutationFn:()=>queriesApi.update(selected!.query_id,{message:message.trim()||undefined,status,priority,assigned_to:assignee==="unassigned"?null:Number(assignee),sla_due_at:sla||null}),onSuccess:()=>{toast.success("Query updated");setSelected(null);qc.invalidateQueries({queryKey:["queries"]});},onError:()=>toast.error("Could not update query")});
  const rows=[...(list.data??[]).filter(q=>(filter==="All"||q.status===filter)&&`${q.query_number} ${q.name} ${q.email} ${q.message}`.toLowerCase().includes(search.toLowerCase()))].sort((a,b)=>{
    const av=(a as any)[sortKey]??""; const bv=(b as any)[sortKey]??"";
    const numKeys=["total_amount","tax_amount","amount","lifetime_revenue","current_stock","damaged_stock","net_revenue","salary","balance_amount"];
    const cmp=numKeys.includes(sortKey)?Number(av)-Number(bv):String(av).localeCompare(String(bv));
    return sortDir==="asc"?cmp:-cmp;
  });
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Customer Queries</h1><p className="text-sm text-muted-foreground">Threaded support, ownership and SLA tracking</p></div>
    <div className="flex flex-wrap gap-2">{["All",...statuses].map(s=><Button key={s} size="sm" variant={filter===s?"default":"outline"} onClick={()=>setFilter(s)}>{s}</Button>)}</div>
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative max-w-sm"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" placeholder="Search queries" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      {(sortKey !== "created_at" || sortDir !== "desc") && (
        <Button variant="outline" size="sm" onClick={resetSort} className="text-xs">
          <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
        </Button>
      )}
    </div>
    <div className="rounded-xl border bg-card"><ScrollableX><table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b bg-muted/30 text-left text-muted-foreground"><th className="p-3 cursor-pointer hover:text-foreground select-none" onClick={()=>handleSort("query_number")}>Query<SortIcon col="query_number"/></th><th className="p-3 cursor-pointer hover:text-foreground select-none" onClick={()=>handleSort("name")}>Customer<SortIcon col="name"/></th><th className="p-3 cursor-pointer hover:text-foreground select-none" onClick={()=>handleSort("priority")}>Priority<SortIcon col="priority"/></th><th className="p-3 cursor-pointer hover:text-foreground select-none" onClick={()=>handleSort("assigned_to_name")}>Owner<SortIcon col="assigned_to_name"/></th><th className="p-3 cursor-pointer hover:text-foreground select-none" onClick={()=>handleSort("sla_due_at")}>SLA<SortIcon col="sla_due_at"/></th><th className="p-3 cursor-pointer hover:text-foreground select-none" onClick={()=>handleSort("status")}>Status<SortIcon col="status"/></th><th className="p-3"></th></tr></thead><tbody>
      {list.isLoading?<tr><td colSpan={7} className="p-8 text-center">Loading…</td></tr>:rows.map(q=><tr key={q.query_id} className="border-b"><td className="p-3"><div className="font-mono text-xs text-primary">{q.query_number}</div><div className="max-w-xs truncate text-muted-foreground">{q.message}</div></td><td className="p-3"><div>{q.name}</div><div className="text-xs text-muted-foreground">{q.email}</div></td><td className="p-3 capitalize">{q.priority}</td><td className="p-3">{q.assigned_to_name||"Unassigned"}</td><td className="p-3"><span className={q.sla_breached?"text-red-600 font-medium":"text-muted-foreground"}>{q.sla_due_at?new Date(q.sla_due_at).toLocaleString():"—"}</span></td><td className="p-3"><Badge className={statusColor[q.status]}>{q.status}</Badge></td><td className="p-3"><Button size="sm" variant="ghost" onClick={()=>open(q)}><Eye className="mr-1 h-4 w-4"/>View</Button></td></tr>)}
      {!list.isLoading&&rows.length===0&&<tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No queries found</td></tr>}
    </tbody></table></ScrollableX></div>
    <Dialog open={!!selected} onOpenChange={v=>!v&&setSelected(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{selected?.query_number}</DialogTitle><DialogDescription>{selected?.name} · {selected?.email}</DialogDescription></DialogHeader>{selected&&<div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
      <div className="space-y-2">{(selected.messages??[]).map(m=><div key={m.message_id} className={`rounded-lg border p-3 ${m.sender_type==="staff"?"ml-8 bg-primary/5":"mr-8 bg-muted/30"}`}><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{m.sender_name||m.sender_type}</span><span>{new Date(m.created_at).toLocaleString()}</span></div><p className="whitespace-pre-wrap text-sm">{m.message}</p>{m.sender_type==="staff"&&<p className="mt-1 text-[11px] text-muted-foreground">Email: {m.delivery_status}{m.delivery_error?` · ${m.delivery_error}`:""}</p>}</div>)}</div>
      <div className="grid grid-cols-2 gap-3"><Select value={assignee} onValueChange={setAssignee}><SelectTrigger><SelectValue placeholder="Assign staff"/></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{(staff.data??[]).map(u=><SelectItem key={u.user_id} value={String(u.user_id)}>{u.name}</SelectItem>)}</SelectContent></Select><Select value={priority} onValueChange={v=>setPriority(v as QueryPriority)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{priorities.map(p=><SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent></Select><Select value={status} onValueChange={v=>setStatus(v as QueryStatus)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{statuses.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><Input type="datetime-local" value={sla} onChange={e=>setSla(e.target.value)}/></div>
      <Textarea rows={4} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Add a reply (email delivery is logged)…"/>
    </div>}<DialogFooter><Button variant="outline" onClick={()=>setSelected(null)}>Cancel</Button><Button onClick={()=>save.mutate()} disabled={save.isPending}>{save.isPending?"Saving…":"Save update"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

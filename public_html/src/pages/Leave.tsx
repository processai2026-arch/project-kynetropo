import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  UserRoundCheck,
  WalletCards,
  X,
} from "lucide-react";
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { StatCard } from "@/components/StatCard";
import { ScrollableX } from "@/components/ui/scrollable-x";
import {
  leaveApi,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveType,
} from "@/lib/api/leave";

const today = () => format(new Date(), "yyyy-MM-dd");
const currentYear = new Date().getFullYear();
const displayDate = (value: string) => format(parseISO(value), "dd MMM yyyy");
const displayDays = (value: number) => `${Number(value).toFixed(value % 1 ? 1 : 0)} d`;

const statusStyle: Record<LeaveStatus, string> = {
  submitted: "border-amber-300 bg-amber-50 text-amber-700",
  approved: "border-emerald-300 bg-emerald-50 text-emerald-700",
  rejected: "border-red-300 bg-red-50 text-red-700",
};

const emptyRequest = {
  employeeId: "",
  leaveTypeId: "",
  startDate: today(),
  endDate: today(),
  reason: "",
};

const emptyType = {
  name: "",
  annualQuota: "12",
  isPaid: true,
  isActive: true,
};

const emptyAccrual = {
  employeeId: "",
  leaveTypeId: "",
  days: "",
  notes: "",
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

export default function Leave() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("requests");
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
  const [status, setStatus] = useState<LeaveStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState(currentYear);
  const [registerFrom, setRegisterFrom] = useState(`${currentYear}-01-01`);
  const [registerTo, setRegisterTo] = useState(`${currentYear}-12-31`);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState(emptyRequest);
  const [typeOpen, setTypeOpen] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [typeForm, setTypeForm] = useState(emptyType);
  const [accrualOpen, setAccrualOpen] = useState(false);
  const [accrualForm, setAccrualForm] = useState(emptyAccrual);
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [calendarDay, setCalendarDay] = useState<Date>(new Date());

  const employees = useQuery({
    queryKey: ["leave", "employees"],
    queryFn: leaveApi.employees,
  });
  const leaveTypes = useQuery({
    queryKey: ["leave", "types"],
    queryFn: () => leaveApi.types(false),
  });
  const requests = useQuery({
    queryKey: ["leave", "requests"],
    queryFn: () => leaveApi.requests(),
  });
  const balances = useQuery({
    queryKey: ["leave", "balances", year],
    queryFn: () => leaveApi.balances(year),
  });
  const register = useQuery({
    queryKey: ["leave", "register", year, registerFrom, registerTo],
    queryFn: () => leaveApi.register({ year, from: registerFrom, to: registerTo }),
  });

  const monthFrom = format(startOfMonth(calendarMonth), "yyyy-MM-dd");
  const monthTo = format(endOfMonth(calendarMonth), "yyyy-MM-dd");
  const calendar = useQuery({
    queryKey: ["leave", "calendar", monthFrom, monthTo],
    queryFn: () => leaveApi.calendar(monthFrom, monthTo),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["leave"] });
  };

  const submitRequest = useMutation({
    mutationFn: () => {
      if (!requestForm.employeeId) throw new Error("Select an employee");
      if (!requestForm.leaveTypeId) throw new Error("Select a leave type");
      return leaveApi.submitRequest({
        employeeId: requestForm.employeeId,
        leaveTypeId: Number(requestForm.leaveTypeId),
        startDate: requestForm.startDate,
        endDate: requestForm.endDate,
        reason: requestForm.reason.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Leave request submitted");
      setRequestOpen(false);
      setRequestForm(emptyRequest);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const reviewRequest = useMutation({
    mutationFn: ({ request, action, reason }: {
      request: LeaveRequest;
      action: "approve" | "reject";
      reason?: string;
    }) => action === "approve"
      ? leaveApi.approveRequest(request.leave_request_id)
      : leaveApi.rejectRequest(request.leave_request_id, reason || ""),
    onSuccess: (_data, variables) => {
      toast.success(variables.action === "approve" ? "Leave request approved" : "Leave request rejected");
      setRejecting(null);
      setRejectReason("");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const saveType = useMutation({
    mutationFn: () => {
      const quota = Number(typeForm.annualQuota);
      if (!typeForm.name.trim()) throw new Error("Leave type name is required");
      if (!Number.isFinite(quota) || quota < 0) throw new Error("Enter a valid annual quota");
      const payload = {
        name: typeForm.name.trim(),
        annualQuota: quota,
        isPaid: typeForm.isPaid,
        isActive: typeForm.isActive,
      };
      return editingType
        ? leaveApi.updateType(editingType.leave_type_id, payload)
        : leaveApi.createType(payload);
    },
    onSuccess: () => {
      toast.success(editingType ? "Leave type updated" : "Leave type created");
      setTypeOpen(false);
      setEditingType(null);
      setTypeForm(emptyType);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggleType = useMutation({
    mutationFn: (type: LeaveType) =>
      leaveApi.updateType(type.leave_type_id, { isActive: !type.is_active }),
    onSuccess: () => {
      toast.success("Leave type status updated");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const accrue = useMutation({
    mutationFn: () => {
      const days = Number(accrualForm.days);
      if (!accrualForm.employeeId || !accrualForm.leaveTypeId) {
        throw new Error("Select an employee and leave type");
      }
      if (!Number.isFinite(days) || days <= 0) throw new Error("Accrual days must be greater than zero");
      return leaveApi.accrue({
        employeeId: accrualForm.employeeId,
        leaveTypeId: Number(accrualForm.leaveTypeId),
        year,
        days,
        notes: accrualForm.notes.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Leave balance accrued");
      setAccrualOpen(false);
      setAccrualForm(emptyAccrual);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (requests.data ?? []).filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (!term) return true;
      return [
        item.employee_name,
        item.employee_key,
        item.department,
        item.leave_type_name,
        item.reason,
      ].filter(Boolean).join(" ").toLowerCase().includes(term);
    });
    return [...filtered].sort((a, b) => {
      const av = (a as any)[sortKey] ?? "";
      const bv = (b as any)[sortKey] ?? "";
      const numKeys = ["total_amount","tax_amount","amount","lifetime_revenue","current_stock","damaged_stock","net_revenue","salary","balance_amount","requested_days"];
      const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [requests.data, search, status, sortKey, sortDir]);

  const filteredBalances = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = !term
      ? (balances.data ?? [])
      : (balances.data ?? []).filter((item) =>
          [item.employee_name, item.employee_key, item.department, item.leave_type_name]
            .filter(Boolean).join(" ").toLowerCase().includes(term),
        );
    return [...filtered].sort((a, b) => {
      const av = (a as any)[sortKey] ?? "";
      const bv = (b as any)[sortKey] ?? "";
      const numKeys = ["total_amount","tax_amount","amount","lifetime_revenue","current_stock","damaged_stock","net_revenue","salary","balance_amount","opening_balance","accrued_days","used_days","available_days"];
      const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [balances.data, search, sortKey, sortDir]);

  const filteredRegister = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = register.data?.employees ?? [];
    if (!term) return rows;
    return rows.filter((item) =>
      [item.employee_name, item.employee_key, item.department, item.designation]
        .filter(Boolean).join(" ").toLowerCase().includes(term),
    );
  }, [register.data, search]);

  const stats = useMemo(() => {
    const all = requests.data ?? [];
    const now = today();
    const month = now.slice(0, 7);
    return {
      pending: all.filter((item) => item.status === "submitted").length,
      approvedMonth: all.filter((item) =>
        item.status === "approved" && item.start_date.slice(0, 7) === month,
      ).length,
      awayToday: all.filter((item) =>
        item.status === "approved" && item.start_date <= now && item.end_date >= now,
      ).length,
      available: (balances.data ?? []).reduce((sum, item) => sum + item.available_days, 0),
    };
  }, [requests.data, balances.data]);

  const activeTypes = (leaveTypes.data ?? []).filter((item) => item.is_active);
  const calendarEntries = calendar.data ?? [];
  const calendarModifiers = useMemo(() => {
    const expand = (items: LeaveRequest[]) => items.flatMap((item) =>
      eachDayOfInterval({ start: parseISO(item.start_date), end: parseISO(item.end_date) }),
    );
    return {
      approvedLeave: expand(calendarEntries.filter((item) => item.status === "approved")),
      submittedLeave: expand(calendarEntries.filter((item) => item.status === "submitted")),
    };
  }, [calendarEntries]);
  const selectedDayEntries = calendarEntries.filter((item) =>
    isWithinInterval(startOfDay(calendarDay), {
      start: startOfDay(parseISO(item.start_date)),
      end: startOfDay(parseISO(item.end_date)),
    }),
  );

  const openNewType = () => {
    setEditingType(null);
    setTypeForm(emptyType);
    setTypeOpen(true);
  };

  const openEditType = (type: LeaveType) => {
    setEditingType(type);
    setTypeForm({
      name: type.name,
      annualQuota: String(type.annual_quota),
      isPaid: type.is_paid,
      isActive: type.is_active,
    });
    setTypeOpen(true);
  };

  const openAccrual = (balance?: LeaveBalance) => {
    setAccrualForm({
      employeeId: balance?.employee_key ?? "",
      leaveTypeId: balance ? String(balance.leave_type_id) : "",
      days: "",
      notes: "",
    });
    setAccrualOpen(true);
  };

  const busy = requests.isLoading || leaveTypes.isLoading || balances.isLoading || register.isLoading;
  const hasError = requests.error || leaveTypes.error || balances.error || register.error || employees.error;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leave</h1>
          <p className="text-sm text-muted-foreground">Employee leave requests and balances</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            title="Refresh"
            onClick={invalidate}
            disabled={busy}
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setRequestOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Raise Request
          </Button>
        </div>
      </div>

      {hasError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage(hasError)}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Pending Approval" value={String(stats.pending)} subtitle="submitted requests" icon={Clock3} />
        <StatCard title="Approved This Month" value={String(stats.approvedMonth)} subtitle="starting this month" icon={UserRoundCheck} />
        <StatCard title="Away Today" value={String(stats.awayToday)} subtitle="approved leave" icon={CalendarDays} />
        <StatCard title="Available Balance" value={displayDays(stats.available)} subtitle={`${year} across employees`} icon={WalletCards} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="balances">Balances</TabsTrigger>
            <TabsTrigger value="register">Leave Register</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="types">Leave Types</TabsTrigger>
          </TabsList>
          {(tab === "requests" || tab === "balances" || tab === "register") && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search employee or leave type"
                className="pl-9"
              />
            </div>
          )}
        </div>

        <TabsContent value="requests" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(value) => setStatus(value as LeaveStatus | "all")}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            {(sortKey !== "created_at" || sortDir !== "desc") && (
              <Button variant="outline" size="sm" onClick={resetSort} className="text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
              </Button>
            )}
            <span className="text-sm text-muted-foreground">{filteredRequests.length} request(s)</span>
          </div>
          <ScrollableX>
            <div className="min-w-[940px] overflow-hidden rounded-md border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("employee_name")}>Employee<SortIcon col="employee_name" /></th>
                    <th className="px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("leave_type_name")}>Leave Type<SortIcon col="leave_type_name" /></th>
                    <th className="px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("start_date")}>Dates<SortIcon col="start_date" /></th>
                    <th className="px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("requested_days")}>Days<SortIcon col="requested_days" /></th>
                    <th className="px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("reason")}>Reason<SortIcon col="reason" /></th>
                    <th className="px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("status")}>Status<SortIcon col="status" /></th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRequests.map((item) => (
                    <tr key={item.leave_request_id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.employee_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.employee_key}{item.department ? ` · ${item.department}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{item.leave_type_name}</div>
                        <div className="text-xs text-muted-foreground">{item.is_paid ? "Paid" : "Unpaid"}</div>
                      </td>
                      <td className="px-4 py-3">
                        {displayDate(item.start_date)}
                        {item.start_date !== item.end_date && ` - ${displayDate(item.end_date)}`}
                      </td>
                      <td className="px-4 py-3 font-medium">{displayDays(item.requested_days)}</td>
                      <td className="max-w-[240px] truncate px-4 py-3 text-muted-foreground" title={item.reason ?? ""}>
                        {item.reason || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={statusStyle[item.status]}>
                          {item.status}
                        </Badge>
                        {item.status === "rejected" && item.rejection_reason && (
                          <div className="mt-1 max-w-[180px] truncate text-xs text-red-600" title={item.rejection_reason}>
                            {item.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.status === "submitted" ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Approve"
                              disabled={reviewRequest.isPending}
                              onClick={() => reviewRequest.mutate({ request: item, action: "approve" })}
                            >
                              <Check className="h-4 w-4 text-emerald-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Reject"
                              disabled={reviewRequest.isPending}
                              onClick={() => setRejecting(item)}
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        ) : <div className="text-right text-muted-foreground">—</div>}
                      </td>
                    </tr>
                  ))}
                  {!filteredRequests.length && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        No leave requests found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ScrollableX>
        </TabsContent>

        <TabsContent value="balances" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map((item) => (
                  <SelectItem key={item} value={String(item)}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(sortKey !== "created_at" || sortDir !== "desc") && (
              <Button variant="outline" size="sm" onClick={resetSort} className="text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
              </Button>
            )}
            <Button variant="outline" onClick={() => openAccrual()} className="gap-2">
              <CircleDollarSign className="h-4 w-4" />
              Accrue Balance
            </Button>
          </div>
          <ScrollableX>
            <div className="min-w-[900px] overflow-hidden rounded-md border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("employee_name")}>Employee<SortIcon col="employee_name" /></th>
                    <th className="px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("leave_type_name")}>Leave Type<SortIcon col="leave_type_name" /></th>
                    <th className="px-4 py-3 text-right font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("opening_balance")}>Annual<SortIcon col="opening_balance" /></th>
                    <th className="px-4 py-3 text-right font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("accrued_days")}>Accrued<SortIcon col="accrued_days" /></th>
                    <th className="px-4 py-3 text-right font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("used_days")}>Used<SortIcon col="used_days" /></th>
                    <th className="px-4 py-3 text-right font-medium cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("available_days")}>Available<SortIcon col="available_days" /></th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredBalances.map((item) => (
                    <tr key={`${item.employee_key}-${item.leave_type_id}`} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.employee_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.employee_key}{item.department ? ` · ${item.department}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {item.leave_type_name}
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          {item.is_paid ? "Paid" : "Unpaid"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">{displayDays(item.opening_balance)}</td>
                      <td className="px-4 py-3 text-right text-blue-600">+{displayDays(item.accrued_days)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{displayDays(item.used_days)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                        {displayDays(item.available_days)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => openAccrual(item)}>Accrue</Button>
                      </td>
                    </tr>
                  ))}
                  {!filteredBalances.length && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        No leave balances found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ScrollableX>
        </TabsContent>

        <TabsContent value="register" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-4">
            <div className="space-y-1"><Label>Year</Label><Select value={String(year)} onValueChange={(value) => {
              const next = Number(value); setYear(next); setRegisterFrom(`${next}-01-01`); setRegisterTo(`${next}-12-31`);
            }}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>{[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((item) => <SelectItem key={item} value={String(item)}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>From</Label><Input type="date" value={registerFrom} min={`${year}-01-01`} max={`${year}-12-31`} onChange={(e) => setRegisterFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label>To</Label><Input type="date" value={registerTo} min={`${year}-01-01`} max={`${year}-12-31`} onChange={(e) => setRegisterTo(e.target.value)} /></div>
            <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground"><FileSpreadsheet className="h-4 w-4 text-primary" />{filteredRegister.length} employee(s)</div>
          </div>

          {register.isLoading ? <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading leave register…</div> : filteredRegister.length === 0 ? <div className="rounded-md border bg-card py-12 text-center text-muted-foreground">No leave register entries for this period</div> : filteredRegister.map((employee) => {
            const totals = employee.types.reduce((sum, type) => ({
              opening: sum.opening + type.opening, accrued: sum.accrued + type.accrued,
              taken: sum.taken + type.taken, pending: sum.pending + type.pending, closing: sum.closing + type.closing,
            }), { opening: 0, accrued: 0, taken: 0, pending: 0, closing: 0 });
            const unpaid = employee.types.filter((type) => !type.is_paid).reduce((sum, type) => sum + type.taken, 0);
            return <div key={employee.employee_key} className="overflow-hidden rounded-md border bg-card shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                <div><div className="font-semibold">{employee.employee_name}</div><div className="text-xs text-muted-foreground">{employee.employee_key}{employee.department ? ` · ${employee.department}` : ""}{employee.designation ? ` · ${employee.designation}` : ""}</div></div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className={employee.attendance_conflicts ? "border-amber-300 bg-amber-50 text-amber-700" : "border-emerald-300 bg-emerald-50 text-emerald-700"}>Attendance leave: {displayDays(employee.attendance_leave_days)}{employee.attendance_conflicts ? ` · ${employee.attendance_conflicts} conflict(s)` : ""}</Badge>
                  <Badge variant="outline" className={unpaid ? "border-red-300 bg-red-50 text-red-700" : ""}>LOP/unpaid: {displayDays(unpaid)}</Badge>
                  <Badge variant="outline">Payroll leave: {displayDays(employee.payroll_leave_days)}{employee.payroll_months.length ? ` (${employee.payroll_months.join(", ")})` : " · no payroll run"}</Badge>
                </div>
              </div>
              <ScrollableX><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/20 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-2">Leave type</th><th className="px-4 py-2 text-right">Opening</th><th className="px-4 py-2 text-right">Accrued</th><th className="px-4 py-2 text-right">Taken</th><th className="px-4 py-2 text-right">Pending</th><th className="px-4 py-2 text-right">Closing</th></tr></thead><tbody className="divide-y">{employee.types.map((type) => <tr key={type.leave_type_id}><td className="px-4 py-2">{type.leave_type_name}<Badge variant="outline" className="ml-2 text-[10px]">{type.is_paid ? "Paid" : "Unpaid / LOP"}</Badge>{type.adjusted !== 0 && <span className="ml-2 text-xs text-muted-foreground">adjusted {displayDays(type.adjusted)}</span>}</td><td className="px-4 py-2 text-right">{displayDays(type.opening)}</td><td className="px-4 py-2 text-right text-blue-600">{displayDays(type.accrued)}</td><td className="px-4 py-2 text-right text-red-600">{displayDays(type.taken)}</td><td className="px-4 py-2 text-right text-amber-600">{displayDays(type.pending)}</td><td className="px-4 py-2 text-right font-semibold text-emerald-700">{displayDays(type.closing)}</td></tr>)}<tr className="bg-muted/30 font-semibold"><td className="px-4 py-2">Totals</td><td className="px-4 py-2 text-right">{displayDays(totals.opening)}</td><td className="px-4 py-2 text-right">{displayDays(totals.accrued)}</td><td className="px-4 py-2 text-right">{displayDays(totals.taken)}</td><td className="px-4 py-2 text-right">{displayDays(totals.pending)}</td><td className="px-4 py-2 text-right">{displayDays(totals.closing)}</td></tr></tbody></table></ScrollableX>
              <details className="border-t"><summary className="cursor-pointer px-4 py-3 text-sm font-medium text-primary">Leave request drill ({employee.requests.length})</summary><div className="border-t"><ScrollableX><table className="w-full min-w-[700px] text-sm"><thead className="bg-muted/20 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2">Dates</th><th className="px-4 py-2">Type</th><th className="px-4 py-2 text-right">Days</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Reason</th></tr></thead><tbody className="divide-y">{employee.requests.map((request) => <tr key={request.leave_request_id}><td className="px-4 py-2">{displayDate(request.start_date)}{request.end_date !== request.start_date ? ` – ${displayDate(request.end_date)}` : ""}</td><td className="px-4 py-2">{request.leave_type_name}</td><td className="px-4 py-2 text-right">{displayDays(request.requested_days)}</td><td className="px-4 py-2"><Badge variant="outline" className={statusStyle[request.status]}>{request.status}</Badge></td><td className="px-4 py-2 text-muted-foreground">{request.reason || "—"}</td></tr>)}{employee.requests.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No requests in this period</td></tr>}</tbody></table></ScrollableX></div></details>
            </div>;
          })}
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <div className="rounded-md border bg-card">
              <Calendar
                mode="single"
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                selected={calendarDay}
                onSelect={(date) => date && setCalendarDay(date)}
                modifiers={calendarModifiers}
                modifiersClassNames={{
                  approvedLeave: "bg-emerald-100 text-emerald-800 font-medium",
                  submittedLeave: "ring-1 ring-amber-400",
                }}
                className="mx-auto"
              />
              <div className="flex items-center justify-center gap-5 border-t px-4 py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-200" /> Approved
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm border border-amber-500" /> Submitted
                </span>
              </div>
            </div>
            <div className="rounded-md border bg-card">
              <div className="border-b px-4 py-3">
                <h2 className="font-semibold">{format(calendarDay, "EEEE, dd MMMM yyyy")}</h2>
                <p className="text-xs text-muted-foreground">{selectedDayEntries.length} leave entry(s)</p>
              </div>
              <div className="divide-y">
                {selectedDayEntries.map((item) => (
                  <div key={item.leave_request_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                    <div>
                      <div className="font-medium">{item.employee_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.leave_type_name} · {displayDate(item.start_date)} - {displayDate(item.end_date)}
                      </div>
                    </div>
                    <Badge variant="outline" className={statusStyle[item.status]}>{item.status}</Badge>
                  </div>
                ))}
                {!selectedDayEntries.length && (
                  <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No leave recorded for this date
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="types" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewType} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Leave Type
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(leaveTypes.data ?? []).map((type) => (
              <div key={type.leave_type_id} className="rounded-md border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{type.name}</h3>
                      {!type.is_active && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {displayDays(type.annual_quota)} annual quota · {type.is_paid ? "Paid" : "Unpaid"}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" title="Edit" onClick={() => openEditType(type)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <Label htmlFor={`type-active-${type.leave_type_id}`} className="text-xs text-muted-foreground">
                    Active
                  </Label>
                  <Switch
                    id={`type-active-${type.leave_type_id}`}
                    checked={type.is_active}
                    disabled={toggleType.isPending}
                    onCheckedChange={() => toggleType.mutate(type)}
                  />
                </div>
              </div>
            ))}
            {leaveTypes.isLoading && (
              <div className="col-span-full flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading leave types
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Raise Leave Request</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select
                value={requestForm.employeeId}
                onValueChange={(value) => setRequestForm((form) => ({ ...form, employeeId: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {(employees.data ?? []).map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} ({employee.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Leave Type</Label>
              <Select
                value={requestForm.leaveTypeId}
                onValueChange={(value) => setRequestForm((form) => ({ ...form, leaveTypeId: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Select leave type" /></SelectTrigger>
                <SelectContent>
                  {activeTypes.map((type) => (
                    <SelectItem key={type.leave_type_id} value={String(type.leave_type_id)}>
                      {type.name} · {displayDays(type.annual_quota)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="leave-start">Start Date</Label>
                <Input
                  id="leave-start"
                  type="date"
                  value={requestForm.startDate}
                  onChange={(event) => setRequestForm((form) => ({ ...form, startDate: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="leave-end">End Date</Label>
                <Input
                  id="leave-end"
                  type="date"
                  min={requestForm.startDate}
                  value={requestForm.endDate}
                  onChange={(event) => setRequestForm((form) => ({ ...form, endDate: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leave-reason">Reason</Label>
              <Textarea
                id="leave-reason"
                rows={3}
                value={requestForm.reason}
                onChange={(event) => setRequestForm((form) => ({ ...form, reason: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>Cancel</Button>
            <Button onClick={() => submitRequest.mutate()} disabled={submitRequest.isPending}>
              {submitRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Leave Type" : "Add Leave Type"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="leave-type-name">Name</Label>
              <Input
                id="leave-type-name"
                value={typeForm.name}
                onChange={(event) => setTypeForm((form) => ({ ...form, name: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leave-type-quota">Annual Quota</Label>
              <Input
                id="leave-type-quota"
                type="number"
                min="0"
                max="365"
                step="0.5"
                value={typeForm.annualQuota}
                onChange={(event) => setTypeForm((form) => ({ ...form, annualQuota: event.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
              <Label htmlFor="leave-type-paid">Paid leave</Label>
              <Switch
                id="leave-type-paid"
                checked={typeForm.isPaid}
                onCheckedChange={(value) => setTypeForm((form) => ({ ...form, isPaid: value }))}
              />
            </div>
            {editingType && (
              <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <Label htmlFor="leave-type-active">Active</Label>
                <Switch
                  id="leave-type-active"
                  checked={typeForm.isActive}
                  onCheckedChange={(value) => setTypeForm((form) => ({ ...form, isActive: value }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeOpen(false)}>Cancel</Button>
            <Button onClick={() => saveType.mutate()} disabled={saveType.isPending}>
              {saveType.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={accrualOpen} onOpenChange={setAccrualOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Accrue Leave Balance</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select
                value={accrualForm.employeeId}
                onValueChange={(value) => setAccrualForm((form) => ({ ...form, employeeId: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {(employees.data ?? []).map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} ({employee.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Leave Type</Label>
              <Select
                value={accrualForm.leaveTypeId}
                onValueChange={(value) => setAccrualForm((form) => ({ ...form, leaveTypeId: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Select leave type" /></SelectTrigger>
                <SelectContent>
                  {activeTypes.map((type) => (
                    <SelectItem key={type.leave_type_id} value={String(type.leave_type_id)}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="accrual-days">Days</Label>
                <Input
                  id="accrual-days"
                  type="number"
                  min="0.5"
                  max="365"
                  step="0.5"
                  value={accrualForm.days}
                  onChange={(event) => setAccrualForm((form) => ({ ...form, days: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Input value={year} disabled />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accrual-notes">Notes</Label>
              <Textarea
                id="accrual-notes"
                rows={3}
                value={accrualForm.notes}
                onChange={(event) => setAccrualForm((form) => ({ ...form, notes: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccrualOpen(false)}>Cancel</Button>
            <Button onClick={() => accrue.mutate()} disabled={accrue.isPending}>
              {accrue.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accrue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reject Leave Request</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              rows={4}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || reviewRequest.isPending}
              onClick={() => rejecting && reviewRequest.mutate({
                request: rejecting,
                action: "reject",
                reason: rejectReason.trim(),
              })}
            >
              {reviewRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

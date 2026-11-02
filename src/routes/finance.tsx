import { lazy } from "react";
import type { RouteDef } from "./types";

const Finance = lazy(() => import("@/pages/finance/Finance"));
const FinanceProject = lazy(() => import("@/pages/finance/FinanceProject"));
const PaymentDetail = lazy(() => import("@/pages/finance/PaymentDetail"));
const ExpenseDetail = lazy(() => import("@/pages/finance/ExpenseDetail"));
const ExpenseForm = lazy(() => import("@/pages/finance/ExpenseForm"));
const Expenses = lazy(() => import("@/pages/finance/Expenses"));
const AmcForm = lazy(() => import("@/pages/finance/AmcForm"));
const AMC = lazy(() => import("@/pages/finance/AMC"));
const AmcDetail = lazy(() => import("@/pages/finance/AmcDetail"));

export const routes: RouteDef[] = [
  { path: "/finance", element: Finance },
  { path: "/finance/projects/:id", element: FinanceProject },
  { path: "/finance/payments/:id", element: PaymentDetail },
  { path: "/finance/expenses", element: Expenses },
  { path: "/finance/expenses/new", element: ExpenseForm },
  { path: "/finance/expenses/:id", element: ExpenseDetail },
  { path: "/finance/expenses/:id/edit", element: ExpenseForm },
  { path: "/amc", element: AMC },
  { path: "/amc/new", element: AmcForm },
  { path: "/amc/:id", element: AmcDetail },
  { path: "/amc/:id/edit", element: AmcForm },
];

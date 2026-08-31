import { useState } from "react";
import { IconBadge } from "@/components/preview-staging/IconBadge";

// Mock values for demo
const onView = () => {};
const onEdit = () => {};
const onDelete = () => {};
const onConfirm = () => {};
const onCancel = () => {};
const onClose = () => {};
const onSuccess = () => {};
const onClick = () => {};
const onToggle = () => {};
const onSelect = () => {};
const onExport = async () => {};
const navigate = () => {};
const open = true;
const isOpen = true;
const loading = false;
const saving = false;
const disabled = false;
const value = "";
const label = "Label";
const title = "Title";
const description = "Description";
const name = "IconBadge";
const count = 42;
const total = 100;
const page = 1;
const totalPages = 5;
const amount = 10000;
const phone = "9876543210";
const email = "user@example.com";
const date = "2025-01-15";
const status = "active";
const fallback = "/";
const backFallback = "/";
const items = [];
const data = [];
const stats = [];
const tabs = [];
const columns = [];
const colSpan = 4;
const cols = 3;
const rows = 3;
const actual = 60;
const target = 100;

export default function IconBadgeDemo() {
  return (
    <div style={{ padding: "16px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-start", background: "white", minHeight: "80px" }}>
      <IconBadge
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onConfirm={onConfirm}
        onCancel={onCancel}
        onClose={onClose}
        onClick={onClick}
        onToggle={onToggle}
        onExport={onExport}
        onSuccess={onSuccess}
      />
    </div>
  );
}

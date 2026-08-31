interface EmptyRowProps {
  colSpan: number;
  message?: string;
  loading?: boolean;
}

export function EmptyRow({ colSpan, message = "No items found", loading = false }: EmptyRowProps) {
  if (loading) return null;
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-8 text-center text-muted-foreground text-sm">
        {message}
      </td>
    </tr>
  );
}

import * as React from "react";
import { Input } from "@/components/ui/input";

export interface ComboInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  options?: string[];
}

export function ComboInput({ options: _options, ...props }: ComboInputProps) {
  return <Input {...props} />;
}

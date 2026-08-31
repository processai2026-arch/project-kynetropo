import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// Full GSTIN state-code prefix map (as of GST rollout)
const GST_STATE_MAP: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman & Diu",
  "26": "Dadra & Nagar Haveli",
  "27": "Maharashtra",
  "28": "Andhra Pradesh",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

/**
 * Derives the Indian state name from the two-digit GSTIN prefix.
 * Returns an empty string when the prefix is unrecognised or the
 * string is too short.
 */
export function stateFromGstin(gstin: string): string {
  return gstin.length >= 2 ? (GST_STATE_MAP[gstin.slice(0, 2)] ?? "") : "";
}

export interface GstinInputWithFetchProps {
  /** Current GSTIN value (controlled). */
  value: string;
  /**
   * Called with the new GSTIN string on every keystroke (already
   * upper-cased) AND the state derived from the GSTIN prefix
   * (empty string when the prefix is not yet recognisable).
   */
  onChange: (gstin: string, derivedState: string) => void;
  /** Called when the user clicks "Fetch". */
  onFetch: () => void;
  /** When true the button is disabled and shows a spinner. */
  isFetching: boolean;
  /** Optional id forwarded to the underlying <input>. */
  id?: string;
  /** Optional placeholder override. */
  placeholder?: string;
  /** Whether the input itself should be disabled. */
  disabled?: boolean;
}

export function GstinInputWithFetch({
  value,
  onChange,
  onFetch,
  isFetching,
  id = "gstin",
  placeholder = "e.g. 33AABCI1234A1Z5",
  disabled = false,
}: GstinInputWithFetchProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const upper = e.target.value.toUpperCase();
    onChange(upper, stateFromGstin(upper));
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>GSTIN</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className="font-mono flex-1"
          autoComplete="off"
          spellCheck={false}
          maxLength={15}
          disabled={disabled || isFetching}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onFetch}
          disabled={isFetching || disabled}
          className="shrink-0 min-w-[60px]"
          aria-label={isFetching ? "Fetching GST details…" : "Fetch GST details"}
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Fetch"
          )}
        </Button>
      </div>
    </div>
  );
}

export default GstinInputWithFetch;

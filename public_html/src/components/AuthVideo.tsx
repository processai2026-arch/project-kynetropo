/** Stub component — renders a video that is fetched with an auth token. */
import React, { useEffect, useState } from "react";
import { getAuthToken, BASE_URL } from "@/lib/api/client";

interface AuthVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  attachmentId: string | number;
  mimeType?: string;
  fileName?: string;
}

export function AuthVideo({ attachmentId, mimeType, fileName: _fileName, ...rest }: AuthVideoProps) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    if (!attachmentId) return;
    const token = getAuthToken();
    const url = `${BASE_URL}/admin/attachments/${attachmentId}/file`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.blob();
      })
      .then((blob) => setSrc(URL.createObjectURL(blob)))
      .catch(() => setSrc(""));

    return () => {
      if (src) URL.revokeObjectURL(src);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentId]);

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-muted text-xs text-muted-foreground ${rest.className ?? ""}`}>
        Loading video…
      </div>
    );
  }

  return (
    <video src={src} controls {...rest}>
      {mimeType && <source src={src} type={mimeType} />}
    </video>
  );
}

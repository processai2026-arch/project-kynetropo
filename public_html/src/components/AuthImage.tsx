/** Stub component — renders an image that is fetched with an auth token. */
import React, { useEffect, useState } from "react";
import { getAuthToken, BASE_URL } from "@/lib/api/client";

interface AuthImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  attachmentId: string | number;
}

export function AuthImage({ attachmentId, alt, ...rest }: AuthImageProps) {
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
      <div
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
        className={`flex items-center justify-center bg-muted text-xs text-muted-foreground ${rest.className ?? ""}`}
      >
        Loading…
      </div>
    );
  }

  return <img src={src} alt={alt ?? ""} {...rest} />;
}

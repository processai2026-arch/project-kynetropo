/** Stub component — renders a QR code image. */
import React, { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QrImageProps {
  value: string;
  size?: number;
  className?: string;
}

export function QrImage({ value, size = 200, className }: QrImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, { width: size, margin: 1 }).catch(console.error);
  }, [value, size]);

  return <canvas ref={canvasRef} width={size} height={size} className={className} />;
}

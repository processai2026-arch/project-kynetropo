<?php
declare(strict_types=1);

/**
 * Admin PDF Splitter Controller
 * POST /admin/pdf-splitter/preview — render page 1 as JPEG via Imagick, return base64 + page count
 */
class AdminPdfSplitterController
{
    private const MAX_BYTES    = 30 * 1024 * 1024;
    private const PREVIEW_DPI  = 72;
    private const PREVIEW_MAX_W = 700;

    public function preview(Request $request): void
    {
        if (empty($_FILES['file'])) Response::error('file is required', 422);
        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK)  Response::error('Upload error: ' . $file['error'], 422);
        if ($file['size'] > self::MAX_BYTES)    Response::error('File too large (max 30 MB)', 422);
        $mime = mime_content_type($file['tmp_name']) ?: '';
        if ($mime !== 'application/pdf')        Response::error('Only PDF files accepted', 422);

        @ini_set('memory_limit', '256M');
        set_time_limit(60);

        $tmp = sys_get_temp_dir() . '/splitter_' . uniqid() . '.pdf';
        if (!move_uploaded_file($file['tmp_name'], $tmp)) Response::error('Failed to store file', 500);

        $pageCount = $this->countPdfPages($tmp);

        try {
            if (!extension_loaded('imagick')) {
                @unlink($tmp);
                Response::error('Imagick not available on this server', 422);
            }

            $result = $this->renderPage($tmp, $pageCount);
            @unlink($tmp);

            if (!$result) {
                Response::error('Could not render PDF preview — file may be encrypted or unsupported', 422);
            }

            Response::success($result);
        } catch (\Throwable $e) {
            @unlink($tmp);
            error_log('[PdfSplitter] ' . $e->getMessage());
            Response::error('Preview failed: ' . $e->getMessage(), 500);
        }
    }

    // Count pages via pure-PHP regex on first 64KB — no Imagick, no shell
    private function countPdfPages(string $path): int
    {
        $chunk = @file_get_contents($path, false, null, 0, 65536);
        if (!$chunk) return 1;
        if (preg_match_all('/\/Count\s+(\d+)/', $chunk, $m)) {
            return max(1, (int)max($m[1]));
        }
        return 1;
    }

    private function renderPage(string $pdfPath, int $pageCount): ?array
    {
        try {
            $im = new \Imagick();
            $im->setResolution(self::PREVIEW_DPI, self::PREVIEW_DPI);
            $im->setBackgroundColor('white');
            $im->readImage($pdfPath . '[0]');
            $im->setImageBackgroundColor(new \ImagickPixel('white'));
            $im->setImageAlphaChannel(\Imagick::ALPHACHANNEL_REMOVE);
            $flattened = $im->flattenImages();
            $im->destroy();

            $flattened->setImageColorspace(\Imagick::COLORSPACE_SRGB);
            $flattened->setImageFormat('jpeg');
            $flattened->setImageCompressionQuality(75);

            // Save ORIGINAL pixel size BEFORE any resize — at 72 DPI, 1px = 1pt
            // so these give us the real PDF dimensions in points
            $origW = $flattened->getImageWidth();
            $origH = $flattened->getImageHeight();

            // Resize only the preview image for display; pdf dimensions stay as origW/origH
            $dispW = $origW;
            $dispH = $origH;
            if ($origW > self::PREVIEW_MAX_W) {
                $flattened->resizeImage(self::PREVIEW_MAX_W, 0, \Imagick::FILTER_LANCZOS, 1);
                $dispW = $flattened->getImageWidth();
                $dispH = $flattened->getImageHeight();
            }

            $jpeg = $flattened->getImageBlob();
            $flattened->destroy();

            if (!$jpeg || strlen($jpeg) < 500) return null;

            return [
                'preview_url' => 'data:image/jpeg;base64,' . base64_encode($jpeg),
                'page_count'  => $pageCount,
                // Real PDF dimensions in points (72 DPI → 1px=1pt)
                'pdf_width'   => (float)$origW,
                'pdf_height'  => (float)$origH,
                // Preview image pixel size (may be smaller after resize)
                'img_width'   => $dispW,
                'img_height'  => $dispH,
            ];
        } catch (\Throwable $e) {
            error_log('[PdfSplitter] Imagick render failed: ' . $e->getMessage());
            return null;
        }
    }
}

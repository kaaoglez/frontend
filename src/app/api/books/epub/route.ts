import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

// Normalize path by resolving .. and . segments
function normalizeZipPath(p: string): string {
  const parts = p.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '..') {
      resolved.pop();
    } else if (part !== '.' && part !== '') {
      resolved.push(part);
    }
  }
  return resolved.join('/');
}

// Get directory of a file path in the zip
function getZipDir(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx >= 0 ? filePath.substring(0, idx + 1) : '';
}

// Resolve a relative path from a base file
function resolveRelativePath(baseFile: string, relativePath: string): string {
  const baseDir = getZipDir(baseFile);
  const decoded = decodeURIComponent(relativePath);
  return normalizeZipPath(baseDir + decoded);
}

// Parse the OPF file to extract spine order and manifest
function parseOpf(opfContent: string): { manifest: Record<string, { href: string; mediaType: string }>; spine: string[]; title: string } {
  const manifest: Record<string, { href: string; mediaType: string }> = {};
  const spine: string[] = [];
  let title = 'Sin título';

  const titleMatch = opfContent.match(/<dc:title[^>]*>(.*?)<\/dc:title>/i);
  if (titleMatch) title = titleMatch[1].replace(/<[^>]+>/g, '').trim();

  const manifestRegex = /<item\s+[^>]*>/gi;
  const manifestMatches = opfContent.match(manifestRegex) || [];
  for (const match of manifestMatches) {
    const idMatch = match.match(/id=["']([^"']+)["']/i);
    const hrefMatch = match.match(/href=["']([^"']+)["']/i);
    const mediaTypeMatch = match.match(/media-type=["']([^"']+)["']/i);
    if (idMatch && hrefMatch) {
      manifest[idMatch[1]] = {
        href: decodeURIComponent(hrefMatch[1]),
        mediaType: mediaTypeMatch ? mediaTypeMatch[1] : '',
      };
    }
  }

  const spineRegex = /<itemref\s+[^>]*>/gi;
  const spineMatches = opfContent.match(spineRegex) || [];
  for (const match of spineMatches) {
    const idrefMatch = match.match(/idref=["']([^"']+)["']/i);
    if (idrefMatch) spine.push(idrefMatch[1]);
  }

  return { manifest, spine, title };
}

const IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
  bmp: 'image/bmp', ico: 'image/x-icon', tiff: 'image/tiff', tif: 'image/tiff',
};

function getMimeFromExt(ext: string): string {
  return IMAGE_MIME[ext.toLowerCase()] || 'application/octet-stream';
}

function isImageFile(href: string): boolean {
  const ext = href.split('.').pop()?.toLowerCase() || '';
  return ext in IMAGE_MIME;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get('path');
  const chapter = searchParams.get('chapter');
  const debug = searchParams.get('debug') === 'true';

  if (!filePath) {
    return NextResponse.json({ error: 'Path parameter required' }, { status: 400 });
  }

  try {
    const normalized = path.normalize(filePath);
    if (normalized.includes('..')) {
      return NextResponse.json({ error: 'Path traversal not allowed' }, { status: 400 });
    }

    if (!fs.existsSync(normalized)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stat = fs.statSync(normalized);
    if (!stat.isFile()) {
      return NextResponse.json({ error: 'Not a file' }, { status: 400 });
    }

    const ext = path.extname(normalized).toLowerCase();
    if (ext !== '.epub') {
      return NextResponse.json({ error: 'Not an EPUB file' }, { status: 400 });
    }

    const epubBuffer = await fs.promises.readFile(normalized);
    const zip = await JSZip.loadAsync(epubBuffer);

    // Build a map of ALL files in the zip (both original and normalized)
    const zipFiles = new Map<string, JSZip.JSZipObject>();
    const allZipPaths: string[] = [];
    zip.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir) {
        zipFiles.set(relativePath, zipEntry);
        allZipPaths.push(relativePath);
        const norm = normalizeZipPath(relativePath);
        if (norm !== relativePath) {
          zipFiles.set(norm, zipEntry);
        }
      }
    });

    // Also index images by just their filename (last segment) for fuzzy matching
    const zipFilesByName = new Map<string, string>();
    for (const p of allZipPaths) {
      const name = p.split('/').pop() || '';
      if (isImageFile(name)) {
        zipFilesByName.set(name.toLowerCase(), p);
      }
    }

    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    if (!containerXml) {
      return NextResponse.json({ error: 'Invalid EPUB: no container.xml' }, { status: 400 });
    }

    const opfPathMatch = containerXml.match(/full-path=["']([^"']+)["']/i);
    if (!opfPathMatch) {
      return NextResponse.json({ error: 'Invalid EPUB: no OPF path' }, { status: 400 });
    }

    const opfPath = opfPathMatch[1];
    const opfDir = getZipDir(opfPath);

    const opfContent = await zip.file(opfPath)?.async('string');
    if (!opfContent) {
      return NextResponse.json({ error: 'Invalid EPUB: cannot read OPF' }, { status: 400 });
    }

    const { manifest, spine, title } = parseOpf(opfContent);

    // Get all HTML/XHTML files in spine order
    const chapters: Array<{ id: string; href: string; title: string }> = [];

    for (const spineId of spine) {
      const item = manifest[spineId];
      if (!item) continue;
      const { href, mediaType } = item;
      if (!href) continue;
      const isHtml = mediaType.includes('html') || href.endsWith('.html') || href.endsWith('.xhtml') || href.endsWith('.htm');

      if (isHtml) {
        const fullHref = normalizeZipPath(opfDir + href);
        let chapterTitle = '';
        const zipEntry = zipFiles.get(fullHref);
        if (zipEntry) {
          const htmlContent = await zipEntry.async('string');
          const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/i) ||
                             htmlContent.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
          if (titleMatch) {
            chapterTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
          }
        }
        chapters.push({ id: spineId, href: fullHref, title: chapterTitle || `Capítulo ${chapters.length + 1}` });
      }
    }

    // If a specific chapter is requested, return its HTML content
    if (chapter !== null) {
      const chapterIdx = parseInt(chapter, 10);
      const chapterData = chapters[chapterIdx];
      if (!chapterData) {
        return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
      }

      const htmlEntry = zipFiles.get(chapterData.href);
      if (!htmlEntry) {
        return NextResponse.json({ error: 'Chapter file not found in EPUB' }, { status: 404 });
      }

      let htmlContent = await htmlEntry.async('string');
      const debugLog: string[] = [];
      if (debug) {
        debugLog.push(`Chapter file: ${chapterData.href}`);
        debugLog.push(`All zip files (${allZipPaths.length}): ${JSON.stringify(allZipPaths.filter(p => isImageFile(p)).slice(0, 20))}`);
      }

      // ─── Embed all resource references as base64 ────────────
      const imageMap: Record<string, string> = {};

      // Helper: try to find and embed a resource
      async function tryEmbed(rawSrc: string, context: string): Promise<boolean> {
        if (!rawSrc || rawSrc.startsWith('data:') || rawSrc.startsWith('#') || rawSrc.startsWith('http')) return false;

        // Method 1: Resolve relative path
        const resolvedPath = resolveRelativePath(chapterData.href, rawSrc);
        let zipEntry = zipFiles.get(resolvedPath);

        // Method 2: Try as-is (absolute within zip)
        if (!zipEntry) zipEntry = zipFiles.get(rawSrc);

        // Method 3: Try with opfDir prefix
        if (!zipEntry) zipEntry = zipFiles.get(normalizeZipPath(opfDir + rawSrc));

        // Method 4: Try by filename only (fuzzy match)
        if (!zipEntry) {
          const justName = decodeURIComponent(rawSrc.split('/').pop()?.toLowerCase() || '');
          const fullPath = zipFilesByName.get(justName);
          if (fullPath) zipEntry = zipFiles.get(fullPath);
        }

        if (!zipEntry) {
          if (debug) debugLog.push(`[MISS] ${context}: "${rawSrc}" -> resolved "${resolvedPath}"`);
          return false;
        }

        // Determine if it's an image
        const actualPath = zipEntry.name;
        const imgExt = actualPath.split('.').pop()?.toLowerCase() || '';
        const isImg = imgExt in IMAGE_MIME;

        if (isImg) {
          const imgData = await zipEntry.async('base64');
          const mime = getMimeFromExt(imgExt);
          imageMap[rawSrc] = `data:${mime};base64,${imgData}`;
          if (debug) debugLog.push(`[OK] ${context}: "${rawSrc}" -> "${actualPath}" (${mime})`);
          return true;
        } else if (debug) {
          debugLog.push(`[SKIP] ${context}: "${rawSrc}" -> "${actualPath}" (not image)`);
        }
        return false;
      }

      // 1. Find all src= attributes (img, script, iframe, etc.)
      const srcRegex = /src=["']([^"']+)["']/gi;
      let m: RegExpExecArray | null;
      while ((m = srcRegex.exec(htmlContent)) !== null) {
        await tryEmbed(m[1], 'src');
      }

      // 2. Find xlink:href (SVG images, common in EPUB)
      const xlinkRegex = /xlink:href=["']([^"']+)["']/gi;
      while ((m = xlinkRegex.exec(htmlContent)) !== null) {
        await tryEmbed(m[1], 'xlink:href');
      }

      // 3. Find href= on <image> tags (SVG inline)
      const imageHrefRegex = /<(?:image|img)[^>]+href=["']([^"']+)["']/gi;
      while ((m = imageHrefRegex.exec(htmlContent)) !== null) {
        await tryEmbed(m[1], 'image-href');
      }

      // 4. Find all url() in inline CSS
      const urlRegex = /url\(["']?([^"')]+)["']?\)/gi;
      while ((m = urlRegex.exec(htmlContent)) !== null) {
        await tryEmbed(m[1], 'css-url');
      }

      // 5. Gather linked CSS files and process their url() references
      const cssStyles: string[] = [];
      const linkHrefRegex = /<link[^>]+href=["']([^"']*\.css[^"']*)["']/gi;
      while ((m = linkHrefRegex.exec(htmlContent)) !== null) {
        const cssRawHref = m[1];
        const cssResolvedPath = resolveRelativePath(chapterData.href, cssRawHref);
        const cssEntry = zipFiles.get(cssResolvedPath);
        if (cssEntry) {
          const cssContent = await cssEntry.async('string');
          cssStyles.push(cssContent);

          // Look for url() in CSS
          const cssUrlRegex = /url\(["']?([^"')]+)["']?\)/gi;
          let cssUrlMatch: RegExpExecArray | null;
          while ((cssUrlMatch = cssUrlRegex.exec(cssContent)) !== null) {
            const rawUrl = cssUrlMatch[1];
            if (rawUrl.startsWith('data:') || rawUrl.startsWith('#')) continue;
            const imgResolvedPath = resolveRelativePath(cssResolvedPath, rawUrl);
            let imgEntry = zipFiles.get(imgResolvedPath);
            if (!imgEntry) {
              const justName = decodeURIComponent(rawUrl.split('/').pop()?.toLowerCase() || '');
              const fullPath = zipFilesByName.get(justName);
              if (fullPath) imgEntry = zipFiles.get(fullPath);
            }
            if (imgEntry && isImageFile(imgEntry.name)) {
              const imgData = await imgEntry.async('base64');
              const imgExt = imgEntry.name.split('.').pop()?.toLowerCase() || 'png';
              const mime = getMimeFromExt(imgExt);
              imageMap[rawUrl] = `data:${mime};base64,${imgData}`;
              if (debug) debugLog.push(`[OK] css-url: "${rawUrl}" -> "${imgEntry.name}"`);
            }
          }
        }
      }

      // Now replace all found images in the HTML content
      for (const [rawSrc, dataUrl] of Object.entries(imageMap)) {
        const escaped = rawSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Replace src="..."
        htmlContent = htmlContent.replace(
          new RegExp(`src=["']${escaped}["']`, 'gi'),
          `src="${dataUrl}"`
        );
        // Replace xlink:href="..."
        htmlContent = htmlContent.replace(
          new RegExp(`xlink:href=["']${escaped}["']`, 'gi'),
          `xlink:href="${dataUrl}"`
        );
        // Replace href="..." on image/svg elements
        htmlContent = htmlContent.replace(
          new RegExp(`(<(?:image|img)\\s[^>]*?)href=["']${escaped}["']`, 'gi'),
          `$1href="${dataUrl}"`
        );
        // Replace url(...)
        htmlContent = htmlContent.replace(
          new RegExp(`url\\(["']?${escaped}["']?\\)`, 'gi'),
          `url("${dataUrl}")`
        );
      }

      // Remove CSS link tags since we inline them
      const fullCss = cssStyles.join('\n');

      // If debug mode, return debug info instead of HTML
      if (debug) {
        return NextResponse.json({
          chapterFile: chapterData.href,
          totalImagesFound: Object.keys(imageMap).length,
          imagesReplaced: Object.keys(imageMap),
          allZipImageFiles: allZipPaths.filter(p => isImageFile(p)),
          htmlSnippet: htmlContent.substring(0, 2000),
          log: debugLog,
        });
      }

      // Build complete HTML document
      const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { max-width: 100% !important; box-sizing: border-box !important; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 18px;
    line-height: 1.8;
    color: #1a1a1a;
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
    background: #fff;
  }
  img, image { max-width: 100% !important; height: auto !important; display: block; margin: 16px auto; }
  svg { max-width: 100%; height: auto; display: block; margin: 16px auto; }
  h1, h2, h3, h4, h5, h6 { margin: 1.5em 0 0.5em 0; line-height: 1.3; }
  p { margin: 0.8em 0; text-align: justify; }
  a { color: #2563eb; }
  table { max-width: 100%; overflow-x: auto; display: block; }
  pre, code { white-space: pre-wrap; word-wrap: break-word; }
  ${fullCss}
</style>
</head>
<body>
${htmlContent}
</body>
</html>`;

      return new NextResponse(fullHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Return chapter list
    return NextResponse.json({
      title,
      totalChapters: chapters.length,
      chapters,
    });

  } catch (error) {
    console.error('EPUB parse error:', error);
    return NextResponse.json(
      { error: 'Failed to parse EPUB', details: String(error) },
      { status: 500 }
    );
  }
}

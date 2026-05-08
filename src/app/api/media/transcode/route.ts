import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Track active transcode processes
let activeTranscodes = 0;
const MAX_CONCURRENT = 3;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'Path required' }, { status: 400 });
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

    // Check concurrent transcode limit
    if (activeTranscodes >= MAX_CONCURRENT) {
      return NextResponse.json(
        { error: `Máximo ${MAX_CONCURRENT} transcodificaciones simultáneas. Espera un momento.` },
        { status: 429 }
      );
    }

    activeTranscodes++;

    let killed = false;
    const cleanup = () => {
      if (!killed) {
        killed = true;
        activeTranscodes = Math.max(0, activeTranscodes - 1);
      }
    };

    // FFmpeg: transcode to H.264 + AAC in fragmented MP4
    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel', 'warning',
      '-threads', '2',
      // Input
      '-i', normalized,
      // Video: H.264
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'fastdecode',
      '-crf', '23',
      '-profile:v', 'high',
      '-level', '4.1',
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      // Keyframes every 2 seconds for smooth seeking
      '-g', '60',
      '-keyint_min', '60',
      '-sc_threshold', '0',
      // Audio: AAC
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ac', '2',
      '-ar', '48000',
      // Streaming format
      '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4',
      'pipe:1',
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    // Kill FFmpeg if client disconnects
    request.signal.addEventListener('abort', () => {
      if (!killed) {
        cleanup();
        ffmpeg.kill('SIGTERM');
      }
    });

    const readableStream = new ReadableStream({
      start(controller) {
        ffmpeg.stdout.on('data', (chunk: Buffer) => {
          try {
            controller.enqueue(new Uint8Array(chunk));
          } catch {
            // Controller closed
          }
        });

        ffmpeg.stderr.on('data', (chunk: Buffer) => {
          const msg = chunk.toString().trim();
          if (msg) console.error(`[ffmpeg] ${msg}`);
        });

        ffmpeg.on('error', (err) => {
          console.error(`[ffmpeg] spawn error: ${err.message}`);
          cleanup();
          try { controller.error(new Error('Transcoding failed')); } catch { /* ignore */ }
        });

        ffmpeg.on('close', (code) => {
          cleanup();
          if (code !== 0 && code !== null) {
            console.error(`[ffmpeg] exit code ${code} for ${path.basename(normalized)}`);
          }
          try { controller.close(); } catch { /* ignore */ }
        });
      },
      cancel() {
        cleanup();
        if (!ffmpeg.killed) ffmpeg.kill('SIGTERM');
      },
    });

    return new NextResponse(readableStream, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[transcode] error:', error);
    return NextResponse.json(
      { error: 'Transcoding failed', details: String(error) },
      { status: 500 }
    );
  }
}

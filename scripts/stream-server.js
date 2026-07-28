import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { loadEnvFile } from './env.js';

const env = { ...loadEnvFile(), ...process.env };
const port = Number(env.STREAM_SERVER_PORT || 5177);
const streamId = env.STREAM_ID || 'cam-a01';
const rtspUrl = env.VITE_PRIMARY_RTSP_URL || '';
const hlsRoot = resolve(process.cwd(), '.runtime', 'hls');
const streamDir = join(hlsRoot, streamId);
const manifestPath = join(streamDir, 'index.m3u8');
const snapshotPath = join(streamDir, 'latest.jpg');
let ffmpegProcess = null;
let ffmpegStartedAt = 0;
let lastError = '';
let snapshotProcess = null;

function prepareOutputDir() {
  mkdirSync(streamDir, { recursive: true });
  for (const file of readdirSync(streamDir)) {
    if (!/^(index\.m3u8|latest\.jpg|segment_\d+\.ts)$/u.test(file)) continue;
    try {
      rmSync(join(streamDir, file), { force: true });
    } catch (error) {
      lastError = `旧 HLS 文件被占用，已跳过清理：${file}`;
    }
  }
}

function maskUrl(url = '') {
  return url.replace(/:\/\/([^:@/\s]+):([^@/\s]+)@/u, '://$1:******@');
}

function startTranscoder() {
  if (!rtspUrl) {
    lastError = 'VITE_PRIMARY_RTSP_URL is not configured in .env.local';
    return;
  }

  if (ffmpegProcess && !ffmpegProcess.killed) return;
  prepareOutputDir();
  ffmpegStartedAt = Date.now();

  const videoCodec = env.STREAM_VIDEO_CODEC || 'libx264';
  const args = [
    '-hide_banner',
    '-loglevel', 'warning',
    '-rtsp_transport', env.RTSP_TRANSPORT || 'tcp',
    '-i', rtspUrl,
    '-an',
    '-c:v', videoCodec,
    ...(videoCodec === 'libx264' ? ['-preset', 'ultrafast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p'] : []),
    '-f', 'hls',
    '-hls_time', env.HLS_TIME || '1',
    '-hls_list_size', env.HLS_LIST_SIZE || '6',
    '-hls_flags', 'delete_segments+append_list+omit_endlist',
    '-hls_segment_filename', join(streamDir, 'segment_%05d.ts'),
    manifestPath,
  ];

  ffmpegProcess = spawn(ffmpeg.path, args, {
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  ffmpegProcess.stderr.on('data', (chunk) => {
    lastError = chunk.toString('utf8').trim().slice(-1000);
  });

  ffmpegProcess.on('exit', (code, signal) => {
    ffmpegProcess = null;
    if (code !== 0 && signal !== 'SIGTERM') {
      lastError = lastError || `ffmpeg exited with code ${code}`;
      setTimeout(startTranscoder, 3000);
    }
  });

  console.log(`[stream] ${streamId} RTSP -> HLS: ${maskUrl(rtspUrl)}`);
  console.log(`[stream] HLS URL: http://127.0.0.1:${port}/hls/${streamId}/index.m3u8`);
}

function refreshSnapshot() {
  if (!existsSync(manifestPath) || snapshotProcess) return;
  const latestSegment = readdirSync(streamDir)
    .filter((file) => /^segment_\d+\.ts$/u.test(file))
    .sort()
    .at(-1);
  if (!latestSegment) return;
  snapshotProcess = spawn(ffmpeg.path, [
    '-y',
    '-loglevel', 'error',
    '-i', join(streamDir, latestSegment),
    '-frames:v', '1',
    snapshotPath,
  ], {
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  snapshotProcess.on('exit', () => {
    snapshotProcess = null;
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendFile(response, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    response.end('not found');
    return;
  }

  const ext = extname(filePath);
  const contentType = ext === '.m3u8'
    ? 'application/vnd.apple.mpegurl'
    : ext === '.ts'
      ? 'video/mp2t'
      : ext === '.jpg'
        ? 'image/jpeg'
        : 'application/octet-stream';

  response.writeHead(200, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(response);
}

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' });
    response.end();
    return;
  }

  if (url.pathname === '/api/streams/status') {
    const manifestReady = existsSync(manifestPath);
    sendJson(response, 200, {
      streamId,
      rtspConfigured: Boolean(rtspUrl),
      rtspUrl: maskUrl(rtspUrl),
      hlsUrl: `http://127.0.0.1:${port}/hls/${streamId}/index.m3u8`,
      snapshotUrl: `http://127.0.0.1:${port}/snapshot/${streamId}.jpg`,
      running: Boolean(ffmpegProcess),
      startedAt: ffmpegStartedAt,
      manifestReady,
      snapshotReady: existsSync(snapshotPath),
      lastError,
    });
    return;
  }

  if (url.pathname === '/api/streams/restart' && request.method === 'POST') {
    if (ffmpegProcess) ffmpegProcess.kill('SIGTERM');
    ffmpegProcess = null;
    lastError = '';
    startTranscoder();
    sendJson(response, 202, { restarted: true });
    return;
  }

  const hlsPrefix = `/hls/${streamId}/`;
  if (url.pathname.startsWith(hlsPrefix)) {
    const safeName = basename(url.pathname.slice(hlsPrefix.length));
    sendFile(response, join(streamDir, safeName));
    return;
  }

  if (url.pathname === `/snapshot/${streamId}.jpg`) {
    refreshSnapshot();
    sendFile(response, snapshotPath);
    return;
  }

  sendJson(response, 404, { error: 'not found' });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[stream] server listening on http://127.0.0.1:${port}`);
  startTranscoder();
  setInterval(refreshSnapshot, 3000).unref();
});

function shutdown() {
  if (ffmpegProcess) ffmpegProcess.kill('SIGTERM');
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

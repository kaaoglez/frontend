import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface DiskInfo {
  name: string;
  mountPath: string;
  totalSpace: number;
  usedSpace: number;
  freeSpace: number;
  usagePercent: number;
  filesystem: string;
  folderCount: number;
  fileCount: number;
  mounted: boolean;
}

function countItems(dirPath: string, depth: number = 0): { folders: number; files: number } {
  if (depth > 1) return { folders: 0, files: 0 };
  let folders = 0;
  let files = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        folders++;
        if (depth < 1) {
          try {
            const sub = countItems(path.join(dirPath, entry.name), depth + 1);
            folders += sub.folders;
            files += sub.files;
          } catch { /* skip unreadable */ }
        }
      } else {
        files++;
      }
    }
  } catch { /* skip unreadable */ }
  return { folders, files };
}

function getDiskUsage(mountPath: string): { total: number; used: number; free: number; fs: string } {
  try {
    const output = execSync(`df -B1 "${mountPath}" 2>/dev/null`).toString();
    const lines = output.trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      return {
        total: parseInt(parts[1]) || 0,
        used: parseInt(parts[2]) || 0,
        free: parseInt(parts[3]) || 0,
        fs: parts[0] || 'unknown',
      };
    }
  } catch { /* skip */ }
  return { total: 0, used: 0, free: 0, fs: 'unknown' };
}

export async function GET() {
  try {
    // Get all mount points from /proc/mounts or df
    let mountPoints: string[] = [];
    try {
      const output = execSync("df -h --output=target 2>/dev/null | tail -n +2").toString();
      mountPoints = output.trim().split('\n').filter(p => p.trim());
    } catch {
      mountPoints = ['/'];
    }

    // Filter interesting mount points (physical disks, not system)
    const interestingMounts = mountPoints.filter(p => {
      const trimmed = p.trim();
      return (
        trimmed.startsWith('/mnt/') ||
        trimmed.startsWith('/media/') ||
        trimmed.startsWith('/home/') ||
        trimmed === '/'
      );
    });

    const disks: DiskInfo[] = [];

    for (const mount of interestingMounts) {
      const trimmed = mount.trim();
      const mounted = fs.existsSync(trimmed);

      if (!mounted) {
        disks.push({
          name: trimmed.split('/').pop() || trimmed,
          mountPath: trimmed,
          totalSpace: 0,
          usedSpace: 0,
          freeSpace: 0,
          usagePercent: 0,
          filesystem: 'unknown',
          folderCount: 0,
          fileCount: 0,
          mounted: false,
        });
        continue;
      }

      const usage = getDiskUsage(trimmed);
      const counts = countItems(trimmed, 0);

      disks.push({
        name: trimmed === '/' ? 'Raíz' : trimmed.split('/').pop() || trimmed,
        mountPath: trimmed,
        totalSpace: usage.total,
        usedSpace: usage.used,
        freeSpace: usage.free,
        usagePercent: usage.total > 0 ? Math.round((usage.used / usage.total) * 100) : 0,
        filesystem: usage.fs,
        folderCount: counts.folders,
        fileCount: counts.files,
        mounted: true,
      });
    }

    // Sort: /mnt/ and /media/ first, then /home, then /
    const diskOrder = (d: DiskInfo) => {
      if (d.mountPath.startsWith('/mnt/')) return 0;
      if (d.mountPath.startsWith('/media/')) return 1;
      if (d.mountPath.startsWith('/home/')) return 2;
      return 3;
    };

    disks.sort((a, b) => diskOrder(a) - diskOrder(b));

    return NextResponse.json({ disks });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get disk info', details: String(error) },
      { status: 500 }
    );
  }
}

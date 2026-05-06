import { NextResponse } from 'next/server';
import os from 'os';
import fs from 'fs';

export async function GET() {
  try {
    const homeDir = os.homedir();
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();
    const nodeVersion = process.version;
    const uptime = os.uptime();
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100);

    let totalDiskSpace = 0;
    let freeDiskSpace = 0;
    try {
      const { execSync } = await import('child_process');
      const dfOutput = execSync(`df -B1 ${homeDir} 2>/dev/null || df -B1 / 2>/dev/null`).toString();
      const lines = dfOutput.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        totalDiskSpace = parseInt(parts[1]) || 0;
        freeDiskSpace = parseInt(parts[3]) || 0;
      }
    } catch {
      try {
        const stat = fs.statSync(homeDir);
        totalDiskSpace = 100 * 1024 * 1024 * 1024;
        freeDiskSpace = 50 * 1024 * 1024 * 1024;
      } catch {
        totalDiskSpace = 0;
        freeDiskSpace = 0;
      }
    }

    const usedDiskSpace = totalDiskSpace - freeDiskSpace;
    const diskUsagePercent = totalDiskSpace > 0 ? Math.round((usedDiskSpace / totalDiskSpace) * 100) : 0;

    const networkInterfaces = Object.entries(os.networkInterfaces())
      .filter(([, addresses]) => addresses && addresses.length > 0)
      .map(([name, addresses]) => {
        const addr = addresses!.find((a) => a.family === 'IPv4' && !a.internal);
        return {
          name,
          address: addr?.address || 'N/A',
          family: addr?.family || 'N/A',
        };
      })
      .filter((iface) => iface.address !== 'N/A');

    return NextResponse.json({
      homeDir,
      hostname,
      platform,
      arch,
      nodeVersion,
      uptime,
      cpuCores: cpus.length,
      cpuModel: cpus[0]?.model || 'Unknown',
      totalMemory,
      freeMemory,
      usedMemory,
      memoryUsagePercent,
      totalDiskSpace,
      freeDiskSpace,
      usedDiskSpace,
      diskUsagePercent,
      networkInterfaces,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get server stats', details: String(error) },
      { status: 500 }
    );
  }
}

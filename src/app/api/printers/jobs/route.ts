import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const jobs = await db.printJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ jobs });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get print jobs', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, filePath, printerName, copies } = body;

    if (!fileName || !filePath) {
      return NextResponse.json({ error: 'File name and path are required' }, { status: 400 });
    }

    const job = await db.printJob.create({
      data: {
        fileName,
        filePath,
        printerName: printerName || null,
        copies: copies || 1,
        status: 'pending',
      },
    });

    // Try to actually send to printer using lp command
    try {
      const { execSync } = await import('child_process');
      const cmd = printerName
        ? `lp -d "${printerName}" -n ${copies || 1} "${filePath}"`
        : `lp -n ${copies || 1} "${filePath}"`;
      execSync(cmd);
      await db.printJob.update({ where: { id: job.id }, data: { status: 'printing' } });
    } catch {
      await db.printJob.update({ where: { id: job.id }, data: { status: 'failed' } });
    }

    return NextResponse.json({ success: true, job });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to submit print job', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, clearAll } = body;

    if (clearAll) {
      // Clear entire queue
      const count = await db.printJob.deleteMany({});
      return NextResponse.json({ success: true, deleted: count.count });
    }

    if (!id) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Cancel individual job - try to cancel via CUPS first, then delete from DB
    try {
      const job = await db.printJob.findUnique({ where: { id } });
      if (job && job.status === 'printing') {
        try {
          const { execSync } = await import('child_process');
          execSync('cancel -a');
        } catch {
          // CUPS cancel failed, continue with DB delete
        }
      }
    } catch {
      // ignore
    }

    await db.printJob.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete job', details: String(error) }, { status: 500 });
  }
}

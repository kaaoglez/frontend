import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { execSync } = await import('child_process');
    
    // Try to get printer information using lpstat
    let printers: Array<{
      name: string;
      status: string;
      isDefault: boolean;
      description?: string;
    }> = [];

    try {
      const printerOutput = execSync('lpstat -p -d 2>/dev/null').toString();
      const defaultMatch = printerOutput.match(/system default destination:\s*(.+)/);
      const defaultPrinter = defaultMatch ? defaultMatch[1].trim() : '';

      const printerLines = printerOutput.split('\n').filter((l: string) => l.startsWith('printer '));
      for (const line of printerLines) {
        const match = line.match(/printer\s+(\S+)\s+(.+)/);
        if (match) {
          printers.push({
            name: match[1],
            status: match[2].includes('idle') ? 'Listo' : match[2].includes('printing') ? 'Imprimiendo' : match[2],
            isDefault: match[1] === defaultPrinter,
          });
        }
      }
    } catch {
      // No printer system available - return empty
    }

    return NextResponse.json({ printers });
  } catch {
    return NextResponse.json({ printers: [] });
  }
}

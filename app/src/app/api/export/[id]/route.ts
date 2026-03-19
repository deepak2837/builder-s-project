import { NextResponse } from 'next/server';
import { getReport, materialise } from '@/lib/repository';
import { buildXlsx } from '@/lib/export/xlsx';
import { buildDocx } from '@/lib/export/docx';
import { buildCsv } from '@/lib/export/csv';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = new URL(request.url).searchParams.get('format') ?? 'xlsx';

  const report = await getReport(id);
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

  const result = materialise(report);
  const safeName = `${result.inputs.projectName} Feasibility v${report.version}`.replace(/[^a-z0-9 \-_]/gi, '');

  try {
    if (format === 'csv') {
      return new NextResponse(buildCsv(result), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${safeName}.csv"`,
        },
      });
    }

    if (format === 'docx') {
      const buffer = await buildDocx(result);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${safeName}.docx"`,
        },
      });
    }

    const buffer = await buildXlsx(result);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeName}.xlsx"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

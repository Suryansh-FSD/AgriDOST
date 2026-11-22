import { NextRequest, NextResponse } from 'next/server';
import { executeTinyAgent, TinyAgentRequestSchema, TinyFishError } from '@/lib/integrations/tinyfish';

/**
 * POST /api/tinyfish/agent
 * Executes controlled read-only browser research goal via TinyAgent.
 */
export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload received in request body.' },
        { status: 400 }
      );
    }

    const validated = TinyAgentRequestSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          issues: validated.error.issues,
        },
        { status: 400 }
      );
    }

    const agentResult = await executeTinyAgent(validated.data);

    return NextResponse.json(
      {
        success: true,
        ...agentResult,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof TinyFishError) {
      return NextResponse.json(
        {
          success: false,
          code: err.code,
          error: err.message,
        },
        { status: err.status || 500 }
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

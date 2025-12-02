import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ auth: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const action = resolvedParams.auth[0]; // 'login', 'logout', or 'refresh'
    const body = await request.json().catch(() => ({}));

    // Forward request to backend
    const response = await fetch(`${API_URL}/admin/auth/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Create response
    const nextResponse = NextResponse.json(data, { status: response.status });

    // Forward cookies from backend
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      nextResponse.headers.set('set-cookie', setCookie);
    }

    return nextResponse;
  } catch (error) {
    console.error('Auth proxy error:', error);
    return NextResponse.json(
      { error: 'Authentication failed', message: 'An error occurred' },
      { status: 500 }
    );
  }
}

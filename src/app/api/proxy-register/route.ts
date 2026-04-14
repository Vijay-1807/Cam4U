
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Relay registration to Python backend
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // This endpoint forwards the registration request to the Python backend
        // after email verification has succeeded on the client side.

        try {
            const response = await axios.post('http://localhost:5000/api/auth/register', body);
            return NextResponse.json(response.data, { status: response.status });
        } catch (backendError: any) {
            console.error('Backend registration error:', backendError.response?.data || backendError.message);
            return NextResponse.json(
                { error: backendError.response?.data?.error || 'Registration failed on backend' },
                { status: backendError.response?.status || 500 }
            );
        }

    } catch (error: any) {
        console.error('Registration API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}


import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationCodeEmail, generateVerificationCode, sendPasswordResetEmail, sendWelcomeEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { type, email, name, code } = body;

        if (!email || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        let result;
        const generatedCode = code || generateVerificationCode();

        if (type === 'verification') {
            result = await sendVerificationCodeEmail(email, name || 'User', generatedCode);
        } else if (type === 'reset-password') {
            result = await sendPasswordResetEmail(email, name || 'User', generatedCode);
        } else if (type === 'welcome') {
            result = await sendWelcomeEmail(email, name || 'User');
        } else {
            return NextResponse.json({ error: 'Invalid email type' }, { status: 400 });
        }

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: 'Email sent successfully',
                code: generatedCode // Return code to client for handling (simplified flow)
            });
        } else {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

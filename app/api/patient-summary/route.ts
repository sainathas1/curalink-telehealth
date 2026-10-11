import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'GEMINI_API_KEY is not configured in .env.local.',
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { prescriptions = [], records = [], patientName = 'there' } = body;

    const safePrescriptions = Array.isArray(prescriptions) ? prescriptions : [];
    const safeRecords = Array.isArray(records) ? records : [];

    // Filter active prescriptions
    const activePrescriptions = safePrescriptions.filter(
      (p) => (p?.status || '').toLowerCase() === 'active'
    );

    const prescriptionContext = activePrescriptions.length
      ? activePrescriptions
          .map(
            (p) =>
              `- ${p.medicationName || 'Medication'} (${p.dosage || ''}, ${p.frequency || ''}): ${p.instructions || 'As prescribed'}`
          )
          .join('\n')
      : 'None currently active';

    const recordContext = safeRecords.length
      ? safeRecords
          .slice(0, 5)
          .map(
            (r) =>
              `- ${r.title || 'Document'} (${r.type || 'Clinical Document'}, dated ${r.date || 'Recent'}): ${r.summary || 'Summary on file'}`
          )
          .join('\n')
      : 'No medical documents on file';

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are the "Gemini Health Assistant" in the CuraLink patient portal for patient "${patientName}".
Your mission is to welcome the patient and provide an encouraging, crystal-clear, plain-English summary of their care plan for today based strictly on their current records.

Patient Data:
- Active Prescriptions (${activePrescriptions.length} active):
${prescriptionContext}

- Recent Health & Lab Records (${safeRecords.length} records):
${recordContext}

Instructions:
1. Provide a warm, conversational, exactly 2-sentence summary of what they need to know right now.
   - Mention their active medication routine if they have any (e.g. number of active prescriptions to take).
   - Mention their recent lab or clinical records if available (e.g. that their latest report or results are ready for review).
   - If they have neither active prescriptions nor recent records, give a welcoming 2-sentence encouraging note that their care space is up to date and they're all set.
2. Tone: Warm, reassuring, approachable, friendly, and empowering.
3. Strict Constraints:
   - Output ONLY the 2 sentences.
   - Do NOT use bullet points, bold formatting tags, quotation marks, or markdown headers.
   - Keep it concise, accessible, and free of dense medical jargon.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    const summaryText =
      response.text?.trim() ||
      (activePrescriptions.length > 0
        ? `You have ${activePrescriptions.length} active prescription${activePrescriptions.length > 1 ? 's' : ''} to take today, and your health records are securely stored and up to date.`
        : 'Welcome back! Your health profile and medical records are up to date and ready whenever you need them.');

    return NextResponse.json({
      summary: summaryText,
    });
  } catch (err: any) {
    console.error('Error in /api/patient-summary:', err);
    return NextResponse.json(
      {
        error: err?.message || 'Failed to generate patient AI health summary.',
      },
      { status: 500 }
    );
  }
}

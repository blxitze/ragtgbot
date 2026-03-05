import OpenAI from 'openai';

// Lazily initialized — standalone scripts need loadEnvConfig() before first use.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
    if (!_openai) {
        _openai = new OpenAI();
    }
    return _openai;
}

export async function callOpenAI(
    systemPrompt: string,
    userPrompt: string,
    maxRetries = 2
): Promise<string> {
    let attempt = 0;
    while (attempt <= maxRetries) {
        try {
            const response = await getOpenAI().chat.completions.create({
                model: 'gpt-4o-mini', // or gpt-4-turbo, etc., depending on needs
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.2,
            }, {
                timeout: 60000,
            });

            const messageContent = response.choices[0]?.message?.content;
            if (!messageContent) {
                throw new Error('No content returned from OpenAI');
            }

            return messageContent;
        } catch (error) {
            attempt++;
            if (attempt > maxRetries) {
                throw new Error(`OpenAI API failed after ${maxRetries} retries: ${error instanceof Error ? error.message : String(error)}`);
            }
            // Wait a bit before retrying (exponential backoff could be added here)
            await new Promise(res => setTimeout(res, 1000 * attempt));
        }
    }
    throw new Error('Unexpected end of OpenAI call wrapper');
}

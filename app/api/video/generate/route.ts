import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for video generation

type RequestBody = {
  action: "start" | "status";
  prompt?: string;
  operation_name?: string;
  aspect_ratio?: "16:9" | "9:16";
  negative_prompt?: string;
  person_generation?: "allow_all" | "allow_adult" | "dont_allow";
  number_of_videos?: number;
  duration_seconds?: number;
  enhance_prompt?: boolean;
  api_key?: string; // Allow API key to be passed directly or use db/env var
};

interface AIProvider {
  id: string;
  name: string;
  enabled: boolean;
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

interface AISettings {
  providers: AIProvider[];
  behaviorSettings?: Record<string, unknown>;
}

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function getGeminiApiKey(): Promise<string | null> {
  try {
    const result = await pool.query(
      'SELECT settings FROM "AISettings" LIMIT 1'
    );

    if (result.rows.length === 0) {
      console.warn("No AI settings found in database");
      return null;
    }

    const settings = result.rows[0].settings as unknown as AISettings;

    // Find the enabled Gemini provider
    const geminiProvider = settings.providers?.find(
      (p: AIProvider) => p.id === "gemini" && p.enabled
    );

    if (!geminiProvider) {
      console.warn("Gemini provider not found or not enabled in AI settings");
      return null;
    }

    return geminiProvider.apiKey || null;
  } catch (error) {
    console.error("Error fetching Gemini API key from database:", error);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;

    // Validate request
    const action = body.action as "start" | "status" | undefined;
    if (!action || !["start", "status"].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "start" or "status"' },
        { status: 400 }
      );
    }

    // Get API key: from request body > database > environment
    let apiKey = body.api_key;

    if (!apiKey) {
      apiKey = await getGeminiApiKey();
    }

    if (!apiKey) {
      apiKey = process.env.GOOGLE_AI_API_KEY;
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Gemini API key not found. Provide api_key in request body, enable it in AI settings, or set GOOGLE_AI_API_KEY environment variable.",
        },
        { status: 400 }
      );
    }

    // Construct the tool invocation payload
    const toolPayload = {
      action,
      api_key: apiKey,
      ...(action === "start" && {
        prompt: body.prompt,
        model: "veo-3.0-generate-001",
        aspect_ratio: body.aspect_ratio || "16:9",
        negative_prompt: body.negative_prompt,
        person_generation: body.person_generation || "allow_all",
        enhance_prompt: body.enhance_prompt ?? false,
      }),
      ...(action === "status" && {
        operation_name: body.operation_name,
      }),
    };

    // Return the payload with the API key fetched from the database
    return NextResponse.json({
      status: "success",
      message:
        "Video generation endpoint ready. API key fetched from database.",
      toolPayload,
      apiKeySource: "database",
      action,
    });
  } catch (error) {
    console.error("Video generation error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

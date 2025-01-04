import { IAgentRuntime, Memory, State, Evaluator, ActionExample } from "@elizaos/core";
import { composeContext, generateObject } from "@elizaos/core";
import { ModelClass } from "@elizaos/core";

interface UserData {
    name?: string;
    location?: string;
    occupation?: string;
}

// Helper Functions
const getCacheKey = (runtime: IAgentRuntime, username: string): string => {
    return `${runtime.character.name}/${username}/user_data`;
};

const isDataComplete = (data: UserData): boolean => {
    return !!(data.name && data.location && data.occupation);
};

const USER_DATA_TEMPLATE = `
TASK: Extract user information from the conversation.

EXAMPLES:
{{evaluationExamples}}

INSTRUCTIONS:
Extract any clearly stated user information from the conversation:
- Only extract information that is explicitly stated
- Skip ambiguous or unclear information
- If multiple possibilities exist, do not extract

Recent Messages:
{{recentMessages}}

Response should be a JSON object in a markdown block:
\`\`\`json
{
    "name": string | null,
    "location": string | null,
    "occupation": string | null
}
\`\`\``;

export const userDataEvaluator: Evaluator = {
    name: "GET_USER_DATA",
    similes: ["EXTRACT_USER_INFO", "GET_USER_INFO", "COLLECT_USER_DATA"],

    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        if (!state?.senderName) return false;

        const cacheKey = getCacheKey(runtime, state.senderName);
        const data = await runtime.cacheManager.get<UserData>(cacheKey) || {};

        return !isDataComplete(data);
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<void> => {
        if (!state?.senderName) return;

        const context = composeContext({
            state,
            template: USER_DATA_TEMPLATE
        });

        const extracted = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.LARGE
        }) as UserData | null;

        if (!extracted) return;

        const cacheKey = getCacheKey(runtime, state.senderName);
        const currentData = await runtime.cacheManager.get<UserData>(cacheKey) || {};

        // Only update fields that are newly extracted and non-null
        const updatedData = {
            ...currentData,
            ...(extracted.name && { name: extracted.name }),
            ...(extracted.location && { location: extracted.location }),
            ...(extracted.occupation && { occupation: extracted.occupation })
        };

        // Only save if we have new information
        if (JSON.stringify(currentData) !== JSON.stringify(updatedData)) {
            await runtime.cacheManager.set(cacheKey, updatedData);
        }
    },

    description: "Extracts user's name, location, and occupation from natural conversation",

    examples: [
        {
            context: "New user introduction",
            messages: [
                {
                    user: "User",
                    content: { text: "Hi, I'm David Chen. I work as a nurse in Toronto." }
                }
            ] as ActionExample[],
            outcome: `{
                "name": "David Chen",
                "location": "Toronto",
                "occupation": "nurse"
            }`
        },
        {
            context: "Casual conversation",
            messages: [
                {
                    user: "Bot",
                    content: { text: "What brought you to Seattle?" }
                },
                {
                    user: "User",
                    content: { text: "I moved here when I started my job as an architect" }
                }
            ] as ActionExample[],
            outcome: `{
                "name": null,
                "location": "Seattle",
                "occupation": "architect"
            }`
        },
        {
            context: "Ambiguous information (negative example)",
            messages: [
                {
                    user: "User",
                    content: { text: "My friend Sarah and I both work in marketing" }
                }
            ] as ActionExample[],
            outcome: `{
                "name": null,
                "location": null,
                "occupation": null
            }`
        }
    ],

    alwaysRun: true
};
import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";

interface UserData {
    name?: string;
    location?: string;
    occupation?: string;
}

const FIELD_DESCRIPTIONS = {
    name: "full name (first and last if mentioned)",
    location: "city and/or country where they live",
    occupation: "job title or profession"
};

// Helper Functions
const getCacheKey = (runtime: IAgentRuntime, username: string): string => {
    return `${runtime.character.name}/${username}/user_data`;
};

const isDataComplete = (data: UserData): boolean => {
    return !!(data.name && data.location && data.occupation);
};

const getMissingFields = (data: UserData): (keyof UserData)[] => {
    const missing: (keyof UserData)[] = [];
    if (!data.name) missing.push('name');
    if (!data.location) missing.push('location');
    if (!data.occupation) missing.push('occupation');
    return missing;
};

const formatFieldInstructions = (missing: (keyof UserData)[]): string => {
    if (missing.length === 0) return "";

    return missing.map(field =>
        `- ${field}: need to know their ${FIELD_DESCRIPTIONS[field]}`
    ).join('\n');
};

export const userDataProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string> => {
        if (!state?.senderName) return "";

        const cacheKey = getCacheKey(runtime, state.senderName);
        const data = await runtime.cacheManager.get<UserData>(cacheKey) || {};

        const missingFields = getMissingFields(data);
        const isComplete = isDataComplete(data);

        let output = "# User Information Status\n\n";

        // Current Information
        if (Object.keys(data).length > 0) {
            output += "Currently Known:\n";
            if (data.name) output += `- Name: ${data.name}\n`;
            if (data.location) output += `- Location: ${data.location}\n`;
            if (data.occupation) output += `- Occupation: ${data.occupation}\n`;
            output += "\n";
        }

        // Instructions Section
        if (isComplete) {
            output += "Profile is complete. Continue natural conversation.";
        } else {
            output += "Information Needed:\n";
            output += formatFieldInstructions(missingFields);
            output += "\n\nInstructions:\n";
            output += "- Work to gather all missing information\n";
            output += "- Ask natural follow-up questions\n";
            output += "- Keep conversation engaging and natural";
        }

        return output;
    }
};
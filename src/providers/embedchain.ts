import { App } from "embedchain";

export async function initEmbedchain(): Promise<void> {
    try {
        console.log("initEmbedchain")
        // Run the app commands inside an async function only
        const embeddedChat = await App();

        // Embed Online Resources
        const onlineResources = [
            "https://nav.al/feedback",
            "https://nav.al/agi",
            "https://navalmanack.s3.amazonaws.com/Eric-Jorgenson_The-Almanack-of-Naval-Ravikant_Final.pdf",
        ];

        for (const resourceUrl of onlineResources) {
            await embeddedChat.add("web_page", resourceUrl);
        }

        // Embed Local Resources
        const localResources = [
            {
                question: "Who is Naval Ravikant?",
                answer: "Naval Ravikant is an Indian-American entrepreneur and investor.",
            }
        ];

        for (const resource of localResources) {
            await embeddedChat.addLocal("qna_pair", [resource.question, resource.answer]);
        }

        const query = "What unique capacity does Naval argue humans possess when it comes to understanding explanations or concepts?";
        const result = await embeddedChat.query(query);
        console.log('[EMBED]', result);
        return result;
    } catch (err) {
        console.log('[EMBED]', err);
        return;
    }
}
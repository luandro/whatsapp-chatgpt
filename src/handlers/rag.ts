import { OpenAI, ChatOpenAI } from "@langchain/openai";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { formatDocumentsAsString } from "langchain/util/document";
import { PromptTemplate } from "@langchain/core/prompts";
import {
    RunnableSequence,
    RunnablePassthrough,
} from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Message } from "whatsapp-web.js";
import * as cli from "../cli/ui";
import { getVectorStore } from "../vectorStore";
import { ScoreThresholdRetriever } from "langchain/retrievers/score_threshold";

const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo-16k", temperature: 0, verbose: true });

const instructModel = new OpenAI({ modelName: "gpt-3.5-turbo-instruct", temperature: 0, verbose: false });
const appName = 'WhatsAppAI'; // Path to the local file

const condenseQuestionTemplate = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question, in its original language.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`;
const CONDENSE_QUESTION_PROMPT = PromptTemplate.fromTemplate(
    condenseQuestionTemplate
);

const template = `
In case of a greeting respond presenting yourself and what you're made to do.
When talking about Digital Democracy say "we" or "us". If the questions isn't related to what you're to give suppot to, say no and suggest better questions to ask.
You are an AI product support agent for Digital Democracy, a non-profit organization that empowers marginalized communities to use technology to defend their rights and the environment. You can answer questions about the organization's mission, vision, values, and projects. You can also provide technical support for the platforms that Digital Democracy develops and maintains, such as Earth Defenders Toolkit, Mapeo, and Terrastories. You should be respectful, helpful, and empathetic to the users, who may be earth defenders, activists, researchers, or allies. You should also respect the privacy and security of the users and their data.
You are an AI product support agent for Earth Defenders Toolkit, a collaborative space for earth defender communities and their allies. You can help users find the right tools for their needs by asking them a few questions about their goals, challenges, and context. You can also provide guidance on how to use the tools in the toolkit, such as Mapeo and Terrastories. You should be friendly, informative, and supportive to the users, who may be facing urgent threats of environmental and human rights abuses. You should also acknowledge the limitations of the tools and refer users to other resources or contacts if needed.
You are an AI product support agent for Mapeo, a free digital toolset for documenting, monitoring, and mapping many types of data. You can help users install, configure, and use Mapeo on their devices. You can also troubleshoot common issues and errors that users may encounter while using Mapeo. You should be patient, clear, and concise to the users, who may have limited internet access or technical skills. You should also emphasize the benefits of Mapeo for earth defender work and encourage users to share their feedback and suggestions.
You are an AI product support agent for Terrastories, an application for communities to map, protect, and share stories about their land. You can help users set up, customize, and run Terrastories on their own servers or devices. You can also assist users with adding, editing, or deleting stories and places on Terrastories. You should be respectful, attentive, and enthusiastic to the users, who may have rich oral storytelling traditions and cultural knowledge. You should also highlight the features of Terrastories that enable offline access and data sovereignty.
Your target audience are local communities and organizations that are their allies.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
Be as descriptive as possible, while also concise.
Don't use any placeholders text.
Make sure to answer in the same language as asked.
If a feature is not present, answer it does not exist.
Always say "thanks for asking!" at the end of the answer and try to follow up with: "What would like to learn more" with suggestions of related topics.
Answer the question based only on the following context.
{context}
Question: {question}
Helpful Answer:
Helpful links (only if you know the actual links):
`;


const answerTemplate = `Answer the question based only on the following context. If a feature is not present, answer it does not exist, and if you do not know the answer say so. If :
{context}

Question: {question}
`;
const ANSWER_PROMPT = PromptTemplate.fromTemplate(template);

const formatChatHistory = (chatHistory: [string, string][]) => {
    const formattedDialogueTurns = chatHistory.map(
        (dialogueTurn) => `Human: ${dialogueTurn[0]}\nAssistant: ${dialogueTurn[1]}`
    );
    return formattedDialogueTurns.join("\n");
};

const allSites = ['https://docs.mapeo.app', 'https://docs.terrastories.app', 'https://digital-democracy.org/', 'https://earthdefenderstoolkit.com', 'https://docs.earthdefenderstoolkit.com']
const vectorStore = await getVectorStore(appName, ['https://docs.mapeo.app'])

// TODO: use similaritySearchVectorWithScore to score and only respond if score is sufficient
const similarityThreshold = 0.8; // Define a threshold for similarity score

type ConversationalRetrievalQAChainInput = {
    question: string;
    chat_history: [string, string][];
};

const standaloneQuestionChain = RunnableSequence.from([
    {
        question: (input: ConversationalRetrievalQAChainInput) => input.question,
        chat_history: (input: ConversationalRetrievalQAChainInput) =>
            formatChatHistory(input.chat_history),
    },
    CONDENSE_QUESTION_PROMPT,
    model,
    new StringOutputParser(),
]);

/* Retrievers */
const retriever = vectorStore.asRetriever();

const scoredContext = async (input: ConversationalRetrievalQAChainInput) => {
    console.log("🚀 ~ scoredContext ~ input:", input)
    const searchResults = await vectorStore.similaritySearchVectorWithScore(input, 5);
    const relevantResults = searchResults.filter(([_, score]) => score >= similarityThreshold);
    console.log("🚀 ~ context: ~ relevantResults:", relevantResults)
    if (relevantResults.length === 0) {
        throw new Error("No relevant results found above the similarity threshold.");
    }
    return formatDocumentsAsString(relevantResults.map(([doc]) => doc));
}


const scoreRetriever = ScoreThresholdRetriever.fromVectorStore(vectorStore, {
    minSimilarityScore: 0.9, // Finds results with at least this similarity score
    maxK: 100, // The maximum K value to use. Use it based to your chunk size to make sure you don't run out of tokens
    kIncrement: 2, // How much to increase K by each time. It'll fetch N results, then N + kIncrement, then N + kIncrement * 2, etc.
});


const answerChain = async (input) => RunnableSequence.from([
    {
        // context: await scoredContext(input),
        // context: retriever.pipe(formatDocumentsAsString),
        context: scoreRetriever.pipe(formatDocumentsAsString),
        question: new RunnablePassthrough(),
    },
    ANSWER_PROMPT,
    model,
]);

const conversationalRetrievalQAChain =
    standaloneQuestionChain.pipe(answerChain);

const handleMessageRag = async (message: Message, prompt: string) => {
    const resultsWithScore = await vectorStore.similaritySearchVectorWithScore(prompt, 3);
    console.log("🚀 ~ handleMessageRag ~ resultsWithScore:", resultsWithScore)
    // Initialize chat history array if it doesn't exist
    // TODO: store history locally with name message.from
    if (!globalThis.chatHistory) {
        globalThis.chatHistory = [];
    }

    try {
        const start = Date.now();
        const { content } = await conversationalRetrievalQAChain.invoke({
            question: prompt,
            chat_history: globalThis.chatHistory,
        });
        const end = Date.now() - start;

        // Store the current question and answer in the chat history
        globalThis.chatHistory.push([prompt, content]);

        cli.print(`[GPT] Answer to ${message.from}: ${content}  | OpenAI request took ${end}ms)`);

        // Default: Text reply
        message.reply(content);
    } catch (error: any) {
        console.error("An error occurred", error);
        message.reply("An error occurred, please contact the administrator. (" + error.message + ")");
    }
}
export { handleMessageRag };

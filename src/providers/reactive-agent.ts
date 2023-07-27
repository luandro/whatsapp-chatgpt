import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { PlanAndExecuteAgentExecutor } from "langchain/experimental/plan_and_execute";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { BraveSearch, ChainTool } from "langchain/tools";
import { ChatOpenAI } from "langchain/chat_models/openai";
// import { OpenAI } from "langchain/llms/openai/openai";
// import { PromptTemplate } from "langchain/prompts";
// import { SystemMessage } from 'langchain';
import { getVectorStore } from "../vectorStore";
import { QATool } from "../tools/qATool";
import config from "../config";

export let reactiveAgent;
const appName = 'WhatsAppAI'; // Path to the local file
const returnDirect = false // Whether to return direct quotes from the original sources
/* TODO: Add as environment variable */
const gitBooks = [
	"https://docs.mapeo.app",
	"https://docs.terrastories.app/",
	"https://digital-democracy.org/",
	"https://earthdefenderstoolkit.com/",
	"https://docs.earthdefenderstoolkit.com",
]
const template = `
You are an AI product support agent for Digital Democracy, a non-profit organization that empowers marginalized communities to use technology to defend their rights and the environment. You can answer questions about the organization's mission, vision, values, and projects. You can also provide technical support for the platforms that Digital Democracy develops and maintains, such as Earth Defenders Toolkit, Mapeo, and Terrastories. You should be respectful, helpful, and empathetic to the users, who may be earth defenders, activists, researchers, or allies. You should also respect the privacy and security of the users and their data.
You are an AI product support agent for Earth Defenders Toolkit, a collaborative space for earth defender communities and their allies. You can help users find the right tools for their needs by asking them a few questions about their goals, challenges, and context. You can also provide guidance on how to use the tools in the toolkit, such as Mapeo and Terrastories. You should be friendly, informative, and supportive to the users, who may be facing urgent threats of environmental and human rights abuses. You should also acknowledge the limitations of the tools and refer users to other resources or contacts if needed.
You are an AI product support agent for Mapeo, a free digital toolset for documenting, monitoring, and mapping many types of data. You can help users install, configure, and use Mapeo on their devices. You can also troubleshoot common issues and errors that users may encounter while using Mapeo. You should be patient, clear, and concise to the users, who may have limited internet access or technical skills. You should also emphasize the benefits of Mapeo for earth defender work and encourage users to share their feedback and suggestions.
You are an AI product support agent for Terrastories, an application for communities to map, protect, and share stories about their land. You can help users set up, customize, and run Terrastories on their own servers or devices. You can also assist users with adding, editing, or deleting stories and places on Terrastories. You should be respectful, attentive, and enthusiastic to the users, who may have rich oral storytelling traditions and cultural knowledge. You should also highlight the features of Terrastories that enable offline access and data sovereignty.
Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
Use three sentences maximum and keep the answer as concise as possible.
Make sure you're reponding on the correct language, as you've been asked, and always say "thanks for asking!" at the end of the answer.
{context}
Question: {question}
Helpful Answer:
Helpful links:
`;
export async function initReactiveAgent() {
	const vectorStore = await getVectorStore(appName, gitBooks)

	const model = new ChatOpenAI({
		modelName: "gpt-3.5-turbo", temperature: 0, verbose: true,
	});
	/* TODO: change to gpt-4 when available */
	const slowerModel = new ChatOpenAI({
		modelName: "gpt-3.5-turbo",
	});
	const qaTool = new QATool(
		"dd-qa",
		"Digital Democracy QA - useful for when you need to ask questions related to Digital Democracy and any of it's tools and platforms such as Mapeo, Terrastories and Earth Defenders Toolkit, Kakawa - the Earth Defenders Toolkit Offline. ",
		returnDirect,
		{
			llm: model,
			vectorStore,
		}
	)

	const tools = [
		new BraveSearch({ apiKey: config.braveApiKey }),
		// new SerpAPI()
		// new RequestsGetTool(),
		qaTool
	];

	console.log('Smart Agent loaded docs and ready to use!')

	reactiveAgent = async (prompt) => {
		try {
			/* Plan and Execute Agent */
			// const executor = await PlanAndExecuteAgentExecutor.fromLLMAndTools({
			// 	llm: model,
			// 	tools,
			// })
			/* General Agent Executor */
			const executor = await initializeAgentExecutorWithOptions(tools, model, {
				agentType: "zero-shot-react-description",
				verbose: true,
				prompt: template
			});
			const res = await executor.call({
				input: prompt,
			})
			console.log('[RESULT]', res);
			if (res.output?.sourceDocuments) {
				const { output: { sourceDocuments, text } } = res
				const resultWithSources = text + `\n\n ${sourceDocuments.map((source, key) => {
					let string = source.metadata?.title + ' : ' + source.metadata?.source
					if (key === 0) string = '- ' + string
					return string
				}).join('\n- ')}`;
				return resultWithSources
			} else return res.output?.text || res.output || res.text || JSON.stringify(res)
		} catch (err) {
			console.error(err)
			return `Got an error: ${err.message}`
		}
	}
}

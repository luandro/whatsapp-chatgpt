import fs from "fs";
import path from "path";
import os from "os";
import { GitbookLoader } from "langchain/document_loaders/web/gitbook";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { CohereEmbeddings } from "@langchain/cohere";
import { VoyageEmbeddings } from "langchain/embeddings/voyage";

// import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";

const configDir = path.join(os.homedir(), ".config");

// Function to check if a file is less than x days old
function checkIfFileHasMoreThanXStringOccurrences(filePath, targetString = "{", countThreshold = 1) {
    // Read the file content
    const fileContent = fs.readFileSync(filePath, "utf-8");
    // Get the number of occurrences of the target string
    const occurrences = (fileContent.match(new RegExp(targetString, "g")) || []).length;
    // Check if the number of occurrences exceeds the threshold
    return occurrences > countThreshold;
}
function isUpToDate(filePath, xDays) {
    try {
        if (!checkIfFileHasMoreThanXStringOccurrences(filePath)) return false;
        const fileStats = fs.statSync(filePath);
        const fileModifiedDate = fileStats.mtime;
        const currentDate = new Date();
        const timeDifference = currentDate - fileModifiedDate;
        const daysDifference = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
        return daysDifference < xDays;
    } catch (e) {
        console.error(e);
    }
}
async function getGitBook(url): Promise<void> {
    const loader = new GitbookLoader(url, {
        shouldLoadAllPaths: true
    });
    return loader.load();
}
// Function to fetch the file and save it locally
async function fetchAndSaveFile(gitBooks, filePath) {
    try {
        let documents = [];
        if (typeof gitBooks === 'string') {
            console.log("\nReading book", gitBooks);
            const doc = await getGitBook(gitBooks);
            if (doc) {
                documents.push(...doc);
            }
        } else {
            for await (const book of gitBooks) {
                console.log("\nReading book", book);
                const doc = await getGitBook(book);
                if (doc) {
                    documents.push(...doc);
                }
            }
        }
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 0
        });
        const splitDocs = await textSplitter.splitDocuments(documents);
        const serializedVectorDocuments = JSON.stringify(splitDocs);
        // Save the serialized vector store to a file or database
        fs.writeFileSync(filePath, serializedVectorDocuments);
        console.log("File fetched and saved successfully!");
        return splitDocs;
    } catch (error) {
        console.error("Error fetching or saving the file:", error);
    }
}
function createFileSync(filePath) {
    const folderPath = path.dirname(filePath);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, "", { flag: "w" });
    }
}
const voyageEmbedding = new VoyageEmbeddings({
    apiKey: "pa-OjgM2HQtL2H-IdDMTxE6Z_CWZKvrObptrRQZoySGm-0", // In Node.js defaults to process.env.VOYAGEAI_API_KEY
    modelName: 'voyage-lite-02-instruct'
});
const cohereEmbedding = new CohereEmbeddings({
    apiKey: "mOn1UgVNwi97PHIAyaqyRCQJ5TKDcbCWgtQew6fb", // In Node.js defaults to process.env.COHERE_API_KEY
    batchSize: 96, // Default value if omitted is 48. Max value is 96
})
const getVectorStore = async (appName, gitBooks, xDays = 7) => {
    const storedDocsPath = path.join(configDir, appName, "storedDocs.json");
    const filePath = path.join(configDir, appName, "gitbooks.db");

    // Ensure the file for storing documents exists
    createFileSync(storedDocsPath);
    // Ensure the file for storing the vector store exists
    createFileSync(filePath);

    // Read the stored documents if they exist
    let previousDocuments = [];
    if (fs.existsSync(storedDocsPath)) {
        const serializedStoredDocs = fs.readFileSync(storedDocsPath, "utf8");
        try {
            previousDocuments = JSON.parse(serializedStoredDocs);
        } catch (error) {
            if (error instanceof SyntaxError && error.message.includes("Unexpected end of JSON input")) {
                console.warn("Warning: Stored documents file was empty. Initializing previousDocuments as an empty array.");
                previousDocuments = [];
            } else {
                throw error; // Re-throw the error if it is not the expected SyntaxError
            }
        }
    }

    // Function to determine if the documents have changed
    function hasDocumentsChanged(newDocuments, oldDocuments) {
        const newDocsString = JSON.stringify(newDocuments.sort());
        const oldDocsString = JSON.stringify(oldDocuments.sort());
        return newDocsString !== oldDocsString;
    }


    // Check if the vector store is up to date and if the documents have changed
    let vectorStore;
    if (isUpToDate(filePath, xDays) && !hasDocumentsChanged(gitBooks, previousDocuments)) {
        console.log("File is less than", xDays, "days old and documents have not changed. No need to fetch again.");
        const serializedVectorDocuments = fs.readFileSync(filePath, "utf8");
        // Deserialize the vector store
        const deserializedVectorDocuments = JSON.parse(serializedVectorDocuments);
        // Create a new instance of HNSWLib and load the deserialized vector store
        vectorStore = await HNSWLib.fromDocuments(deserializedVectorDocuments, voyageEmbedding);
    } else {
        // Fetch, save, and serialize the new documents
        const vectorDocuments = await fetchAndSaveFile(gitBooks, filePath);
        fs.writeFileSync(storedDocsPath, JSON.stringify(gitBooks));
        // Create a new instance of HNSWLib from the fetched documents
        vectorStore = await HNSWLib.fromDocuments(vectorDocuments, voyageEmbedding);
    }
    return vectorStore;
}

export { getVectorStore };

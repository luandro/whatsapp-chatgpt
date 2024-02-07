import { handleMessageRag } from "./src/handlers/rag";
import fs from 'fs'
import openai from 'openai'
let results = []

let logMessageWithReply = {
  reply: (message: string) => {
    console.log('[TEST RESULT]')
    console.log(message);
    results.push({ answer: message })
  },
  from: 'Test Suite'
};
async function runTest() {
  const kakawaQuestions = [
    "How can I check the device name using the administrator interface?",
    "Is it possible to manage running services on the EDT Offline device?",
    "Can I install EDT Offline on any computer?",
    "What are the basic technical skills needed to set up EDT Offline?",
    "How does the Earth Defenders Toolkit support data sovereignty?",
    "What applications are bundled with the Offline Toolkit?",
    "What is the purpose of the Mapeo Data Hub?",
    "Can I access the internet through the Offline Toolkit's WiFi hotspot?",
    "Is there a feature for automatic language translation in the Offline Toolkit?",
    "Does the Offline Toolkit provide a built-in VPN service?",
    "Can I use the Offline Toolkit to directly edit the Earth Defenders Toolkit Cloud?"
  ];

  const mapeoQuestions = [
    "How to use Mapeo's tracks feature?",
    "Does Mapeo support real-time collaboration between devices?",
    "Can I use Mapeo to track animal migration patterns?",
    "Is there a feature in Mapeo for automatic synchronization without Wi-Fi?",
    "Can Mapeo be used to measure the carbon stock in forests?",
    "Does Mapeo offer a feature to predict deforestation trends?",
    "Is it possible to integrate Mapeo with external GIS software for advanced spatial analysis?",
    "Can Mapeo generate real-time alerts for illegal logging activities detected in satellite imagery?",
    "How can I contribute to the translation of Mapeo into my local language?",
    "What should I do if I encounter an error while synchronizing data in Mapeo?",
    "Are there any resources available for training new users on how to use Mapeo effectively?",
    "Can Mapeo be used for monitoring wildlife and biodiversity in addition to land defense?",
    "How does Mapeo ensure the security and privacy of sensitive data collected by communities?",
    "Is it possible to customize the Mapeo interface to reflect our community's data collection needs?",
    "What steps should I take to set up a local Wi-Fi network for offline Mapeo synchronization?",
    "How can I export data from Mapeo to other formats for reporting or further analysis?",
    "Can Mapeo be integrated with other tools or platforms for a more comprehensive monitoring system?",
    "What are the limitations of Mapeo that I should be aware of before starting a project?",
    "Does Mapeo support augmented reality for visualizing geographic data in the field?",
    "Can Mapeo interface with satellite systems for real-time weather updates?",
    "Is there a built-in functionality for 3D terrain mapping in Mapeo?",
    "Does Mapeo provide predictive analytics for environmental changes using AI?",
    "Can Mapeo automatically detect and alert users about nearby endangered species?",
    "Is there a feature in Mapeo that allows voice commands for hands-free operation?",
    "Does Mapeo offer a virtual reality mode for immersive exploration of mapped areas?",
    "Can Mapeo integrate with drones for automated mapping and data collection?",
    "Is there a community-driven feature suggestion and voting system within Mapeo?",
    "Does Mapeo have a gamification system to engage younger community members in mapping activities?",
    "Can Mapeo create holographic displays of maps for community meetings?",
    "Is there an option in Mapeo for underwater mapping with sonar technology?",
    "Does Mapeo support the creation of digital twins for monitored ecosystems?",
    "Can Mapeo be used to simulate environmental impacts of proposed projects in real-time?",
    "Is there a feature for automatic translation of indigenous languages in Mapeo?"
  ]
  const terrastoriesQuestions = []

  // const questions = [...kakawaQuestions, ...mapeoQuestions, ...terrastoriesQuestions]
  const questions = [mapeoQuestions[0]]

  for (const question of questions) {
    await handleMessageRag(logMessageWithReply, question);
  }
  for (const [index, question] of questions.entries()) {
    results[index] = {
      ...results[index],
      question,
      precisionScore: 0,
      expectedResult: ''
    };
    await handleMessageRag(logMessageWithReply, question);
  }
  const resultFilePath = './test-results.json';
  fs.writeFileSync(resultFilePath, JSON.stringify(results, null, 2));
  console.log('[TESTS FINALIZED] Results saved to ' + resultFilePath);
}
runTest();

import { generateText } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

export async function POST(request: Request) {
  const { type, role, level, techstack, amount, userid } = await request.json();

  try {
    let questionsArray: string[];

    try {
      const { text: questions } = await generateText({
        model: google("gemini-2.0-flash-001"),
        prompt: `Prepare questions for a job interview.
          The job role is ${role}.
          The job experience level is ${level}.
          The tech stack used in the job is: ${techstack}.
          The focus between behavioural and technical questions should lean towards: ${type}.
          The amount of questions required is: ${amount}.
          Please return only the questions, without any additional text.
          The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
          Return the questions formatted like this:
          ["Question 1", "Question 2", "Question 3"]
          
          Thank you! <3
      `,
      });
      questionsArray = JSON.parse(questions);
    } catch (aiError) {
      console.log("AI generation failed, using local fallback. Error:", aiError);
      questionsArray = generateLocalQuestions(role, type, level, techstack, Number(amount) || 5);
    }

    const interview = {
      role: role,
      type: type,
      level: level,
      techstack: techstack.split(","),
      questions: questionsArray,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    const docRef = await db.collection("interviews").add(interview);

    return Response.json({ success: true, interviewId: docRef.id }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return Response.json({ success: false, error: error }, { status: 500 });
  }
}

function generateLocalQuestions(role: string, type: string, level: string, techstack: string, amount: number): string[] {
  const technicalQs: Record<string, string[]> = {
    default: [
      `Can you explain your experience with ${techstack || "the technologies listed"} and how you have used them in past projects?`,
      `What is your approach to debugging a complex issue in a ${role} project?`,
      `How do you ensure code quality and maintainability in your work?`,
      `Describe a challenging technical problem you solved recently and walk me through your approach.`,
      `How do you stay updated with the latest trends and best practices in your field?`,
      `What design patterns or architectural approaches have you used in your previous roles?`,
      `How would you handle a situation where you need to learn a new technology quickly for a project?`,
      `Can you explain the difference between SQL and NoSQL databases and when you would use each?`,
      `What is your experience with version control systems and how do you handle merge conflicts?`,
      `How do you approach writing tests for your code?`,
    ],
  };

  const behavioralQs = [
    "Tell me about yourself and what motivated you to apply for this role.",
    "Describe a time when you had to work under pressure to meet a deadline. How did you handle it?",
    "Can you share an example of a conflict with a team member and how you resolved it?",
    "Tell me about a project you are most proud of and why.",
    "How do you prioritize tasks when you have multiple deadlines?",
    "Describe a situation where you received critical feedback. How did you respond?",
    "What is your approach to mentoring junior team members?",
    "Tell me about a time you failed at something. What did you learn?",
    "How do you handle ambiguity or unclear requirements in a project?",
    "Where do you see yourself growing in the next few years?",
  ];

  let pool: string[];
  if (/technical/i.test(type)) {
    pool = technicalQs.default;
  } else if (/behavioral/i.test(type) || /behavioural/i.test(type)) {
    pool = behavioralQs;
  } else {
    pool = [...technicalQs.default.slice(0, 5), ...behavioralQs.slice(0, 5)];
  }

  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(amount, shuffled.length));
}

export async function GET() {
  return Response.json({ success: true, data: "Thank you!" }, { status: 200 });
}

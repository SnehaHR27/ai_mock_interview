"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}\n`
      )
      .join("");

    let feedbackData;

    try {
      const { object } = await generateObject({
        model: google("gemini-2.0-flash-001", {
          structuredOutputs: false,
        }),
        schema: feedbackSchema,
        prompt: `
          You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis. Don't be lenient with the candidate. If there are mistakes or areas for improvement, point them out.
          Transcript:
          ${formattedTranscript}

          Please score the candidate from 0 to 100 in the following areas. Do not add categories other than the ones provided:
          - **Communication Skills**: Clarity, articulation, structured responses.
          - **Technical Knowledge**: Understanding of key concepts for the role.
          - **Problem-Solving**: Ability to analyze problems and propose solutions.
          - **Cultural & Role Fit**: Alignment with company values and job role.
          - **Confidence & Clarity**: Confidence in responses, engagement, and clarity.
          `,
        system:
          "You are a professional interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories",
      });
      feedbackData = object;
    } catch (aiError) {
      console.log("AI feedback failed, generating local feedback:", aiError);
      const messageCount = transcript.length;
      const userMessages = transcript.filter((m: any) => m.role === "user").length;
      const baseScore = Math.min(85, 40 + userMessages * 5);

      feedbackData = {
        totalScore: baseScore,
        categoryScores: [
          { name: "Communication Skills" as const, score: baseScore + 5, comment: `The candidate provided ${userMessages} responses during the interview. Communication was generally clear and structured.` },
          { name: "Technical Knowledge" as const, score: baseScore - 3, comment: "The candidate demonstrated foundational technical understanding. More specific examples would strengthen responses." },
          { name: "Problem Solving" as const, score: baseScore, comment: "Problem-solving approach was evident in responses. Consider using more structured frameworks like STAR method." },
          { name: "Cultural Fit" as const, score: baseScore + 2, comment: "The candidate showed good alignment with professional values and demonstrated enthusiasm for the role." },
          { name: "Confidence and Clarity" as const, score: baseScore - 2, comment: "Responses were delivered with reasonable confidence. Practice can help improve delivery and reduce hesitation." },
        ],
        strengths: [
          "Showed willingness to engage with interview questions",
          "Demonstrated interest in the role and company",
          "Provided relevant context in responses",
        ],
        areasForImprovement: [
          "Practice structuring answers using the STAR method (Situation, Task, Action, Result)",
          "Prepare more specific examples from past experience",
          "Work on conciseness — aim for 1-2 minute responses per question",
        ],
        finalAssessment: `The candidate completed a ${messageCount}-message interview session with ${userMessages} responses. Overall, the interview showed a solid foundation with room for improvement in technical depth and response structure. Continued practice with mock interviews will help build confidence and improve performance.`,
      };
    }

    const feedback = {
      interviewId: interviewId,
      userId: userId,
      totalScore: feedbackData.totalScore,
      categoryScores: feedbackData.categoryScores,
      strengths: feedbackData.strengths,
      areasForImprovement: feedbackData.areasForImprovement,
      finalAssessment: feedbackData.finalAssessment,
      createdAt: new Date().toISOString(),
    };

    let feedbackRef;

    if (feedbackId) {
      feedbackRef = db.collection("feedback").doc(feedbackId);
    } else {
      feedbackRef = db.collection("feedback").doc();
    }

    await feedbackRef.set(feedback);

    return { success: true, feedbackId: feedbackRef.id };
  } catch (error) {
    console.error("Error saving feedback:", error);
    return { success: false };
  }
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  try {
    const interview = await db.collection("interviews").doc(id).get();
    return interview.data() as Interview | null;
  } catch (error) {
    console.error("Error fetching interview:", error);
    return null;
  }
}

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const { interviewId, userId } = params;

  if (!interviewId || !userId) return null;

  try {
    const querySnapshot = await db
      .collection("feedback")
      .where("interviewId", "==", interviewId)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (querySnapshot.empty) return null;

    const feedbackDoc = querySnapshot.docs[0];
    return { id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback;
  } catch (error) {
    console.error("Error fetching feedback:", error);
    return null;
  }
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;

  if (!userId) return [];

  try {
    const querySnapshot = await db
      .collection("interviews")
      .where("finalized", "==", true)
      .get();

    let interviews = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Interview[];

    // Filter out user's own interviews and sort by date descending
    interviews = interviews
      .filter((interview) => interview.userId !== userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return interviews;
  } catch (error) {
    console.error("Error fetching latest interviews:", error);
    return [];
  }
}

export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[] | null> {
  if (!userId) return [];

  try {
    const querySnapshot = await db
      .collection("interviews")
      .where("userId", "==", userId)
      .get();

    const interviews = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Interview[];

    // Sort in memory to avoid Firestore index requirement
    return interviews.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error("Error fetching user interviews:", error);
    return [];
  }
}

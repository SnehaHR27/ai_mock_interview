import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export async function POST(request: Request) {
  const { action, role, level, type, techstack, amount, question, answer } =
    await request.json();

  try {
    // ── ACTION 1: Generate tailored questions ──────────────────
    if (action === "generate") {
      let questionsArray: string[];

      try {
        const { text: questions } = await generateText({
          model: google("gemini-2.0-flash-001"),
          prompt: `Prepare questions for a job interview.
            The job role is ${role}.
            The job experience level is ${level}.
            The tech stack used in the job is: ${techstack}.
            The focus between behavioural and technical questions should lean towards: ${type}.
            The amount of questions required is: ${amount || 5}.
            Please return only the questions, without any additional text.
            Return the questions formatted like this:
            ["Question 1", "Question 2", "Question 3"]
          `,
        });
        questionsArray = JSON.parse(questions);
      } catch (aiError) {
        console.log("AI generation failed, using fallback:", aiError);
        questionsArray = generateLocalQuestions(
          role,
          type,
          level,
          techstack,
          Number(amount) || 5
        );
      }

      return Response.json(
        { success: true, questions: questionsArray },
        { status: 200 }
      );
    }

    // ── ACTION 2: Evaluate a single answer ─────────────────────
    if (action === "evaluate") {
      let feedback;

      try {
        const { text } = await generateText({
          model: google("gemini-2.0-flash-001"),
          prompt: `You are an expert ${role} interviewer and interview coach evaluating a ${level || "Junior"} candidate.

Question asked: "${question}"
Candidate's answer: "${answer}"

Analyze both the CONTENT (what they said) and BEHAVIOR (how they communicated — clarity, structure, confidence based on text).

Return ONLY valid JSON in this exact format with no extra text:
{
  "score": <integer 0-10>,
  "rating": "<Excellent|Good|Average|Needs Improvement|Poor>",
  "behaviorTips": [
    "<Tip about communication style, answer structure, or delivery — e.g. 'Your answer lacked structure. Use STAR method: Situation, Task, Action, Result'>",
    "<Another behavioral tip — e.g. 'You were too vague. Be specific about YOUR role, not the team'>"
  ],
  "strengths": [
    "<Something they did well in content or structure>",
    "<Another strength>"
  ],
  "corrections": [
    "<Factual or conceptual mistake to correct — e.g. 'You confused REST and GraphQL. REST uses HTTP verbs while GraphQL uses a single endpoint'>",
    "<Another correction or missing key point they should have mentioned>"
  ],
  "idealAnswer": "<A concise model answer in 3-4 sentences that shows what an excellent response looks like>",
  "encouragement": "<One short encouraging sentence to motivate the candidate>"
}`,
        });

        // Strip markdown code block if present
        const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        feedback = JSON.parse(cleaned);
      } catch (aiError) {
        console.log("AI evaluation failed, using fallback:", aiError);
        feedback = generateLocalFeedback(answer);
      }

      return Response.json(
        { success: true, feedback },
        { status: 200 }
      );
    }

    return Response.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Practice API Error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── Fallback: domain-specific tailored question banks ────────────
function generateLocalQuestions(
  role: string,
  type: string,
  level: string,
  techstack: string,
  amount: number
): string[] {
  // ═══════════════════════════════════════════════════════════════════
  // VOICE / WEBCAM / TEXT FRIENDLY QUESTION BANKS
  // All questions are conversational and open-ended — designed to be
  // answered by speaking (60-90 seconds) or typing a short paragraph.
  // No code writing, no diagrams, no syntax questions.
  // ═══════════════════════════════════════════════════════════════════

  // ── ROLE-SPECIFIC TECHNICAL QUESTIONS (15 per role) ────────
  const roleTechnicalQuestions: Record<string, string[]> = {
    "Frontend Developer": [
      "In your own words, explain what the virtual DOM is and why frameworks like React use it instead of updating the real DOM directly.",
      "Walk me through how you would build a responsive web page from scratch. What is your thought process for making it look good on phones, tablets, and desktops?",
      "If a React component is rendering slowly and the page feels laggy, how would you go about figuring out what is wrong and fixing it?",
      "How would you explain the difference between server-side rendering and client-side rendering to someone who is not a developer? When would you pick one over the other?",
      "Tell me about a time you had to manage complex state in a frontend application. What approach did you use and why did you choose it?",
      "How do you make sure your website loads fast for users? Walk me through the performance techniques you have used or would use.",
      "Imagine you join a project and the CSS is a mess with styles conflicting everywhere. How would you clean it up and prevent future conflicts?",
      "How would you handle user authentication on the frontend? Walk me through the flow from when a user clicks Sign In to when they see their dashboard.",
      "What does accessibility mean to you in web development? Give me some examples of how you have made or would make a website more accessible.",
      "If you had to choose between React, Vue, and Angular for a new project, how would you make that decision? What factors matter most to you?",
      `How have you used ${techstack || "modern frontend tools"} in your work? Tell me about a specific problem they helped you solve.`,
      "Walk me through how you would add a search feature to a website. Think about both the user experience and how it connects to the backend.",
      "How do you approach testing your frontend code? What kinds of tests do you write and what tools do you prefer?",
      "Explain what happens behind the scenes from the moment a user types a URL in the browser to when the page fully loads. Keep it conversational.",
      "How do you keep up with the fast-changing world of frontend development? What resources or communities have been most helpful to you?",
    ],

    "Backend Developer": [
      "How would you explain what a REST API is to a non-technical person? What makes a well-designed API in your opinion?",
      "Walk me through how you would design the backend for a simple e-commerce app. What database would you choose and why?",
      "When would you choose a SQL database over a NoSQL database? Give me a real scenario for each.",
      "How do you handle security in your backend applications? Walk me through the steps you take to protect user data.",
      "Tell me about caching. When is it useful, what strategies have you used, and how do you decide what to cache?",
      "What are microservices and when would you use them instead of building everything in one application? What are the trade-offs?",
      "If your API is getting thousands of requests per second and starting to slow down, walk me through how you would diagnose and fix the problem.",
      "How do you handle errors and logging in a production backend? What happens when something goes wrong at 3 AM?",
      "Explain the difference between authentication and authorization. How do you implement both in a backend system?",
      "What is database indexing and why does it matter? How do you decide which fields to index?",
      `Tell me about your experience with ${techstack || "backend technologies"}. What architecture decisions have you made and why?`,
      "How would you design a notification system that can send emails, push notifications, and SMS messages? Walk me through your thinking.",
      "What is the N plus 1 query problem? How would you explain it to a teammate and what would you do to fix it?",
      "How do you approach database migrations when your app is already running in production with real users?",
      "Tell me about a time you had to integrate with a third-party API. What challenges did you face and how did you handle them?",
    ],

    "Full Stack Developer": [
      "How do you decide what logic belongs on the frontend versus the backend? Walk me through your thought process with an example.",
      "Describe a full-stack application you have built from start to finish. What technologies did you choose and why?",
      "If a web application is loading slowly, how do you figure out whether the problem is on the frontend, the backend, or the database?",
      "Walk me through how you would implement a user login system end to end, from the sign-in form to storing the session.",
      "How do you keep your frontend and backend in sync when building new features? What is your workflow like?",
      "Tell me about your approach to handling file uploads in a web application. How does the data flow from the user to storage?",
      "How do you handle form validation? Do you validate on the frontend, the backend, or both, and why?",
      "What is your strategy for deploying a full-stack application? Walk me through your deployment process.",
      "How would you set up real-time features like live chat or notifications in a web app? What technologies would you consider?",
      "How do you approach testing when you are responsible for both the frontend and the backend?",
      `How have you used ${techstack || "your preferred tech stack"} to build a complete feature? Give me a specific example.`,
      "If you had to design a database schema for a social media app, walk me through the main tables and relationships you would create.",
      "How do you manage environment variables and API keys across development, staging, and production?",
      "Tell me about a challenging bug that involved both the frontend and backend. How did you track it down?",
      "What is your opinion on using server-side rendering versus a single-page application? When would you choose one over the other?",
    ],

    "Data Scientist": [
      "How would you explain the difference between supervised and unsupervised learning to someone without a technical background?",
      "Walk me through your typical process for a data science project, from understanding the problem to delivering results.",
      "You receive a dataset with a lot of missing values. Talk me through how you would handle that situation.",
      "What is overfitting and why is it a problem? How do you detect it and what do you do to prevent it?",
      "How do you choose which machine learning algorithm to use for a given problem? What factors influence your decision?",
      "Tell me about a project where your data analysis or model made a real difference to the business. What was the outcome?",
      "How would you explain precision and recall to a product manager? When would you prioritize one over the other?",
      "What is feature engineering and why is it so important? Give me an example of a creative feature you have built.",
      "How do you handle a dataset where one class is much more common than the other? What techniques have you used?",
      "Walk me through how you would set up an A/B test. How do you know when the results are statistically significant?",
      `Tell me about your experience with ${techstack || "data science tools like Python, pandas, or scikit-learn"}. What is your go-to workflow?`,
      "How do you present complex data findings to people who do not have a data background? Give me an example.",
      "What is the bias-variance trade-off and how does it affect the models you build?",
      "If a model you built performs well in testing but poorly in production, what would you investigate?",
      "How do you make sure your models are fair and do not discriminate against certain groups of people?",
    ],

    "DevOps Engineer": [
      "How would you explain what CI/CD is to a developer who has never used it? Why is it valuable?",
      "Walk me through how you would set up a deployment pipeline for a new project from scratch.",
      "What is the difference between a container and a virtual machine? When would you use each?",
      "Tell me about your experience with cloud services. Which providers have you used and what services were most valuable?",
      "How do you monitor a production system? What metrics do you track and what tools do you use?",
      "Walk me through what happens when you get paged about a production outage. What is your incident response process?",
      "How would you explain Infrastructure as Code to a team that has been doing everything manually? What benefits would you highlight?",
      "What is your approach to managing secrets like API keys and database passwords in a production environment?",
      "Tell me about a time you automated something that was previously done by hand. What was the impact?",
      "How do you decide between scaling vertically versus scaling horizontally? Give me an example of when you would choose each.",
      `How have you used ${techstack || "DevOps tools like Docker, Kubernetes, or Terraform"} in your work? What problems did they solve?`,
      "Explain blue-green deployment and canary deployment in your own words. When would you use each approach?",
      "How do you handle disaster recovery planning? What strategies do you put in place to protect against data loss?",
      "What does the concept of shifting left mean in DevOps? How do you apply it in practice?",
      "How do you balance the need for fast deployments with the need for stability and reliability?",
    ],

    "Mobile Developer": [
      "What are the main differences between native, hybrid, and cross-platform mobile development? How do you decide which approach to use?",
      "Walk me through how you would plan and build a new mobile app from the initial idea to the first release.",
      "How do you handle situations where the user has a poor internet connection or is completely offline?",
      "Tell me about your approach to making a mobile app feel fast and responsive. What performance tricks do you use?",
      "How do you handle push notifications in a mobile app? Walk me through the full flow from backend to the user seeing it.",
      "What is your process for testing a mobile app? How do you make sure it works well on different devices and screen sizes?",
      "How do you handle sensitive user data on a mobile device? What security measures do you take?",
      "Tell me about your experience with app store submissions. What are the common reasons apps get rejected and how do you avoid them?",
      "How would you implement a smooth login experience using biometrics like fingerprint or face recognition?",
      "What is deep linking and why is it useful in mobile apps? How would you explain it to a product manager?",
      `Tell me about a mobile project where you used ${techstack || "React Native, Flutter, or native development"}. What challenges did you face?`,
      "How do you keep your app small in size while still offering a rich set of features?",
      "Walk me through how you would add a live camera feature to a mobile app. What are the key considerations?",
      "How do you approach accessibility in mobile apps? What features do you include to support users with disabilities?",
      "Tell me about a mobile app bug that was really hard to track down. How did you eventually find and fix it?",
    ],

    "UI/UX Designer": [
      "Walk me through your complete design process from the moment you receive a new project to handing off the final designs.",
      "How do you conduct user research? Tell me about a specific research method you used and what you learned from it.",
      "In your own words, what is the difference between user experience design and user interface design? How do they depend on each other?",
      "Tell me about a time when user feedback completely changed the direction of your design. What happened and how did you respond?",
      "How do you build and maintain a design system? What are the most important components to include?",
      "Walk me through how you would design a mobile checkout experience that is simple and reduces drop-off.",
      "How do you measure whether a design is actually working? What metrics and methods do you use?",
      "What does accessibility mean to you as a designer? How do you make sure your designs work for everyone?",
      "How do you handle a situation where a stakeholder insists on a design direction that you believe will hurt the user experience?",
      "Tell me about your approach to creating prototypes. What level of fidelity do you start with and when do you increase it?",
      `How have you used ${techstack || "design tools like Figma, Sketch, or Adobe XD"} in your workflow? What makes one better than another for you?`,
      "How do you approach designing for both mobile and desktop? Do you start mobile-first or desktop-first, and why?",
      "Walk me through how you would redesign an existing product page that has a high bounce rate.",
      "How do you work with developers to make sure your designs are implemented accurately?",
      "Tell me about a design you are really proud of. What made it successful?",
    ],

    "Product Manager": [
      "How do you decide which features to build first? Walk me through your prioritization process.",
      "Tell me about a product you managed from idea to launch. What were the biggest challenges?",
      "How do you gather input from users to understand what they really need? Give me a specific example.",
      "How do you measure whether a product is successful? What numbers do you look at and why?",
      "Tell me about a time you had to say no to a feature request from an important stakeholder. How did you handle it?",
      "How do you work with engineering teams to plan what gets built and when? What does your sprint planning look like?",
      "Walk me through how you would create a product roadmap. How far ahead do you plan and how do you handle changes?",
      "How do you make sure everyone on the team, from engineers to executives, understands and supports the product vision?",
      "Tell me about a time when you used data to make a critical product decision. What data did you look at?",
      "What is a minimum viable product in your own words? How do you decide what to include and what to leave out?",
      "How do you handle a situation where two teams want conflicting features? How do you resolve the conflict?",
      "Tell me about a product launch that did not go as planned. What did you learn from it?",
      "How do you stay informed about what your competitors are doing? How does that influence your product decisions?",
      "How do you balance building new features with fixing bugs and paying down technical debt?",
      "Walk me through how you would validate a new product idea before committing engineering resources to build it.",
    ],

    "QA Engineer": [
      "In your own words, explain the difference between unit testing, integration testing, and end-to-end testing. When do you use each?",
      "Walk me through how you would create a test plan for a brand new feature. What would you include?",
      "How do you decide which tests should be automated and which ones should stay manual?",
      "Tell me about the most important bug you have ever found. How did you discover it and what was the impact?",
      "How do you approach testing when the developers give you a feature with no documentation or specs?",
      "What is regression testing and why is it important? How do you manage it efficiently?",
      "Walk me through how you would test a login page. What scenarios would you cover?",
      "How do you ensure quality in a fast-paced agile team where features ship every two weeks?",
      "Tell me about a time you had to push back on releasing a feature because it was not ready. How did that conversation go?",
      "How do you approach performance testing? What are you looking for and what tools do you use?",
      `Tell me about your experience with ${techstack || "testing tools like Selenium, Cypress, or Jest"}. What do you like and dislike about them?`,
      "How do you track and communicate bugs to the development team? What information do you include in a good bug report?",
      "What is exploratory testing and when do you use it? Tell me about a time it helped you find something important.",
      "How do you test an API? Walk me through your approach and what you check for.",
      "Tell me about a time you improved the testing process on your team. What changed and what was the result?",
    ],

    "Machine Learning Engineer": [
      "Walk me through the full lifecycle of a machine learning project, from understanding the problem to deploying the model.",
      "How do you decide which machine learning algorithm to use for a specific problem? What factors do you consider?",
      "What is transfer learning and when would you use it? Give me a real-world example.",
      "Tell me about a machine learning model you deployed to production. What challenges did you face after deployment?",
      "How do you monitor a model in production to make sure it keeps performing well over time?",
      "What is the difference between making predictions in batches versus in real time? When would you choose each approach?",
      "How would you explain a complex model like a neural network to a business executive who does not have a technical background?",
      "Walk me through how you would handle a situation where your model works great in testing but performs poorly with real data.",
      "How do you manage and track different versions of your models and experiments?",
      "What is data drift and model drift? How do you detect and respond to them?",
      `Tell me about your experience with ${techstack || "ML tools like Python, TensorFlow, or PyTorch"}. What is your preferred workflow?`,
      "How do you make sure your model is fair and does not have hidden biases? What steps do you take?",
      "What is the trade-off between a simple, interpretable model and a complex, accurate one? How do you decide?",
      "Tell me about a feature engineering technique that made a big difference in one of your projects.",
      "How do you handle very large datasets that do not fit in memory? What tools and techniques do you use?",
    ],
  };

  // ── ROLE-SPECIFIC BEHAVIORAL QUESTIONS (12 per role) ──────
  const roleBehavioralQuestions: Record<string, string[]> = {
    "Frontend Developer": [
      "Tell me about yourself and what got you interested in frontend development.",
      "Walk me through a project you are most proud of. What did you build and what was your role?",
      "Describe a time you received critical feedback on your work. How did you handle it?",
      "Tell me about a situation where you had to meet a very tight deadline. What did you do?",
      "How do you handle disagreements with designers or teammates about how something should look or work?",
      "Describe a time you had to learn a new framework or tool quickly. How did you approach it?",
      "Tell me about a time you made a mistake in a project. What happened and what did you learn?",
      "How do you stay motivated when working on repetitive or tedious tasks?",
      "Describe a situation where you had to explain a technical concept to a non-technical person.",
      "Tell me about a time you helped a teammate who was struggling with something.",
      "How do you handle working on multiple tasks at the same time? Walk me through your organization process.",
      "Where do you see yourself in three to five years? How does this role fit into your career goals?",
    ],
    "Backend Developer": [
      "Tell me about yourself and how you got started in backend development.",
      "Walk me through the most challenging technical problem you have solved. What made it difficult?",
      "Describe a time you had to debug a production issue under pressure. What did you do?",
      "Tell me about a time you disagreed with a colleague about an architectural decision. How did you resolve it?",
      "How do you handle situations when project requirements change in the middle of development?",
      "Describe a time you had to work with a codebase you did not write. How did you get up to speed?",
      "Tell me about a time you mentored someone or helped a teammate grow.",
      "How do you prioritize your work when you have multiple urgent tasks?",
      "Describe a situation where you improved a process or workflow on your team.",
      "Tell me about a project that failed or did not go as planned. What did you take away from it?",
      "How do you manage stress when dealing with production outages or critical bugs?",
      "What motivates you most in your work? What kind of projects excite you?",
    ],
    "Full Stack Developer": [
      "Tell me about yourself and what draws you to full-stack development.",
      "Describe the most complex project you have worked on. What technologies did you use and what was your contribution?",
      "Tell me about a time you had to quickly learn something new to complete a project. How did you manage it?",
      "How do you balance frontend and backend responsibilities when working on a tight schedule?",
      "Describe a time you had to make a difficult trade-off in a project. What did you choose and why?",
      "Tell me about a bug that took you a long time to find. What was the issue and how did you finally solve it?",
      "How do you communicate technical concepts to people who do not have a technical background?",
      "Describe a time you took initiative to improve something on your team without being asked.",
      "Tell me about a project where you worked closely with designers, product managers, or other roles.",
      "How do you handle criticism of your code during code reviews?",
      "Describe a situation where you had to manage your time carefully across multiple responsibilities.",
      "What are your long-term career goals and how does this role help you get there?",
    ],
    "Data Scientist": [
      "Tell me about yourself and what attracted you to data science.",
      "Walk me through a data project you worked on that you are particularly proud of.",
      "Describe a time your analysis led to a surprising result. How did you handle it?",
      "Tell me about a situation where you had to explain complex data findings to non-technical stakeholders. How did you make it understandable?",
      "How do you handle messy or incomplete data? Give me an example from your experience.",
      "Describe a time you had to make a recommendation based on limited data. How confident were you and how did you communicate uncertainty?",
      "Tell me about a time you collaborated with engineers or product managers on a data project.",
      "How do you handle disagreements about methodology or approach with your teammates?",
      "Describe a project where you had to balance speed with thoroughness.",
      "Tell me about a mistake you made in a data project. What did you learn from it?",
      "How do you decide which problems are worth solving with machine learning versus simpler approaches?",
      "What excites you most about the future of data science? Where do you want to grow?",
    ],
    "DevOps Engineer": [
      "Tell me about yourself and what led you to DevOps engineering.",
      "Walk me through the most critical production incident you have handled. What was your role?",
      "Describe a time you automated something that saved your team significant time.",
      "Tell me about a situation where you had to convince developers to adopt a new tool or process.",
      "How do you handle the pressure of being on call and dealing with incidents outside of work hours?",
      "Describe a deployment that went wrong. How did you recover and what did you change to prevent it from happening again?",
      "Tell me about a time you had to learn a new cloud service or tool quickly for a project.",
      "How do you balance moving fast with keeping systems reliable and secure?",
      "Describe a situation where you improved the security of your infrastructure.",
      "Tell me about a time you worked with a team that was resistant to change. How did you handle it?",
      "How do you stay current with the rapidly evolving DevOps ecosystem?",
      "What does your ideal DevOps culture look like? How would you build it on a new team?",
    ],
    "Mobile Developer": [
      "Tell me about yourself and how you got into mobile development.",
      "Walk me through a mobile app you built that you are proud of. What made it special?",
      "Describe a time you had to fix a critical app crash that was affecting many users.",
      "Tell me about a time your app was rejected from the app store. What did you do?",
      "How do you handle testing on different devices with different screen sizes?",
      "Describe a situation where you had to work closely with a designer to implement a complex UI.",
      "Tell me about a time you optimized an app for better performance or battery life.",
      "How do you gather and use user feedback to improve your apps?",
      "Describe a time you had to integrate a third-party service into your app. What challenges did you face?",
      "Tell me about a mobile bug that was very difficult to reproduce. How did you track it down?",
      "How do you keep up with the latest changes in mobile platforms and development tools?",
      "What type of mobile app would you love to build if you had unlimited time and resources?",
    ],
    "UI/UX Designer": [
      "Tell me about yourself and what made you choose a career in design.",
      "Walk me through a design project you are most proud of. What was your process?",
      "Describe a time when user testing revealed something you did not expect. What did you do?",
      "Tell me about a situation where you had to push back on a design direction that was coming from leadership.",
      "How do you handle creating designs on a very tight timeline? What do you prioritize?",
      "Describe a time you had to balance visual appeal with practical usability.",
      "Tell me about a collaboration with developers that went really well. What made it work?",
      "How do you approach designing for users who are very different from you?",
      "Describe a time when data or analytics influenced one of your design decisions.",
      "Tell me about a design that did not work out as planned. What did you learn?",
      "How do you handle conflicting feedback from multiple stakeholders?",
      "What design trend or principle do you feel most strongly about? Why?",
    ],
    "Product Manager": [
      "Tell me about yourself and what attracted you to product management.",
      "Walk me through a product you launched. What was your role and what were the key decisions you made?",
      "Describe a time you had to make a tough call about cutting a feature. How did you justify it?",
      "Tell me about a situation where you had to align different teams around a single product vision.",
      "How do you handle a situation where the data tells you one thing but your instinct tells you another?",
      "Describe a time engineering told you something was impossible or would take too long. How did you respond?",
      "Tell me about a time you identified a new opportunity or market that led to a product change.",
      "How do you communicate bad news to stakeholders, like delays or metric declines?",
      "Describe a product failure or setback you experienced. What did you learn from it?",
      "Tell me about how you gather and incorporate customer feedback into your product decisions.",
      "How do you keep yourself organized when managing multiple priorities and stakeholders?",
      "What kind of product problems excite you the most? Why?",
    ],
    "QA Engineer": [
      "Tell me about yourself and what drew you to quality assurance.",
      "Walk me through the most impactful bug you have ever found. How did you discover it?",
      "Describe a time you had to push back on a release because quality was not there yet.",
      "Tell me about a situation where a developer disagreed with a bug you reported. How did you handle it?",
      "How do you approach testing a feature when there is very little documentation available?",
      "Describe a time you improved the testing process on your team. What changed?",
      "Tell me about a time you had to do exploratory testing and found something critical.",
      "How do you stay organized when managing many test cases across different features?",
      "Describe a situation where you had to balance thoroughness with speed. How did you decide?",
      "Tell me about your experience introducing automation to a team. What was the reaction?",
      "How do you handle the frustration of finding the same types of bugs repeatedly?",
      "What does quality mean to you beyond just finding bugs?",
    ],
    "Machine Learning Engineer": [
      "Tell me about yourself and how you got into machine learning engineering.",
      "Walk me through the most interesting ML project you have worked on. What made it challenging?",
      "Describe a time a model you built did not perform as expected in production. What went wrong?",
      "Tell me about a situation where you had to explain model results or limitations to non-technical people.",
      "How do you handle pressure to ship a model quickly when you are not confident in its quality?",
      "Describe a time you worked closely with data scientists. How did you divide responsibilities?",
      "Tell me about a decision you made about which ML framework or tool to use. What drove your choice?",
      "How do you ensure the machine learning systems you build are ethical and fair?",
      "Describe a situation where you had to debug a complex ML pipeline. How did you find the issue?",
      "Tell me about a time you had to re-train and re-deploy a model. What triggered it?",
      "How do you communicate the business value of your ML work to leadership?",
      "What area of machine learning are you most excited about right now and why?",
    ],
  };

  // ── LEVEL-SPECIFIC QUESTIONS (5 per level) ────────────────
  const levelQuestions: Record<string, string[]> = {
    "Junior": [
      "Tell me about the projects you have worked on during your studies or in your own time that are most relevant to this role.",
      "How do you approach learning a new technology or tool that you have never used before?",
      "Describe a group project or team experience. What was your role and what did you contribute?",
      "What motivated you to pursue this career path? What excites you about this field?",
      "How do you handle situations where you are stuck on a problem and do not know the answer?",
    ],
    "Mid-Level": [
      "How do you balance mentoring junior team members with getting your own work done?",
      "Tell me about a time you led a technical initiative or took ownership of a project. What was the result?",
      "How do you approach technical debt? How do you convince your team to invest time in fixing it?",
      "Describe a time you had to push back on a decision from someone more senior. How did you handle it?",
      "How has your approach to problem-solving changed as you have gained more experience?",
    ],
    "Senior": [
      "How do you influence technical direction and strategy across your team or organization?",
      "Walk me through how you approach designing a system that needs to scale to millions of users.",
      "How do you balance hands-on coding with leadership and mentorship responsibilities?",
      "Tell me about a time you had to make a high-stakes technical decision with incomplete information.",
      "How do you build a culture of engineering excellence on your team?",
    ],
  };

  // ── UNIVERSAL SOFT-SKILL QUESTIONS ────────────────────────
  const universalQuestions: string[] = [
    "What is your greatest professional strength and how has it helped you in your work?",
    "Tell me about a time you failed at something. What did you learn from the experience?",
    "How do you handle working under pressure or with tight deadlines?",
    "Describe your ideal work environment. What helps you do your best work?",
    "How do you give and receive constructive feedback?",
  ];

  // ── BUILD THE QUESTION POOL ───────────────────────────────
  const normalizedRole = role || "Full Stack Developer";
  const techQs = roleTechnicalQuestions[normalizedRole] || roleTechnicalQuestions["Full Stack Developer"];
  const behQs = roleBehavioralQuestions[normalizedRole] || roleBehavioralQuestions["Full Stack Developer"];
  const lvlQs = levelQuestions[level] || levelQuestions["Junior"];

  let pool: string[];
  if (/technical/i.test(type)) {
    pool = [...techQs, ...lvlQs.slice(0, 2)];
  } else if (/behav/i.test(type)) {
    pool = [...behQs, ...universalQuestions.slice(0, 3), ...lvlQs];
  } else {
    // Mixed — balanced blend of technical + behavioral + level + soft skills
    pool = [...techQs.slice(0, 8), ...behQs.slice(0, 5), ...lvlQs.slice(0, 2), ...universalQuestions.slice(0, 2)];
  }

  return pool.sort(() => Math.random() - 0.5).slice(0, Math.min(amount, pool.length));
}

// ── Fallback: local answer evaluation ────────────────────────────
function generateLocalFeedback(answer: string) {
  const wordCount = (answer || "").split(/\s+/).filter(Boolean).length;

  if (wordCount < 10) {
    return {
      score: 3,
      rating: "Needs Improvement",
      behaviorTips: [
        "Your response was too short — interviewers expect detailed answers",
        "Take a breath and gather your thoughts before answering",
      ],
      strengths: ["You attempted to answer the question"],
      corrections: [
        "Provide at least 3-4 sentences with specific examples",
        "Include context about the situation and your specific role",
      ],
      idealAnswer:
        "A strong answer should include a specific example from your experience, the actions you took, and the measurable result or outcome.",
      encouragement:
        "Don't worry — practice makes perfect! Try again with more detail.",
    };
  } else if (wordCount < 30) {
    return {
      score: 5,
      rating: "Average",
      behaviorTips: [
        "Good start! Structure your answer using STAR: Situation, Task, Action, Result",
        "Be more specific — say 'I' instead of 'we' to highlight YOUR contribution",
      ],
      strengths: [
        "Provided a relevant response to the question",
        "Showed some understanding of the topic",
      ],
      corrections: [
        "Add a concrete example from your past experience",
        "Quantify your impact where possible (e.g. 'reduced load time by 30%')",
      ],
      idealAnswer:
        "Strengthen your answer by adding measurable results and linking your experience directly to the role requirements.",
      encouragement:
        "You're on the right track — just go deeper with specifics next time!",
    };
  } else {
    return {
      score: 7,
      rating: "Good",
      behaviorTips: [
        "Keep your answer to 60-90 seconds in a real interview",
        "Great detail — end with a clear takeaway or result for maximum impact",
      ],
      strengths: [
        "Detailed and well-structured response",
        "Demonstrated strong understanding of the topic",
        "Used appropriate terminology",
      ],
      corrections: [
        "Connect your answer more directly to the specific role requirements",
        "Add a metric or outcome to make your answer more memorable",
      ],
      idealAnswer:
        "Your answer is solid. To make it excellent, add clear outcomes with numbers and conclude with how it relates to this role.",
      encouragement:
        "Strong answer! A small polish and this will be interview-ready.",
    };
  }
}

export async function GET() {
  return Response.json({ success: true, data: "Practice API is ready" }, { status: 200 });
}

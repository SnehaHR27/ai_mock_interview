"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const ROLES = [
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Scientist",
  "DevOps Engineer",
  "Mobile Developer",
  "UI/UX Designer",
  "Product Manager",
  "QA Engineer",
  "Machine Learning Engineer",
];

const InterviewSetupForm = ({ userName, userId }: { userName: string; userId: string }) => {
  const router = useRouter();
  const [role, setRole] = useState(ROLES[0]);
  const [level, setLevel] = useState("Junior");
  const [type, setType] = useState("Technical");
  const [techStack, setTechStack] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/vapi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          level,
          type,
          techstack: techStack || "General",
          amount: 5,
          userid: userId,
        }),
      });

      const data = await response.json();

      if (data.success && data.interviewId) {
        toast.success("Interview created! Redirecting...");
        router.push(`/interview/${data.interviewId}`);
      } else {
        toast.error("Failed to generate interview. Please try again.");
      }
    } catch (error) {
      console.error("Error generating interview:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <h3 className="text-2xl font-bold mb-6">Set Up Your Interview</h3>

      <form onSubmit={handleGenerate} className="space-y-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold">Select Job Role</label>
          <select 
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isLoading}
            className="w-full bg-dark-300 border border-dark-100 rounded-lg p-3 text-white"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold">Experience Level</label>
          <div className="flex gap-3">
            {["Junior", "Mid-Level", "Senior"].map((lbl) => (
              <button
                key={lbl}
                type="button"
                onClick={() => setLevel(lbl)}
                disabled={isLoading}
                className={`flex-1 py-2 rounded-lg border transition-all font-medium ${
                  level === lbl
                    ? "bg-primary-200 text-dark-100 border-primary-200"
                    : "bg-dark-300 border-dark-100 text-light-100 hover:border-primary-200"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold">Interview Type</label>
          <div className="flex gap-3">
            {["Technical", "Behavioral", "Mixed"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                disabled={isLoading}
                className={`flex-1 py-2 rounded-lg border transition-all font-medium ${
                  type === t
                    ? "bg-primary-200 text-dark-100 border-primary-200"
                    : "bg-dark-300 border-dark-100 text-light-100 hover:border-primary-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold">Tech Stack (comma separated)</label>
          <input 
            type="text" 
            placeholder="e.g. React, Node.js, TypeScript"
            value={techStack}
            onChange={(e) => setTechStack(e.target.value)}
            disabled={isLoading}
            className="w-full bg-dark-300 border border-dark-100 rounded-lg p-3 text-white placeholder-gray-500"
          />
        </div>

        <button 
          type="submit" 
          disabled={isLoading}
          className="btn-primary w-full"
        >
          {isLoading ? "Generating Questions..." : "Start Interview"}
        </button>
      </form>
    </div>
  );
};

export default InterviewSetupForm;

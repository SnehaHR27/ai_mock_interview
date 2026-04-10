import InterviewSetupForm from "@/components/InterviewSetupForm";
import { getCurrentUser } from "@/lib/actions/auth.action";

const Page = async () => {
  const user = await getCurrentUser();

  return (
    <>
      <h3>Start a New Interview</h3>

      <InterviewSetupForm
        userName={user?.name!}
        userId={user?.id!}
      />
    </>
  );
};

export default Page;

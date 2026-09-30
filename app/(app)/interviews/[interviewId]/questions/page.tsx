import { InterviewPage } from "@/components/interviews/interview-page";

export const metadata = { title: "Interview · Questions" };

export default function Page(props: PageProps<"/interviews/[interviewId]/questions">) {
  return <InterviewPage params={props.params} tab="questions" />;
}

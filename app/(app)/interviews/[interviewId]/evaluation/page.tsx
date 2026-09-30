import { InterviewPage } from "@/components/interviews/interview-page";

export const metadata = { title: "Interview · Evaluation" };

export default function Page(props: PageProps<"/interviews/[interviewId]/evaluation">) {
  return <InterviewPage params={props.params} tab="evaluation" />;
}

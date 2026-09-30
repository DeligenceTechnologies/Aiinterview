import { InterviewPage } from "@/components/interviews/interview-page";

export const metadata = { title: "Interview · Report" };

export default function Page(props: PageProps<"/interviews/[interviewId]/report">) {
  return <InterviewPage params={props.params} tab="report" />;
}

import { InterviewPage } from "@/components/interviews/interview-page";

export const metadata = { title: "Interview · Overview" };

export default function Page(props: PageProps<"/interviews/[interviewId]">) {
  return <InterviewPage params={props.params} tab="overview" />;
}

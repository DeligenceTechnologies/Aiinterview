import { InterviewPage } from "@/components/interviews/interview-page";

export const metadata = { title: "Interview · Transcript" };

export default function Page(props: PageProps<"/interviews/[interviewId]/transcript">) {
  return <InterviewPage params={props.params} tab="transcript" />;
}

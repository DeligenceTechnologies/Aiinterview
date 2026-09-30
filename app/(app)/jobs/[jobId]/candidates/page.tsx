import { redirect } from "next/navigation";

export default async function JobCandidatesPage(props: PageProps<"/jobs/[jobId]/candidates">) {
  const { jobId } = await props.params;
  redirect(`/interviews?jobId=${jobId}`);
}

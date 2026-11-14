import { notFound } from "next/navigation";
import InvitationTestForm from "./invitation-test-form";

export default function InvitationTestPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <InvitationTestForm />;
}
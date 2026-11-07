
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";

export type InvitationEmailProps = {
  inviterName: string;
  organizationName: string;
  role: "admin" | "member" | "viewer";
  invitationUrl: string;
};

const roleDescriptions: Record<InvitationEmailProps["role"], string> = {
  admin: "an administrator",
  member: "a member",
  viewer: "a viewer",
};

export default function InvitationEmail({
  inviterName,
  organizationName,
  role,
  invitationUrl,
}: InvitationEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {inviterName} invited you to join {organizationName} on TeamFlow.
      </Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Heading style={styles.brand}>TeamFlow</Heading>
          </Section>

          <Section style={styles.content}>
            <Heading as="h1" style={styles.heading}>
              You&apos;re invited to collaborate
            </Heading>

            <Text style={styles.paragraph}>
              {inviterName} has invited you to join{" "}
              <strong>{organizationName}</strong> on TeamFlow.
            </Text>

            <Text style={styles.paragraph}>
              You&apos;ll join the organization as {roleDescriptions[role]}.
            </Text>

            <Section style={styles.buttonSection}>
              <Button href={invitationUrl} style={styles.button}>
                Accept invitation
              </Button>
            </Section>

            <Text style={styles.expiry}>
              This invitation expires in 7 days.
            </Text>

            <Hr style={styles.divider} />

            <Text style={styles.helpText}>
              If you weren&apos;t expecting this invitation, you can safely
              ignore this email.
            </Text>

            <Text style={styles.helpText}>
              If the button doesn&apos;t work, copy and paste this link into
              your browser:
            </Text>

            <Text style={styles.url}>{invitationUrl}</Text>
          </Section>

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              TeamFlow — Work better, together.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: "#f4f6f8",
    fontFamily: "Arial, Helvetica, sans-serif",
    margin: "0",
    padding: "32px 12px",
  },
  container: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    margin: "0 auto",
    maxWidth: "560px",
    overflow: "hidden" as const,
  },
  header: {
    padding: "24px 32px",
    borderBottom: "1px solid #e5e7eb",
  },
  brand: {
    color: "#2563eb",
    fontSize: "22px",
    fontWeight: "700",
    margin: "0",
  },
  content: {
    padding: "32px",
  },
  heading: {
    color: "#111827",
    fontSize: "24px",
    fontWeight: "700",
    lineHeight: "1.35",
    margin: "0 0 20px",
  },
  paragraph: {
    color: "#4b5563",
    fontSize: "15px",
    lineHeight: "1.7",
  },
  buttonSection: {
    margin: "28px 0",
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: "6px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: "600",
    padding: "13px 22px",
    textDecoration: "none",
  },
  expiry: {
    color: "#6b7280",
    fontSize: "13px",
  },
  divider: {
    borderColor: "#e5e7eb",
    margin: "28px 0",
  },
  helpText: {
    color: "#6b7280",
    fontSize: "13px",
    lineHeight: "1.6",
  },
  url: {
    color: "#2563eb",
    fontSize: "12px",
    lineHeight: "1.6",
    wordBreak: "break-all" as const,
  },
  footer: {
    backgroundColor: "#f9fafb",
    borderTop: "1px solid #e5e7eb",
    padding: "18px 32px",
  },
  footerText: {
    color: "#9ca3af",
    fontSize: "12px",
    textAlign: "center" as const,
  },
};

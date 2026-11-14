
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

export type NotificationEmailType =
  | "task_assigned"
  | "task_unassigned"
  | "task_comment_created"
  | "task_status_changed"
  | "task_priority_changed"
  | "task_due_soon";

export type NotificationEmailProps = {
  recipientName: string;
  notificationType: NotificationEmailType;
  notificationTitle: string;
  notificationMessage: string;
  taskTitle?: string;
  appUrl: string;
};

const notificationLabels: Record<NotificationEmailType, string> = {
  task_assigned: "Task assigned",
  task_unassigned: "Task assignment updated",
  task_comment_created: "New task comment",
  task_status_changed: "Task status updated",
  task_priority_changed: "Task priority updated",
  task_due_soon: "Upcoming deadline",
};

export default function NotificationEmail({
  recipientName,
  notificationType,
  notificationTitle,
  notificationMessage,
  taskTitle,
  appUrl,
}: NotificationEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{notificationTitle}</Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Heading style={styles.brand}>TeamFlow</Heading>
          </Section>

          <Section style={styles.content}>
            <Text style={styles.eyebrow}>
              {notificationLabels[notificationType]}
            </Text>

            <Heading as="h1" style={styles.heading}>
              {notificationTitle}
            </Heading>

            <Text style={styles.greeting}>
              Hello {recipientName},
            </Text>

            <Text style={styles.paragraph}>
              {notificationMessage}
            </Text>

            {taskTitle ? (
              <Section style={styles.taskCard}>
                <Text style={styles.taskLabel}>TASK</Text>
                <Text style={styles.taskTitle}>{taskTitle}</Text>
              </Section>
            ) : null}

            <Section style={styles.buttonSection}>
              <Button href={appUrl} style={styles.button}>
                Open TeamFlow
              </Button>
            </Section>

            <Hr style={styles.divider} />

            <Text style={styles.helpText}>
              You received this email because email notifications
              are enabled in your TeamFlow account.
            </Text>

            <Text style={styles.helpText}>
              You can manage your notification preferences in
              your account settings.
            </Text>
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
  eyebrow: {
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  },
  heading: {
    color: "#111827",
    fontSize: "24px",
    fontWeight: "700",
    lineHeight: "1.35",
    margin: "12px 0 20px",
  },
  greeting: {
    color: "#374151",
    fontSize: "15px",
    lineHeight: "1.7",
  },
  paragraph: {
    color: "#4b5563",
    fontSize: "15px",
    lineHeight: "1.7",
  },
  taskCard: {
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    margin: "24px 0",
    padding: "16px",
  },
  taskLabel: {
    color: "#6b7280",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.08em",
  },
  taskTitle: {
    color: "#111827",
    fontSize: "15px",
    fontWeight: "600",
    lineHeight: "1.5",
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
  divider: {
    borderColor: "#e5e7eb",
    margin: "28px 0",
  },
  helpText: {
    color: "#6b7280",
    fontSize: "12px",
    lineHeight: "1.6",
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

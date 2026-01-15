import {
  Modal,
  Stack,
  Text,
  Divider,
  Grid,
  Badge,
  Group,
  Title,
} from "@mantine/core";

import type { Invoice } from "../interface/Invoice";

type InvoicePopupProps = {
  opened: boolean;
  onClose: () => void;
  invoice: Invoice | null;
};

export default function InvoicePopup({ opened, onClose, invoice }: InvoicePopupProps) {
  if (!invoice) return null;

  // Format date like "12 October 2025"
  const formatDate = (d?: string | Date | null) => {
    if (!d) return "-";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // ✅ Safe numeric formatter (no negatives, 2 decimals)
  const num = (v: string | number | null | undefined) => {
    const n = Number(v) || 0;
    const safe = n < 0 ? 0 : n;
    return safe.toFixed(2);
  };

  const parseGst = (v: string | number | null | undefined) => {
    if (typeof v === "number") return v;
    if (!v) return 0;
    const clean = v.replace(/[^\d.]/g, "");
    return parseFloat(clean) || 0;
  };

  // Use values from backend/database for these fields
  const totalDeduction = num(invoice.totalDeduction);
  const netPayable = num(invoice.netPayable);
  const balance = num(invoice.balance);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      title={<Title order={3}>Invoice #{invoice.invoiceNumber}</Title>}
      centered
    >
      <Stack gap="md">
        <Group justify="space-between">
          <Badge
                        color={
                          invoice.status === "Paid"
                            ? "#20c997"
                            : invoice.status === "Under process"
                            ? "#228be6"
                            : invoice.status === "Cancelled"
                            ? "#fa5252"
                            : "#FFBF00"
                        }
                      >
                        {invoice.status || "-"}
                      </Badge>
          <Badge color="gray" variant="light">
            {invoice.project || "-"}
          </Badge>
        </Group>

        <Divider label="Project Info" labelPosition="center" />

        <Grid>
          <Grid.Col span={6}>
            <Stack gap={4}>
              <Text><b>Project:</b> {invoice.project}</Text>
              <Text><b>Mode:</b> {invoice.modeOfProject}</Text>
              <Text><b>State:</b> {invoice.state}</Text>
              <Text><b>Bill Category:</b> {invoice.mybillCategory}</Text>
              <Text><b>Milestone:</b> {invoice.milestone}</Text>
            </Stack>
          </Grid.Col>

          <Grid.Col span={6}>
            <Stack gap={4}>
              <Text><b>Invoice Date:</b> {formatDate(invoice.invoiceDate)}</Text>
              <Text><b>Submission Date:</b> {formatDate(invoice.submissionDate)}</Text>
              <Text><b>Payment Date:</b> {formatDate(invoice.paymentDate)}</Text>
              <Text><b>Remarks:</b> {invoice.remarks || "-"}</Text>
            </Stack>
          </Grid.Col>
        </Grid>

        <Divider label="Amounts" labelPosition="center" />

        <Grid>
          <Grid.Col span={6}>
            <Stack gap={4}>
              <Text><b>Basic Amount:</b> ₹{num(invoice.invoiceBasicAmount)}</Text>
              <Text><b>GST %:</b> {invoice.gstPercentage}</Text>
              <Text>
                <b>GST Amount:</b> ₹
                {num(
                  (Number(num(invoice.invoiceBasicAmount)) *
                    parseGst(invoice.gstPercentage)) /
                    100
                )}
              </Text>
              <Text><b>Total Amount:</b> ₹{num(invoice.totalAmount)}</Text>
              <Text><b>Passed Amount:</b> ₹{num(invoice.passedAmountByClient)}</Text>
            </Stack>
          </Grid.Col>

          <Grid.Col span={6}>
            <Stack gap={4}>
              <Text><b>Retention:</b> ₹{num(invoice.retention)}</Text>
              <Text><b>GST Withheld:</b> ₹{num(invoice.gstWithheld)}</Text>
              <Text><b>TDS:</b> ₹{num(invoice.tds)}</Text>
              <Text><b>GST TDS:</b> ₹{num(invoice.gstTds)}</Text>
              <Text><b>BOCW:</b> ₹{num(invoice.bocw)}</Text>
              <Text><b>Low Depth Deduction:</b> ₹{num(invoice.lowDepthDeduction)}</Text>
              <Text><b>LD:</b> ₹{num(invoice.ld)}</Text>
              <Text><b>SLA Penalty:</b> ₹{num(invoice.slaPenalty)}</Text>
              <Text><b>Penalty:</b> ₹{num(invoice.penalty)}</Text>
              <Text><b>Other Deduction:</b> ₹{num(invoice.otherDeduction)}</Text>
            </Stack>
          </Grid.Col>
        </Grid>

        <Divider label="Summary" labelPosition="center" />

        <Stack gap={6}>
          <Text fw={700} c="red.7">Total Deduction: ₹{num(totalDeduction)}</Text>
          <Text fw={700} c="blue.7">Net Payable: ₹{num(netPayable)}</Text>
          <Text fw={700} c="teal.7">Amount Paid: ₹{num(invoice.amountPaidByClient)}</Text>
          <Text fw={700} c="teal.8">Balance: ₹{num(balance)}</Text>
        </Stack>
      </Stack>
    </Modal>
  );
}

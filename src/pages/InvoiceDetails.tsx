  // Format date as '12 April 2025'
  const formatDateToLong = (dateInput: Date | string | null | undefined): string => {
    if (!dateInput) return "-";
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return "-";
    const day = date.getDate();
    const month = date.toLocaleString("en-US", { month: "long" });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Stack,
  Title,
  Text,
  Loader,
  Badge,
  Group,
  Paper,
  Divider,
  rem,
  Grid,
  Button,
} from "@mantine/core";
import axios from "axios";
import Cookies from "js-cookie";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getUserRole } from "../lib/utils/getUserRole";
import type { Invoice } from "../interface/Invoice";

export default function InvoiceDetails() {
  const { invoiceNumber } = useParams<{ invoiceNumber: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const invoiceRef = useRef<HTMLDivElement>(null);

  const fetchInvoice = async () => {
    try {
      const token = Cookies.get("token");
      const role = getUserRole();
      let url = "/api/v1/invoices";
      if (role === "user") {
        url = "/api/v1/user-invoices/project";
      }
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log(`Fetched invoices for details page [role=${role}]:`, res.data);
      const found = res.data.find((inv: Invoice) => inv.id === invoiceNumber);
      if (!found) {
        console.warn(`No invoice found for invoiceNumber: ${invoiceNumber}`);
      }
      setInvoice(found || null);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [invoiceNumber]);

  if (loading) return <Loader size="xl" style={{ marginTop: 50 }} />;
  if (!invoice) return <Text>No invoice found</Text>;

  const num = (v: string | number | null | undefined) => {
    const n = v === null || v === undefined || v === "" ? 0 : Number(v);
    return n < 0 ? 0 : Number(n.toFixed(2));
  };
  // Robust GST percentage parser
  const parseGst = (v: string | number | null | undefined) => {
    if (v === null || v === undefined || v === "") return 0;
    if (typeof v === "number") return v;
    const cleaned = v.replace(/[^\d.]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };
  // Use values from backend/database for these fields
  const totalDeduction = num(invoice.totalDeduction);
  const netPayable = num(invoice.netPayable);
  const balance = num(invoice.balance);

  const fmtDate = formatDateToLong;

  const fmtProject = (p: string | string[] | null | undefined) => {
    if (!p) return "-";
    if (Array.isArray(p)) return p.join(", ");
    return String(p);
  };

  const openPdfInNewTab = async () => {
    if (!invoice) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Helper to fetch logo
    const getLogoBase64 = (): Promise<string | null> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = "https://annuprojects.com/wp-content/uploads/2024/03/logo.png";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
          } else {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
      });
    };

    const logoData = await getLogoBase64();

    // --- Header ---
    if (logoData) {
      doc.addImage(logoData, "PNG", 14, 10, 25, 25);
      doc.setFontSize(22);
      doc.setTextColor(26, 26, 26);
      doc.text("Annu Projects Ltd.", 45, 25);
    } else {
      doc.setFontSize(22);
      doc.setTextColor(26, 26, 26);
      doc.text("Annu Projects Ltd.", 14, 25);
    }

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, pageWidth - 14, 20, { align: "right" });
    
    // Status Logic with Color Highlighting
    doc.text("Status: ", pageWidth - 14 - doc.getTextWidth(invoice.status || ""), 25, { align: "right" });
    
    let statusColor: [number, number, number] = [0, 0, 0]; // Default black
    if (invoice.status === "Paid") statusColor = [32, 201, 151]; // Green
    else if (invoice.status === "Under process") statusColor = [34, 139, 230]; // Blue
    else if (invoice.status === "Cancelled") statusColor = [250, 82, 82]; // Red
    else statusColor = [255, 191, 0]; // Yellow/Orange
    
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.text(invoice.status || "-", pageWidth - 14, 25, { align: "right" });
    doc.setTextColor(100); // Reset

    doc.text(`Date: ${fmtDate(invoice.invoiceDate)}`, pageWidth - 14, 30, { align: "right" });

    let finalY = 40;

    // --- Invoice Details ---
    autoTable(doc, {
      startY: finalY,
      head: [['Project & Invoice Details', '']],
      body: [
        ['Project', fmtProject(invoice.project)],
        ['Milestone', invoice.milestone || '-'],
        ['Bill Category', invoice.mybillCategory || '-'],
        ['State', invoice.state || '-'],
        ['Mode of Project', invoice.modeOfProject || '-'],
        ['Submission Date', fmtDate(invoice.submissionDate)],
        ['Payment Date', fmtDate(invoice.paymentDate)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [66, 99, 235], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    });

    finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

    // --- Financial Breakdown ---
    doc.setFontSize(14);
    doc.setTextColor(26, 26, 26);
    doc.text("Financial Breakdown", 14, finalY);
    finalY += 6;


    const totalDeductionVal = num(invoice.totalDeduction);
    const netPayable = num(invoice.netPayable as number | string);
    const balance = num(invoice.balance);

    const basicData = [
      ['Basic Amount', `Rs. ${num(invoice.invoiceBasicAmount).toLocaleString()}`],
      [`GST (${invoice.gstPercentage || 0}%)`, `Rs. ${num(num(invoice.invoiceBasicAmount) * parseGst(invoice.gstPercentage) / 100).toLocaleString()}`],
      ['Total Amount', `Rs. ${num(invoice.totalAmount).toLocaleString()}`]
    ];

    autoTable(doc, {
      startY: finalY,
      head: [['Description', 'Amount']],
      body: basicData,
      theme: 'striped',
      headStyles: { fillColor: [60, 60, 60] },
      columnStyles: { 1: { halign: 'right' } }
    });

    finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

    // --- Payment Status ---
    doc.text("Payment Status", 14, finalY);
    finalY += 6;

    const paymentData = [
      ['Passed Amount', `Rs. ${num(invoice.passedAmountByClient).toLocaleString()}`],
      ['Amount Paid', `Rs. ${num(invoice.amountPaidByClient).toLocaleString()}`],
      ['Net Payable', `Rs. ${num(netPayable).toLocaleString()}`],
      ['Balance Due', `Rs. ${num(balance).toLocaleString()}`],
    ];

    autoTable(doc, {
      startY: finalY,
      head: [['Description', 'Amount']],
      body: paymentData,
      theme: 'striped',
      headStyles: { fillColor: [40, 160, 40] },
      columnStyles: { 1: { halign: 'right' } }
    });

    finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

    // --- Deductions ---
    doc.text("Deductions & Adjustments", 14, finalY);
    finalY += 6;

    const deductionsData = [
      ['Retention', invoice.retention],
      ['GST Withheld', invoice.gstWithheld],
      ['TDS', invoice.tds],
      ['GST TDS', invoice.gstTds],
      ['BOCW', invoice.bocw],
      ['Low Depth', invoice.lowDepthDeduction],
      ['LD', invoice.ld],
      ['SLA Penalty', invoice.slaPenalty],
      ['Penalty', invoice.penalty],
      ['Other', invoice.otherDeduction],
    ].map(row => [row[0], `Rs. ${num(row[1] as number | string | null).toLocaleString()}`]);

    deductionsData.push(['TOTAL DEDUCTIONS', `Rs. ${num(totalDeductionVal).toLocaleString()}`]);

    autoTable(doc, {
      startY: finalY,
      head: [['Deduction Type', 'Amount']],
      body: deductionsData,
      theme: 'striped',
      headStyles: { fillColor: [200, 40, 40] },
      columnStyles: { 1: { halign: 'right' } },
      didParseCell: (data: { row: { index: number }; cell: { styles: { fontStyle: string } } }) => {
        if (data.row.index === deductionsData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

    // Remarks
    if(invoice.remarks) {
      doc.setFontSize(12);
      doc.setTextColor(50);
      doc.text("Remarks:", 14, finalY);
      doc.setFontSize(10);
      doc.text(invoice.remarks, 14, finalY + 6, { maxWidth: pageWidth - 28 });
    }

    const blob = doc.output("blob");
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
  };

  const handlePrint = () => {
    openPdfInNewTab();
  };
  

  return (
    <Stack gap="0" style={{ minHeight: "100vh"}}>
      {/* Header Section */}
      <Paper 
        p="0" 
        radius="0" 
        style={{ 
          background: "#ffffff",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)"
        }}
      >
        <Stack gap="0" style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ padding: "1rem 2rem", display: "flex", justifyContent: "flex-end" }}>
            <Button variant="subtle" size="sm" onClick={() => navigate("/dashboard-2")}>
              ← Back to Dashboard
            </Button>
          </div>
          <div style={{ padding: "2rem 2rem 3rem 2rem" }}>
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="2rem">
              <Stack gap="xl" style={{ flex: 1, minWidth: 300 }}>
                <div>
                  <Text size="xs" c="gray.6" tt="uppercase" fw={600} >Invoice Document</Text>
                  <Title 
                    order={1} 
                    style={{ 
                      fontSize: rem(44), 
                      fontWeight: 900, 
                      color: "#1a1a1a",
                      marginTop: "0.75rem",
                      letterSpacing: "-1px"
                    }}
                  >
                    #{invoice.invoiceNumber}
                  </Title>
                </div>
                <Group gap="md">
                  <Badge 
                    size="lg" 
                    color={
                      invoice.status === "Paid"
                            ? "#20c997"
                            : invoice.status === "Under process"
                            ? "#228be6"
                            : invoice.status === "Cancelled"
                            ? "#fa5252"
                            : "#FFBF00"
                    } 
                    variant="light" 
                    style={{ fontSize: rem(12), padding: "8px 14px", fontWeight: 600 }}
                  >
                    {invoice.status === "Paid" ? "✓ " : ""}{invoice.status}
                  </Badge>
                  <Text c="gray.7" fw={500} size="sm">Invoice Date • {fmtDate(invoice.invoiceDate)}</Text>
                </Group>
              </Stack>
              
              <Group gap="xl" align="flex-start">
                <Paper 
                  p="lg" 
                  radius="lg" 
                  shadow="sm"
                  withBorder
                  style={{ 
                    background: "#f8f9fa",
                    border: "1px solid #e9ecef",
                    minWidth: "160px",
                    textAlign: "center"
                  }}
                >
                  <Stack gap="sm">
                    <Text size="xs" c="gray.6" tt="uppercase" fw={600} >Net Payable</Text>
                    <Text fw={900} c="blue.7" style={{ fontSize: rem(26) }}>₹{num(netPayable).toLocaleString()}</Text>
                  </Stack>
                </Paper>
                
                <Paper 
                  p="lg" 
                  radius="lg" 
                  shadow="sm"
                  withBorder
                  style={{ 
                    background: balance > 0 ? "#fff5f5" : "#f0fff4",
                    border: balance > 0 ? "1px solid #ffe0e0" : "1px solid #e0f9e3",
                    minWidth: "160px",
                    textAlign: "center"
                  }}
                >
                  <Stack gap="sm">
                    <Text size="xs" c="gray.6" tt="uppercase" fw={600} >Balance Due</Text>
                    <Text fw={900} c={balance > 0 ? "red.7" : "green.7"} style={{ fontSize: rem(26) }}>₹{num(balance).toLocaleString()}</Text>
                    {/* <Text fw={800} c={balance > 0 ? "red.8" : "green.8"} size="lg">₹{num(balance).toLocaleString()}</Text> */}
                  </Stack>
                </Paper>
              </Group>
            </Group>
          </div>
        </Stack>
      </Paper>

      {/* Main Content */}
      <div ref={invoiceRef} style={{ flex: 1, display: "flex", justifyContent: "center", padding: "2rem 1rem" }}>
        <Stack gap="lg" style={{ width: "100%", maxWidth: 1000 }}>
          
          {/* Basic Info Card */}
          <Paper p="lg" radius="lg" shadow="md" withBorder style={{ background: "#fff" }}>
            <Stack gap="md">
              <Title order={4} style={{ fontSize: rem(18), fontWeight: 700, color: "#1a1a1a" }}>
                📋 Invoice Information
              </Title>
              <Grid gutter="xl">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">Project</Text>
                      <Text fw={700} c="blue.7">{fmtProject(invoice.project)}</Text>
                    </Group>
                    <Divider my={0} color="gray.2"/>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">Mode of Project</Text>
                      <Text fw={600}>{invoice.modeOfProject || "-"}</Text>
                    </Group>
                    <Divider my={0} color="gray.2"/>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">State</Text>
                      <Text fw={600}>{invoice.state || "-"}</Text>
                    </Group>
                    <Divider my={0} color="gray.2"/>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">Bill Category</Text>
                      <Text fw={600}>{invoice.mybillCategory || "-"}</Text>
                    </Group>
                    <Divider my={0} color="gray.2"/>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">Milestone</Text>
                      <Text fw={600}>{invoice.milestone || "-"}</Text>
                    </Group>
                  </Stack>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">Invoice Date</Text>
                      <Text fw={700} c="blue.7">{fmtDate(invoice.invoiceDate)}</Text>
                    </Group>
                    <Divider my={0} color="gray.2"/>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">Submission Date</Text>
                      <Text fw={600}>{fmtDate(invoice.submissionDate)}</Text>
                    </Group>
                    <Divider my={0} color="gray.2"/>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">Payment Date</Text>
                      <Text fw={600}>{fmtDate(invoice.paymentDate)}</Text>
                    </Group>
                    <Divider my={0} color="gray.2"/>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">Remarks</Text>
                      <Text fw={600} ta="right" style={{ maxWidth: "60%" }}>{invoice.remarks || "-"}</Text>
                    </Group>
                  </Stack>
                </Grid.Col>
              </Grid>
            </Stack>
          </Paper>

          {/* Amount Breakdown Cards */}
          <Grid gutter="lg">
            {/* Left: Basic Amount */}
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Paper p="lg" radius="lg" shadow="md" withBorder style={{ background: "#f8f9ff" }}>
                <Stack gap="md">
                  <Title order={4} style={{ fontSize: rem(16), fontWeight: 700 }}>💰 Basic Amount</Title>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">Invoice Basic Amount</Text>
                      <Text fw={700} c="blue.7" size="lg">₹{num(invoice.invoiceBasicAmount).toLocaleString()}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">GST Percentage</Text>
                      <Text fw={600}>{invoice.gstPercentage || "-"}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">GST Amount</Text>
                      <Text fw={700} c="blue.7" size="lg">₹{num(num(invoice.invoiceBasicAmount) * parseGst(invoice.gstPercentage) / 100).toLocaleString()}</Text>
                    </Group>
                    <Divider my="xs" color="gray.3"/>
                    <Group justify="space-between">
                      <Text fw={700} size="sm">Total Amount</Text>
                      <Text fw={800} c="blue.8" size="lg">₹{num(invoice.totalAmount).toLocaleString()}</Text>
                    </Group>
                  </Stack>
                </Stack>
              </Paper>
            </Grid.Col>

            {/* Right: Payment Status */}
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Paper p="lg" radius="lg" shadow="md" withBorder style={{ background: "#f0fff4" }}>
                <Stack gap="md">
                  <Title order={4} style={{ fontSize: rem(16), fontWeight: 700 }}>✅ Payment Status</Title>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">Passed Amount by Client</Text>
                      <Text fw={700} c="green.7" size="lg">₹{num(invoice.passedAmountByClient).toLocaleString()}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">Amount Paid</Text>
                      <Text fw={700} c="teal.7" size="lg">₹{num(invoice.amountPaidByClient).toLocaleString()}</Text>
                    </Group>
                    <Divider my="xs" color="gray.3"/>
                    <Group justify="space-between">
                      <Text fw={700} size="sm">Net Payable</Text>
                      <Text fw={800} c="blue.8" size="lg">₹{num(netPayable).toLocaleString()}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text fw={700} size="sm">Balance</Text>
                      <Text fw={800} c={balance > 0 ? "red.8" : "green.8"} size="lg">₹{num(balance).toLocaleString()}</Text>
                    </Group>
                  </Stack>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>


          {/* Deductions Section */}
          <Paper p="lg" radius="lg" shadow="md" withBorder style={{ background: "#fff5f5" }}>
            <Stack gap="md">
              <Title order={4} style={{ fontSize: rem(16), fontWeight: 700 }}>📊 Deductions & Adjustments</Title>
              <Grid gutter="md">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">Retention</Text>
                      <Text fw={600}>₹{num(invoice.retention).toLocaleString()}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">GST Withheld</Text>
                      <Text fw={600}>₹{num(invoice.gstWithheld).toLocaleString()}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">TDS</Text>
                      <Text fw={600}>₹{num(invoice.tds).toLocaleString()}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">GST TDS</Text>
                      <Text fw={600}>₹{num(invoice.gstTds).toLocaleString()}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">BOCW</Text>
                      <Text fw={600}>₹{num(invoice.bocw).toLocaleString()}</Text>
                    </Group>
                  </Stack>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">Low Depth Deduction</Text>
                      <Text fw={600}>₹{num(invoice.lowDepthDeduction).toLocaleString()}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">LD</Text>
                      <Text fw={600}>₹{num(invoice.ld).toLocaleString()}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">SLA Penalty</Text>
                      <Text fw={600}>₹{num(invoice.slaPenalty).toLocaleString()}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">Penalty</Text>
                      <Text fw={600}>₹{num(invoice.penalty).toLocaleString()}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text c="dimmed" fw={500} size="sm">Other Deduction</Text>
                      <Text fw={600}>₹{num(invoice.otherDeduction).toLocaleString()}</Text>
                    </Group>
                  </Stack>
                </Grid.Col>
              </Grid>
              <Divider my="xs" color="gray.3"/>
              <Group justify="flex-end">
                <Text fw={700} size="lg">Total Deduction:</Text>
                <Text fw={800} c="red.8" size="lg">₹{num(totalDeduction).toLocaleString()}</Text>
              </Group>
            </Stack>
          </Paper>

          {/* Invoice Documents Section */}
          <Paper p="lg" radius="lg" shadow="md" withBorder style={{ background: '#f8f9ff' }}>
            <Stack gap="md">
              <Title order={4} style={{ fontSize: rem(16), fontWeight: 700, color: '#1a1a1a' }}>📁 Invoice Documents</Title>
              <Grid gutter="lg">
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Stack gap="xs" align="flex-start" style={{ padding: '0 0.5rem' }}>
                    <Text fw={500} size="sm">Invoice Copy</Text>
                    {invoice.invoice_copy_path ? (
                      <a
                        href={`/api/v1/files/${encodeURIComponent(invoice.invoice_copy_path.split(/[/\\]/).pop() || '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#1971c2',
                          fontWeight: 500,
                          textDecoration: 'underline',
                          wordBreak: 'break-all',
                          fontSize: rem(14)
                        }}
                      >
                        {/* {invoice.invoice_copy_path.split(/[/\\]/).pop()} */}
                        View File
                      </a>
                    ) : (
                      <Text c="dimmed" size="xs">No file uploaded</Text>
                    )}
                  </Stack>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Stack gap="xs" align="flex-start" style={{ padding: '0 0.5rem' }}>
                    <Text fw={500} size="sm">Proof of Submission</Text>
                    {invoice.proof_of_submission_path ? (
                      <a
                        href={`/api/v1/files/${encodeURIComponent(invoice.proof_of_submission_path.split(/[/\\]/).pop() || '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#1971c2',
                          fontWeight: 500,
                          textDecoration: 'underline',
                          wordBreak: 'break-all',
                          fontSize: rem(14)
                        }}
                      >
                        {/* {invoice.proof_of_submission_path.split(/[/\\]/).pop()} */}
                        View File
                      </a>
                    ) : (
                      <Text c="dimmed" size="xs">No file uploaded</Text>
                    )}
                  </Stack>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Stack gap="xs" align="flex-start" style={{ padding: '0 0.5rem' }}>
                    <Text fw={500} size="sm">Supporting Documents</Text>
                    {invoice.supporting_docs_path ? (
                      <a
                        href={`/api/v1/files/${encodeURIComponent(invoice.supporting_docs_path.split(/[/\\]/).pop() || '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#1971c2',
                          fontWeight: 500,
                          textDecoration: 'underline',
                          wordBreak: 'break-all',
                          fontSize: rem(14)
                        }}
                      >
                        {/* {invoice.supporting_docs_path.split(/[/\\]/).pop()} */}
                        View File
                      </a>
                    ) : (
                      <Text c="dimmed" size="xs">No file uploaded</Text>
                    )}
                  </Stack>
                </Grid.Col>
              </Grid>
            </Stack>
          </Paper>

        </Stack>
      </div>

      {/* Footer Buttons */}
      <Paper p="lg" radius="0" shadow="md" style={{ background: "rgba(255, 255, 255, 0.95)" }}>
        <Group justify="center" gap="lg" style={{ maxWidth: 1000, margin: "0 auto" }}>
          <Button variant="outline" size="lg" onClick={() => navigate(-1)}>
            ← Back
          </Button>
          <Button variant="filled" color="blue" size="lg" onClick={handlePrint}>
            
            🖨 Print Invoice
          </Button>
        </Group>
      </Paper>
    </Stack>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Group, Stack, Loader, Text, Paper, Title } from "@mantine/core";
import { IconDownload, IconPrinter, IconArrowLeft } from "@tabler/icons-react";
import axios from "axios";
import Cookies from "js-cookie";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getUserRole } from "../lib/utils/getUserRole";
import type { Invoice } from "@/interface/Invoice";

// Helper functions (copied from InvoiceDetails for consistency)
const formatDateToLong = (dateInput: Date | string | null | undefined): string => {
  if (!dateInput) return "-";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "-";
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "long" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

const num = (v: string | number | null | undefined) => {
  const n = v === null || v === undefined || v === "" ? 0 : Number(v);
  return n < 0 ? 0 : Number(n.toFixed(2));
};

const parseGst = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const cleaned = v.replace(/[^\d.]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

const fmtProject = (p: string | string[] | null | undefined) => {
  if (!p) return "-";
  if (Array.isArray(p)) return p.join(", ");
  return String(p);
};

export default function InvoicePdfPreview() {
  const { invoiceNumber } = useParams<{ invoiceNumber: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const navigate = useNavigate();

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

      const found = res.data.find((inv: Invoice) => inv.id === invoiceNumber);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceNumber]);

  useEffect(() => {
    if (invoice) {
        generatePdfBlob();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice]);

  const generatePdfBlob = async () => {
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

    doc.text(`Date: ${formatDateToLong(invoice.invoiceDate)}`, pageWidth - 14, 30, { align: "right" });

    let finalY = 40;
    const fmtDate = formatDateToLong;

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalDeduction = num((invoice as any).totalDeduction || invoice.totalDeductions);
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
    ].map(row => [row[0], `Rs. ${num(row[1] as string | number).toLocaleString()}`]);

    deductionsData.push(['TOTAL DEDUCTIONS', `Rs. ${num(totalDeduction).toLocaleString()}`]);

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
    const url = URL.createObjectURL(blob);
    setPdfUrl(url);
  };

  const handleDownload = () => {
    if (!invoice) return;
    const link = document.createElement('a'); 
    link.href = pdfUrl || "";
    link.download = `Invoice_${invoice.invoiceNumber}.pdf`;
    link.click();
  };

  const handlePrint = () => {
    if (!pdfUrl) return;
    // Open in new window for printing, or use iframe contentWindow
    const iframe = document.getElementById('pdf-preview') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.print();
    }
  };

  if (loading) return <Loader size="xl" style={{ marginTop: 50, marginLeft: "auto", marginRight: "auto", display: "block" }} />;
  if (!invoice) return <Text ta="center" mt="xl">No invoice found</Text>;

  return (
    <Stack style={{ height: "100vh", padding: "1rem" }}>
      <Paper p="md" shadow="sm" withBorder style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Group>
            <Button variant="subtle" leftSection={<IconArrowLeft size={16}/>} onClick={() => navigate(-1)}>
                Back
            </Button>
            <Title order={3}>Invoice Preview: {invoice.invoiceNumber}</Title>
        </Group>
        <Group>
            <Button leftSection={<IconDownload size={16}/>} onClick={handleDownload}>
                Download PDF
            </Button>
            <Button color="green" leftSection={<IconPrinter size={16}/>} onClick={handlePrint}>
                Print PDF
            </Button>
        </Group>
      </Paper>
      
      <div style={{ flex: 1, border: "1px solid #e9ecef", borderRadius: "8px", overflow: "hidden" }}>
        {pdfUrl && (
            <iframe 
                id="pdf-preview"
                src={pdfUrl} 
                style={{ width: "100%", height: "100%", border: "none" }} 
                title="Invoice Preview"
            />
        )}
      </div>
    </Stack>
  );
}

import { useEffect, useState } from "react";
import {
  Table,
  TextInput,
  Group,
  Button,
  Modal,
  Text,
  Badge,
  Stack,
  ActionIcon,
  Loader,
  Title,
  Select,
  Progress,
  FileInput,
  Checkbox,
  Pagination,
  ScrollArea,
  Flex
} from "@mantine/core";
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from "@mantine/hooks";
import { IconSearch, IconPlus, IconEdit, IconTrash, IconDownload, IconEye, IconUpload, IconFilter } from "@tabler/icons-react";
import axios from "axios";
import InvoiceForm from "../components/InvoiceForm";
import InvoicePopup from "./InvoicePopup";
import type { Invoice } from "../interface/Invoice";
import { modals } from "@mantine/modals";
import { notifySuccess, notifyError } from "../lib/utils/notify";
import Cookies from "js-cookie";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";

const BASE_URL = import.meta.env.VITE_BASE_URL;

// Utility function to format date as '12 April 2025'
function formatDateToLong(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "-";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "-";
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "long" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

// --- HELPER FUNCTIONS ---

// 1. Fuzzy Header Normalizer: "Balance / Pending Amount" -> "balancependingamount"
// This fixes issues where Excel has extra spaces or newlines in headers
const normalizeHeader = (header: unknown) => {
  if (!header) return "";
  return String(header).toLowerCase().replace(/[^a-z0-9]/g, "");
};

// 2. Strict Amount Cleaner:
// - Removes currency symbols and commas.
// - FORCES 2 decimal places. 
// - Example: "₹ 1,200.32555" -> 1200.33
// - Example: "0.00" (visual) -> 0
const cleanAmountStrict = (val: unknown): number | null => {
  if (val === null || val === undefined || val === "") return null;
  
  // Convert to string and strip non-numeric characters (allow . and -)
  const cleanStr = String(val).replace(/[^0-9.-]/g, "");
  
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return 0;
  
  // THE FIX: strict truncation to 2 decimal places
  return parseFloat(num.toFixed(2));
};

// 3. Header Mapper using Normalized Keys
const getDbKeyFromFuzzyHeader = (normalizedHeader: string) => {
  const map: Record<string, string> = {
    "project": "project",
    "modeofproject": "modeOfProject",
    "state": "state",
    "mybillcategory": "mybillCategory",
    "milestone": "milestone",
    "invoicenumber": "invoiceNumber",
    "invoiceno": "invoiceNumber",
    "invoicedate": "invoiceDate",
    "submissiondate": "submissionDate",
    "invoicebasicamount": "invoiceBasicAmount",
    "gstpercentage": "gstPercentage",
    "invoicegstamount": "invoiceGstAmount",
    "totalamount": "totalAmount",
    "passedamountbyclient": "passedAmountByClient",
    "retention": "retention",
    "gstwithheld": "gstWithheld",
    "tds": "tds",
    "gsttds": "gstTds",
    "bocw": "bocw",
    "lowdepthdeduction": "lowDepthDeduction",
    "ld": "ld",
    "slapenalty": "slaPenalty",
    "penalty": "penalty",
    "otherdeduction": "otherDeduction",
    "totaldeduction": "totalDeduction",
    "netpayable": "netPayable",
    "status": "status",
    "amountpaidbyclient": "amountPaidByClient",
    "paymentdate": "paymentDate",
    // These now catch "Balance", "Balance/Pending Amount", "Balance (Pending)"
    "balance": "balance",
    "balancependingamount": "balance", 
    "pendingamount": "balance",
    "remarks": "remarks",
  };
  return map[normalizedHeader] || null;
};

export default function Admin_invoice() {
  // Multi-select state
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);

  const [opened, { open, close }] = useDisclosure(false);
  const [filtersVisible, { toggle: toggleFilters }] = useDisclosure(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);
  const pageSize = 30;

  // Import modal states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importErrors, setImportErrors] = useState<string[]>([]);

  // Fetch invoices
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const token = Cookies.get("token");
      const res = await axios.get(`${BASE_URL}/api/v1/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const normalized = (res.data || []).map((inv: Invoice) => ({
        ...inv,
        invoiceDate: inv.invoiceDate ?? null,
        submissionDate: inv.submissionDate ?? null,
        paymentDate: inv.paymentDate ?? null,
      }));

      // Sort by createdAt descending (most recent first)
      normalized.sort((a: Invoice, b: Invoice) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      });

      setInvoices(normalized);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      notifyError("Failed to fetch invoices. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  // Delete single invoice
  const handleDelete = (id: string) => {
    modals.openConfirmModal({
      title: "Delete invoice",
      centered: true,
      children: <Text size="sm">Are you sure you want to delete this invoice?</Text>,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          const token = Cookies.get("token");
          await axios.delete(`${BASE_URL}/api/v1/invoices/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setInvoices((prev) => prev.filter((inv) => inv.id !== id));
          setSelectedRows((prev) => prev.filter((rowId) => rowId !== id));
          notifySuccess("Invoice deleted successfully");
        } catch (error) {
          console.error("Error deleting invoice:", error);
          notifyError("Failed to delete invoice. Please try again.");
        }
      },
    });
  };

  // Delete multiple selected invoices
  const handleDeleteSelected = () => {
    if (selectedRows.length === 0) return;
    modals.openConfirmModal({
      title: "Delete selected invoices",
      centered: true,
      children: <Text size="sm">Are you sure you want to delete {selectedRows.length} selected invoice(s)?</Text>,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          const token = Cookies.get("token");
          await Promise.all(selectedRows.map(id =>
            axios.delete(`${BASE_URL}/api/v1/invoices/${id}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
          ));
          setInvoices((prev) => prev.filter((inv) => !selectedRows.includes(inv.id)));
          setSelectedRows([]);
          notifySuccess("Selected invoices deleted successfully");
        } catch (error) {
          console.error("Error deleting selected invoices:", error);
          notifyError("Failed to delete selected invoices. Please try again.");
        }
      },
    });
  };

  const handleEdit = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    open();
  };

  const handleNew = () => {
    setSelectedInvoice(null);
    open();
  };

  // Build unique project options
  const projectOptions = Array.from(
    new Set(
      invoices.flatMap((inv) =>
        Array.isArray(inv.project) ? inv.project : inv.project ? [inv.project] : []
      )
    )
  ).map((p) => ({ value: p as string, label: p as string }));

  const statusOptions = [
    { value: "Paid", label: "Paid" },
    { value: "Cancelled", label: "Cancelled" },
    { value: "Under process", label: "Under process" },
    { value: "Credit Note Issued", label: "Credit Note Issued" },
  ];

  // Filter invoices
  const filteredInvoices = (invoices || []).filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      inv.status?.toLowerCase().includes(search.toLowerCase());

    const matchesProject = projectFilter
      ? (Array.isArray(inv.project)
          ? inv.project.some((p) => p.toLowerCase() === projectFilter.toLowerCase())
          : inv.project?.toLowerCase() === projectFilter.toLowerCase())
      : true;

    const matchesStatus = !statusFilter || inv.status?.toLowerCase() === statusFilter.toLowerCase();

    let matchesDate = true;
    if (dateRange[0] && dateRange[1]) {
      const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : inv.invoiceDate ? new Date(inv.invoiceDate) : null;
      if (!invDate || isNaN(invDate.getTime())) return false;
      const start = new Date(dateRange[0]);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRange[1]);
      end.setHours(23, 59, 59, 999);
      if (invDate < start || invDate > end) matchesDate = false;
    }

    return matchesSearch && matchesProject && matchesStatus && matchesDate;
  });

  // Export
  const handleExport = () => {
    try {
      const exportData = (filteredInvoices || []).map((inv) => ({
        "Project": Array.isArray(inv.project) ? inv.project.join(", ") : inv.project ?? "",
        "Mode of Project": inv.modeOfProject ?? "",
        "State": inv.state ?? "",
        "MyBill Category": inv.mybillCategory ?? "",
        "Milestone": inv.milestone ?? "",
        "Invoice Number": inv.invoiceNumber ?? "",
        "Invoice Date": inv.invoiceDate ? formatDateToLong(inv.invoiceDate) : "",
        "Submission Date": inv.submissionDate ? formatDateToLong(inv.submissionDate) : "",
        "Invoice Basic Amount": inv.invoiceBasicAmount ?? 0,
        "GST Percentage": inv.gstPercentage ?? "",
        "Invoice GST Amount": inv.invoiceGstAmount ?? 0,
        "Total Amount": inv.totalAmount ?? 0,
        "Passed Amount By Client": inv.passedAmountByClient ?? 0,
        "Retention": inv.retention ?? 0,
        "GST Withheld": inv.gstWithheld ?? 0,
        "TDS": inv.tds ?? 0,
        "GST TDS": inv.gstTds ?? 0,
        "BOCW": inv.bocw ?? 0,
        "Low Depth Deduction": inv.lowDepthDeduction ?? 0,
        "LD": inv.ld ?? 0,
        "SLA Penalty": inv.slaPenalty ?? 0,
        "Penalty": inv.penalty ?? 0,
        "Other Deduction": inv.otherDeduction ?? 0,
        "Total Deduction": inv.totalDeduction ?? 0,
        "Net Payable": inv.netPayable ?? 0,
        "Status": inv.status ?? "",
        "Amount Paid By Client": inv.amountPaidByClient ?? 0,
        "Payment Date": inv.paymentDate ? formatDateToLong(inv.paymentDate) : "",
        "Balance": inv.balance ?? 0,
        "Remarks": inv.remarks ?? "",
        "Invoice Copy Path": inv.invoice_copy_path ?? "",
        "Proof Of Submission Path": inv.proof_of_submission_path ?? "",
        "Supporting Docs Path": inv.supporting_docs_path ?? "",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Invoices");
      const filename = `invoices_full_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);
      notifySuccess(`Exported ${exportData.length} invoice(s)`);
    } catch (error) {
      console.error("Export failed", error);
      notifyError("Failed to export invoices");
    }
  };


  // Reset to first page if filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, projectFilter, statusFilter, dateRange, invoices]);

  const totalPages = Math.ceil(filteredInvoices.length / pageSize);
  const visibleInvoices = (filteredInvoices || []).slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const formatMoney = (val: number | null | undefined): string => {
    const n = Number(val ?? 0);
    if (isNaN(n) || n <= 0) return "0.00";
    return n.toFixed(2);
  };

  const parseExcelDate = (val: unknown): string | null => {
    if (!val) return null;
    if (typeof val === "number") {
      const d = XLSX.SSF.parse_date_code(val);
      if (!d) return null;
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
    if (typeof val === "string") {
      const parts = val.trim().split(" ");
      if (parts.length === 3) {
         const day = Number(parts[0]);
         const year = Number(parts[2]);
         const monthMap: Record<string, number> = {
            january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
            july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
         };
         const month = monthMap[parts[1].toLowerCase()];
         if (day && month && year) {
             return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
         }
      }
      const dateObj = new Date(val);
      if(!isNaN(dateObj.getTime())) {
          return dateObj.toISOString().split('T')[0];
      }
    }
    return null;
  };

  const getLoggedInUserId = (): string | null => {
    const cookieUserId = Cookies.get("userId") || Cookies.get("user_id");
    if (cookieUserId) return cookieUserId;
    const token = Cookies.get("token");
    if (!token) return null;
    try {
      const base64Payload = token.split(".")[1];
      const payload = JSON.parse(atob(base64Payload.replace(/-/g, "+").replace(/_/g, "/")));
      return payload.userId || payload.user_id || payload.sub || payload.id || null;
    } catch (err) {
      console.error("Failed to decode token", err);
      return null;
    }
  };

  // --- REWRITTEN HANDLE IMPORT ---
  const handleImport = async () => {
    if (!file) return notifyError("Please select a file");

    const userId = getLoggedInUserId();
    if (!userId) return notifyError("Please re-login");

    setImporting(true);
    setImportErrors([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // OPTION 2: "Array of Arrays" Strategy
      // This is safer than sheet_to_json objects because we process headers manually by index.
      // header: 1 gives us [['Head1', 'Head2'], ['Val1', 'Val2']]
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

      if (jsonData.length < 2) throw new Error("File appears to be empty or missing headers");

      // Extract Headers and normalize them (Row 0)
      // "Balance / Pending Amount" -> "balancependingamount"
      const headers = (jsonData[0] as string[]).map(h => normalizeHeader(h));
      const dataRows = jsonData.slice(1); // The rest is data

      setImportProgress({ current: 0, total: dataRows.length });

      const token = Cookies.get("token");
      const errors: string[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i] as unknown[]; // This is an array: ["Project1", "Paid", "100.00"]
        const payload: Record<string, unknown> = { userId };
        let hasData = false;

        console.log("Processing row:", row);
        // Iterate through our Normalized Headers to find the correct data index
        headers.forEach((header, index) => {
            const dbKey = getDbKeyFromFuzzyHeader(header);
            if (!dbKey) return; // Skip if we don't know what this column is

            let val = row[index]; // Grab value from the array at specific index
            hasData = true;

            // 1. Date Handling
            if (["invoiceDate", "submissionDate", "paymentDate"].includes(dbKey)) {
                payload[dbKey] = parseExcelDate(val);
                return;
            }

            // 2. Percentage Handling
            if (["milestone", "gstPercentage"].includes(dbKey)) {
                payload[dbKey] = val ? String(val).trim() : val;
                return;
            }

            if (typeof val === "string") val = val.trim();

            // 3. Amount Handling (STRICT)
            const amountFields = [
                "invoiceBasicAmount", "invoiceGstAmount", "totalAmount", 
                "passedAmountByClient", "retention", "gstWithheld", "tds", 
                "gstTds", "bocw", "lowDepthDeduction", "ld", "slaPenalty", 
                "penalty", "otherDeduction", "totalDeduction", "netPayable", 
                "amountPaidByClient", "balance"
            ];

            if (amountFields.includes(dbKey)) {
                // Apply strict cleaning (force 2 decimals)
                payload[dbKey] = cleanAmountStrict(val);
            } else {
                // Text Fields
                payload[dbKey] = (val === "" || val === undefined) ? null : val;
            }
        });

        console.log("Constructed payload:", payload);

        if (!hasData) continue; // Skip empty rows

        try {
          const form = new FormData();
          Object.entries(payload).forEach(([k, v]) => {
            if (v !== null && v !== undefined) form.append(k, String(v));
          });

          await axios.post(`${BASE_URL}/api/v1/invoices`, form, {
            headers: { Authorization: `Bearer ${token}` },
          });

          setImportProgress(p => ({ ...p, current: p.current + 1 }));
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          errors.push(`Row ${i + 2}: ${errorMessage}`);
        }
      }

      setImportErrors(errors);


      if (errors.length) {
        notifyError(`${errors.length} row(s) failed`);
      } else {
        notifySuccess("Invoices imported successfully");
      }

      await fetchInvoices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notifyError("Import failed: " + msg);
      console.error(err);
    } finally {
      setImporting(false);
      setFile(null);
      setImportModalOpen(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  return (
    <Stack>
      <Stack gap="xs" mb="md">
        <Group justify="space-between" align="center">
           <Title order={2}>Admin Invoice</Title>
           <Button 
             hiddenFrom="sm" 
             onClick={toggleFilters} 
             variant="outline" 
             leftSection={<IconFilter size={14} />}
             size="compact-xs"
             >
             {filtersVisible ? 'Hide' : 'Filters'}
           </Button>
        </Group>
        <Text c="dimmed" size="sm">
          Manage, track, and update invoices from this dashboard.
        </Text>
        <Text c="dimmed" >Total Number of Invoices: <span style={{color:'red',width:'30px'}}>{invoices.length}</span></Text>
      </Stack>

      <Flex justify="space-between" align={{base: 'stretch', sm: 'center'}} direction={{ base: 'column', sm: 'row' }}>
        <Group gap="sm" style={{ flex: 1 }} display={{ base: filtersVisible ? 'flex' : 'none', sm: 'flex' }}>
          <TextInput
            placeholder="Search invoices..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={{ base: '100%', sm: 220 }}
          />
          <Select
            placeholder="Filter by project"
            value={projectFilter}
            onChange={setProjectFilter}
            data={projectOptions}
            w={{ base: '100%', sm: 180 }}
            clearable
          />
          <Select
            placeholder="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            data={statusOptions}
            w={{ base: '100%', sm: 180 }}
            clearable
          />
          <DatePickerInput
            type="range"
            value={dateRange}
            onChange={(val) => setDateRange(val as [Date | null, Date | null])}
            placeholder="Date range"
            radius="md"
            w={{ base: '100%', sm: 220 }}
            mx={2}
            clearable
            dropdownType="modal"
            size="sm"
            allowSingleDateInRange
            maxDate={new Date(2100, 11, 31)}
            minDate={new Date(2000, 0, 1)}
            label={null}
          />
        </Group>

        <Group mt={{ base: 'md', md: 0 }}>
          <Button variant="outline" onClick={() => setImportModalOpen(true)} leftSection={<IconUpload size={14} />}>
            Import <Text span visibleFrom="sm"><span> </span>‎ from CSV/XLSX</Text>
          </Button>

          <Button variant="outline" onClick={handleExport} leftSection={<IconDownload size={14} />}>
            Export <Text span visibleFrom="sm">‎  CSV/XLSX</Text>
          </Button>

          <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>
            <Text span visibleFrom="sm">New ‎ </Text> Invoice
          </Button>
          {selectedRows.length > 0 && (
            <Button
              color="red"
              variant="outline"
              onClick={handleDeleteSelected}
            >
              Delete ({selectedRows.length})
            </Button>
          )}
        </Group>
      </Flex>

      {loading || pageLoading ? (
        <Loader mt="lg" />
      ) : visibleInvoices.length > 0 ? (
        <>
          <ScrollArea>
            <Table striped highlightOnHover withTableBorder style={{ minWidth: 1200 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th visibleFrom="sm">
                  <Checkbox
                    aria-label="Select all rows"
                    checked={visibleInvoices.length > 0 && selectedRows.length === visibleInvoices.length}
                    indeterminate={selectedRows.length > 0 && selectedRows.length < visibleInvoices.length}
                    onChange={(event) => {
                      if (event.currentTarget.checked) {
                        setSelectedRows(visibleInvoices.map((inv) => inv.id));
                      } else {
                        setSelectedRows([]);
                      }
                    }}
                  />
                </Table.Th>
                <Table.Th>Invoice No.</Table.Th>
                <Table.Th visibleFrom="sm">Invoice Date</Table.Th>
                <Table.Th visibleFrom="sm">Basic Amount (₹)</Table.Th>
                <Table.Th visibleFrom="sm">GST Amount (₹)</Table.Th>
                <Table.Th visibleFrom="sm">Total Amount (₹)</Table.Th>
                <Table.Th visibleFrom="sm">Total Deduction (₹)</Table.Th>
                <Table.Th visibleFrom="sm">Net Payable (₹)</Table.Th>
                <Table.Th visibleFrom="sm">Amount Paid (₹)</Table.Th>
                <Table.Th>Balance (₹)</Table.Th>
                <Table.Th visibleFrom="sm">Status</Table.Th>
                <Table.Th>Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visibleInvoices.map((invoice) => {
                const basicAmount = Number(invoice.invoiceBasicAmount ?? 0);
                const gstAmount = Number(invoice.invoiceGstAmount ?? 0);
                const totalAmount = Number(invoice.totalAmount ?? 0);
                const totalDeduction = Number(invoice.totalDeduction ?? 0);
                const netPayable = Number(invoice.netPayable ?? 0);
                const amountPaid = Number(invoice.amountPaidByClient ?? 0);
                const balance = Number(invoice.balance ?? 0);
                const isSelected = selectedRows.includes(invoice.id);
                return (
                  <Table.Tr key={invoice.id} bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}>
                    <Table.Td visibleFrom="sm">
                      <Checkbox
                        aria-label="Select row"
                        checked={isSelected}
                        onChange={(event) => {
                          const checked = event?.currentTarget?.checked;
                          setSelectedRows((prev) =>
                            checked
                              ? [...prev, invoice.id]
                              : prev.filter((rowId) => rowId !== invoice.id)
                          );
                        }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Link
                        to={`/admin-invoice/${encodeURIComponent(invoice.id || "")}`}
                        style={{ color: "#1c7ed6", textDecoration: "none", cursor: "pointer" }}
                      >
                        {invoice.invoiceNumber || "-"}
                      </Link>
                      <Badge
                        hiddenFrom="sm"
                        display="block"
                        mt={4}
                        size="xs"
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
                    </Table.Td>
                    <Table.Td visibleFrom="sm">{formatDateToLong(invoice.invoiceDate)}</Table.Td>
                    <Table.Td visibleFrom="sm">₹{formatMoney(basicAmount)}</Table.Td>
                    <Table.Td visibleFrom="sm">₹{formatMoney(gstAmount)}</Table.Td>
                    <Table.Td visibleFrom="sm">₹{formatMoney(totalAmount)}</Table.Td>
                    <Table.Td visibleFrom="sm">₹{formatMoney(totalDeduction)}</Table.Td>
                    <Table.Td visibleFrom="sm">₹{formatMoney(netPayable)}</Table.Td>
                    <Table.Td visibleFrom="sm">₹{formatMoney(amountPaid)}</Table.Td>
                    <Table.Td>₹{formatMoney(balance)}</Table.Td>
                    <Table.Td visibleFrom="sm">
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
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon color="blue" variant="light" onClick={() => handleEdit(invoice)}>
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon color="red" variant="light" onClick={() => handleDelete(invoice.id)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                        <ActionIcon color="green" variant="light" onClick={() => { setSelectedInvoice(invoice); setViewModalOpen(true); }}>
                          <IconEye size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
          </ScrollArea>
          {/* Mantine Pagination Controls */}
          {totalPages > 1 && (
            <Group justify="center" mt="md">
              <Pagination
                value={currentPage}
                onChange={(page) => {
                  setPageLoading(true);
                  setTimeout(() => {
                    setCurrentPage(page);
                    setPageLoading(false);
                  }, 100); // 100ms fake loading
                }}
                total={totalPages}
                size="md"
                radius="md"
                withEdges
                boundaries={2}
                siblings={1}
                disabled={pageLoading}
              />
            </Group>
          )}
        </>
      ) : (
        <Text ta="center" mt="lg" c="dimmed">
          No invoices available.
        </Text>
      )}

      <Modal
        size="xl"
        opened={opened}
        onClose={close}
        title={selectedInvoice ? "Edit Invoice" : "Add New Invoice"}
        centered
        withCloseButton={true}
        closeOnClickOutside={false}
      >
        <InvoiceForm
          onSubmit={fetchInvoices}
          onClose={close}
          initialValues={selectedInvoice ?? undefined}
        />
      </Modal>

      <InvoicePopup
        opened={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        invoice={selectedInvoice}
      />

      {/* Import modal */}
      <Modal
        opened={importModalOpen}
        onClose={() => { if (!importing) setImportModalOpen(false); }}
        title="Import invoices from CSV/XLSX"
        centered
        size="lg"
      >
        <Stack>
          <Text size="sm">Upload a spreadsheet with the header row. Supported formats: .csv, .xlsx</Text>
          <FileInput
            placeholder="Pick CSV or XLSX file"
            accept=".csv,.xlsx"
            value={file}
            onChange={(f) => setFile(f)}
          />

          {importing && (
            <div>
              <Text size="sm">Importing {importProgress.current} / {importProgress.total}</Text>
              <Progress value={(importProgress.total ? (importProgress.current / importProgress.total) * 100 : 0)} mt="xs" />
            </div>
          )}

          <Group justify="right">
            <Button variant="default" onClick={() => { setFile(null); setImportModalOpen(false); }} disabled={importing}>Cancel</Button>
            <Button onClick={handleImport} loading={importing} disabled={!file}>Start Import</Button>
          </Group>

          {importErrors.length > 0 && (
            <div>
              <Text fw={600}>Errors:</Text>
              {importErrors.map((e, idx) => (
                <Text key={idx} size="xs">{e}</Text>
              ))}
            </div>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}